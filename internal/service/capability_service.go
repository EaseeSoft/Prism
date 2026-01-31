package service

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/httputil"
	"github.com/majingzhen/prism/pkg/logger"
	"github.com/majingzhen/prism/pkg/storage"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type CapabilityService struct {
	paramMapper    *ParamMapper
	responseMapper *ResponseMapper
}

func NewCapabilityService() *CapabilityService {
	return &CapabilityService{
		paramMapper:    NewParamMapper(),
		responseMapper: NewResponseMapper(),
	}
}

// InvokeRequest 调用请求
type InvokeRequest struct {
	UserID      uint
	TokenID     uint
	Capability  string
	Channel     string
	Model       string
	CallbackURL string
	Params      map[string]any
}

// InvokeResponse 调用响应
type InvokeResponse struct {
	TaskID string `json:"task_id"`
	Status string `json:"status"`
}

// Invoke 调用能力接口
func (s *CapabilityService) Invoke(ctx context.Context, req *InvokeRequest) (*InvokeResponse, error) {
	// 1. 查找渠道
	var channel model.Channel
	if err := model.DB().Where("type = ? AND status = ?", req.Channel, 1).First(&channel).Error; err != nil {
		return nil, fmt.Errorf("channel not found: %s", req.Channel)
	}

	// 2. 查找渠道能力配置
	var cc model.ChannelCapability
	query := model.DB().Where("channel_id = ? AND capability_code = ? AND status = ?",
		channel.ID, req.Capability, 1)
	if req.Model != "" {
		query = query.Where("model = ?", req.Model)
	}
	if err := query.First(&cc).Error; err != nil {
		return nil, fmt.Errorf("capability not supported: %s/%s", req.Channel, req.Capability)
	}

	// 3. 如果配置了单价，检查余额并扣费
	logger.Info("capability price check",
		zap.String("capability", req.Capability),
		zap.Float64("price", cc.Price))

	billingService := NewBillingService()
	charged := false
	if cc.Price > 0 {
		if err := billingService.Deduct(req.TokenID, req.UserID, cc.Price); err != nil {
			return nil, fmt.Errorf("insufficient balance: %w", err)
		}
		charged = true
	}

	// 4. 选择账号
	var account model.ChannelAccount
	err := model.DB().Where("channel_id = ? AND status = 1", channel.ID).
		Order("current_tasks ASC, weight DESC").
		First(&account).Error
	if err != nil {
		// 扣费失败需要退回
		if charged {
			_ = billingService.Refund(req.TokenID, req.UserID, cc.Price)
		}
		return nil, fmt.Errorf("no available account")
	}

	// 增加账号任务数
	model.DB().Model(&account).UpdateColumn("current_tasks", gorm.Expr("current_tasks + 1"))

	// 5. 参数映射
	mappedParams, err := s.paramMapper.Map(req.Params, cc.ParamMapping)
	if err != nil {
		// 扣费失败需要退回
		if charged {
			_ = billingService.Refund(req.TokenID, req.UserID, cc.Price)
		}
		return nil, fmt.Errorf("param mapping failed: %w", err)
	}

	// 6. 创建任务
	requestParamsJSON, _ := json.Marshal(req.Params)
	mappedParamsJSON, _ := json.Marshal(mappedParams)

	task := &model.Task{
		TaskNo:              GenerateTaskNo(),
		UserID:              req.UserID,
		TokenID:             req.TokenID,
		CapabilityCode:      req.Capability,
		ChannelID:           channel.ID,
		ChannelCapabilityID: cc.ID,
		AccountID:           account.ID,
		Status:              model.TaskStatusPending,
		CallbackURL:         req.CallbackURL,
		RequestParams:       requestParamsJSON,
		MappedParams:        mappedParamsJSON,
		Cost:                cc.Price,
	}
	if err := model.DB().Create(task).Error; err != nil {
		// 创建任务失败需要退回
		if charged {
			_ = billingService.Refund(req.TokenID, req.UserID, cc.Price)
		}
		return nil, fmt.Errorf("create task failed: %w", err)
	}

	logger.Info("capability task created",
		zap.String("task_no", task.TaskNo),
		zap.String("capability", req.Capability),
		zap.String("channel", req.Channel),
		zap.Float64("cost", cc.Price))

	// 7. 异步执行任务
	go s.executeTask(task, &channel, &cc, &account, mappedParams)

	return &InvokeResponse{
		TaskID: task.TaskNo,
		Status: string(task.Status),
	}, nil
}

// executeTask 执行任务（异步）
func (s *CapabilityService) executeTask(
	task *model.Task,
	channel *model.Channel,
	cc *model.ChannelCapability,
	account *model.ChannelAccount,
	params map[string]any,
) {
	ctx := context.Background()
	defer s.releaseAccount(account.ID)

	// 更新状态为处理中
	now := time.Now()
	model.DB().Model(task).Updates(map[string]any{
		"status":     model.TaskStatusProcessing,
		"started_at": now,
	})

	// 构建请求URL
	url := channel.BaseURL + cc.RequestPath

	// 处理认证
	headers := make(map[string]string)
	authKey := cc.AuthKey
	if authKey == "" {
		authKey = "Authorization"
	}
	authValue := cc.AuthValuePrefix + account.APIKey

	switch cc.AuthLocation {
	case "header":
		headers[authKey] = authValue
	case "body":
		params[authKey] = account.APIKey
	case "query":
		if strings.Contains(url, "?") {
			url += "&" + authKey + "=" + account.APIKey
		} else {
			url += "?" + authKey + "=" + account.APIKey
		}
	default:
		headers["Authorization"] = "Bearer " + account.APIKey
	}

	// 发送请求（根据 ContentType 选择请求格式）
	detail := httputil.PostWithDetail(ctx, url, params, headers, cc.ContentType)
	s.logRequest(task, model.RequestTypeSubmit, detail)
	if detail.Error != nil {
		s.failTask(task, detail.Error.Error())
		return
	}
	resp := detail.ResponseBody

	// 保存原始响应
	model.DB().Model(task).Update("vendor_response", resp)

	// 解析响应
	var respMap map[string]any
	json.Unmarshal(resp, &respMap)

	// 根据结果模式处理
	switch cc.ResultMode {
	case model.ResultModeSync:
		s.handleSyncResult(task, cc, respMap)
	case model.ResultModePoll:
		s.handlePollResult(task, channel, cc, account, respMap)
	case model.ResultModeCallback:
		s.handleCallbackResult(task, cc, respMap)
	}
}

// handleSyncResult 处理同步结果
func (s *CapabilityService) handleSyncResult(task *model.Task, cc *model.ChannelCapability, resp map[string]any) {
	result, err := s.responseMapper.Map(resp, cc.ResponseMapping)
	if err != nil {
		s.failTask(task, err.Error())
		return
	}
	s.completeTask(task, cc, result)
}

// handlePollResult 处理轮询结果
func (s *CapabilityService) handlePollResult(
	task *model.Task,
	channel *model.Channel,
	cc *model.ChannelCapability,
	account *model.ChannelAccount,
	submitResp map[string]any,
) {
	ctx := context.Background()

	// 从提交响应中获取供应商任务ID
	submitResult, _ := s.responseMapper.Map(submitResp, cc.ResponseMapping)
	vendorTaskID := extractString(submitResult["task_id"])
	model.DB().Model(task).Update("vendor_task_id", vendorTaskID)

	logger.Info("start polling",
		zap.String("task_no", task.TaskNo),
		zap.String("vendor_task_id", vendorTaskID))

	// 确定轮询响应映射（优先使用专用配置，否则使用通用响应映射）
	pollRespMapping := cc.PollResponseMapping
	if len(pollRespMapping) == 0 {
		pollRespMapping = cc.ResponseMapping
	}

	// 确定轮询方法
	pollMethod := cc.PollMethod
	if pollMethod == "" {
		pollMethod = "GET"
	}

	// 构建轮询URL（支持路径中的变量替换）
	pollPath := cc.PollPath
	pollPath = strings.ReplaceAll(pollPath, "{task_id}", vendorTaskID)
	pollURL := channel.BaseURL + pollPath

	// 构建认证头
	authHeaders := s.buildAuthHeaders(cc, account)

	for i := 0; i < cc.PollMaxAttempts; i++ {
		time.Sleep(time.Duration(cc.PollInterval) * time.Second)

		var resp []byte
		var pollErr error

		if pollMethod == "POST" {
			// 构建轮询参数
			pollParams := map[string]any{"task_id": vendorTaskID}
			if len(cc.PollParamMapping) > 0 {
				pollParams, _ = s.paramMapper.Map(pollParams, cc.PollParamMapping)
			}
			// 轮询认证如果是 body，需要加入参数
			if cc.AuthLocation == "body" {
				authKey := cc.AuthKey
				if authKey == "" {
					authKey = "Authorization"
				}
				pollParams[authKey] = account.APIKey
			}
			detail := httputil.PostWithDetail(ctx, pollURL, pollParams, authHeaders, cc.ContentType)
			s.logRequest(task, model.RequestTypePoll, detail)
			resp = detail.ResponseBody
			pollErr = detail.Error
		} else {
			detail := httputil.GetJSONWithDetail(ctx, pollURL, authHeaders)
			s.logRequest(task, model.RequestTypePoll, detail)
			resp = detail.ResponseBody
			pollErr = detail.Error
		}

		if pollErr != nil {
			logger.Error("poll error", zap.Error(pollErr))
			continue
		}

		var respMap map[string]any
		json.Unmarshal(resp, &respMap)

		result, _ := s.responseMapper.Map(respMap, pollRespMapping)
		status, _ := result["status"].(string)

		// 更新进度
		if progress, ok := result["progress"].(float64); ok {
			model.DB().Model(task).Update("progress", int(progress))
		}

		if status == "success" {
			s.completeTask(task, cc, result)
			return
		} else if status == "failed" {
			errMsg, _ := result["error"].(string)
			s.failTask(task, errMsg)
			return
		}
	}

	s.failTask(task, "poll timeout")
}

// buildAuthHeaders 构建认证头
func (s *CapabilityService) buildAuthHeaders(cc *model.ChannelCapability, account *model.ChannelAccount) map[string]string {
	if cc.AuthLocation != "header" {
		return nil
	}
	authKey := cc.AuthKey
	if authKey == "" {
		authKey = "Authorization"
	}
	authValue := cc.AuthValuePrefix + account.APIKey
	return map[string]string{authKey: authValue}
}

// handleCallbackResult 处理回调结果（提交后等待回调）
func (s *CapabilityService) handleCallbackResult(task *model.Task, cc *model.ChannelCapability, submitResp map[string]any) {
	result, _ := s.responseMapper.Map(submitResp, cc.ResponseMapping)
	vendorTaskID := extractString(result["task_id"])
	model.DB().Model(task).Update("vendor_task_id", vendorTaskID)
	// 等待回调，状态保持 processing
}

// completeTask 完成任务（包含文件转存）
func (s *CapabilityService) completeTask(task *model.Task, cc *model.ChannelCapability, result map[string]any) {
	ctx := context.Background()

	// 尝试转存文件到COS
	if storage.DefaultStorage != nil {
		// 获取结果URL
		var originURL string
		if url, ok := result["image_url"].(string); ok && url != "" {
			originURL = url
		} else if url, ok := result["video_url"].(string); ok && url != "" {
			originURL = url
		} else if url, ok := result["url"].(string); ok && url != "" {
			originURL = url
		}

		if originURL != "" {
			// 下载原始文件
			downloadResult, err := httputil.Download(ctx, originURL)
			if err != nil {
				logger.Error("download file for transfer failed", zap.String("task_no", task.TaskNo), zap.Error(err))
			} else {
				defer downloadResult.Body.Close()

				// 生成存储路径
				storagePath := s.generateStoragePath(task.CapabilityCode, originURL)

				// 上传到COS
				finalURL, err := storage.Upload(ctx, downloadResult.Body, storagePath, downloadResult.ContentType)
				if err != nil {
					logger.Error("upload to storage failed", zap.String("task_no", task.TaskNo), zap.Error(err))
				} else {
					// 更新结果中的URL
					if _, ok := result["image_url"]; ok {
						result["image_url"] = finalURL
					} else if _, ok := result["video_url"]; ok {
						result["video_url"] = finalURL
					} else {
						result["url"] = finalURL
					}
					logger.Info("file transferred to storage", zap.String("task_no", task.TaskNo), zap.String("url", finalURL))
				}
			}
		}
	}

	resultJSON, _ := json.Marshal(result)
	now := time.Now()
	model.DB().Model(task).Updates(map[string]any{
		"status":       model.TaskStatusSuccess,
		"progress":     100,
		"result":       resultJSON,
		"cost":         cc.Price,
		"completed_at": now,
	})

	logger.Info("capability task completed", zap.String("task_no", task.TaskNo))

	// 释放账号并发
	strategyService := NewStrategyService()
	strategyService.DecrementAccountTasks(task.AccountID)

	// 发送回调
	if task.CallbackURL != "" {
		go s.sendCallback(task)
	}
}

// generateStoragePath 生成存储路径
func (s *CapabilityService) generateStoragePath(capabilityCode string, originURL string) string {
	now := time.Now()
	ext := filepath.Ext(originURL)
	if ext == "" || len(ext) > 10 {
		if strings.Contains(capabilityCode, "video") {
			ext = ".mp4"
		} else {
			ext = ".png"
		}
	}
	// 去除ext中可能的查询参数
	if idx := strings.Index(ext, "?"); idx > 0 {
		ext = ext[:idx]
	}
	return fmt.Sprintf("%s/%s/%s%s", capabilityCode, now.Format("2006/01/02"), uuid.New().String(), ext)
}

// failTask 任务失败
func (s *CapabilityService) failTask(task *model.Task, errMsg string) {
	now := time.Now()
	updates := map[string]any{
		"status":        model.TaskStatusFailed,
		"error_message": errMsg,
		"completed_at":  now,
	}

	// 如果有扣费，退回余额
	if task.Cost > 0 {
		result := model.DB().Model(&model.Token{}).Where("id = ?", task.TokenID).Updates(map[string]any{
			"balance":    gorm.Expr("balance + ?", task.Cost),
			"total_used": gorm.Expr("total_used - ?", task.Cost),
		})
		if result.RowsAffected > 0 {
			// 退还用户余额
			model.DB().Model(&model.User{}).Where("id = ?", task.UserID).
				UpdateColumn("balance", gorm.Expr("balance + ?", task.Cost))
			updates["refunded"] = true
			logger.Info("refunded cost for failed task",
				zap.String("task_no", task.TaskNo),
				zap.Float64("cost", task.Cost))
		}
	}

	model.DB().Model(task).Updates(updates)

	logger.Warn("capability task failed", zap.String("task_no", task.TaskNo), zap.String("error", errMsg))

	if task.CallbackURL != "" {
		go s.sendCallback(task)
	}
}

// sendCallback 发送回调给调用方
func (s *CapabilityService) sendCallback(task *model.Task) {
	// 重新查询任务获取最新数据
	model.DB().First(task, task.ID)

	ctx := context.Background()
	payload := map[string]any{
		"task_id": task.TaskNo,
		"status":  task.Status,
	}

	if task.Status == model.TaskStatusSuccess {
		var result map[string]any
		json.Unmarshal(task.Result, &result)
		payload["result"] = result
	}
	if task.ErrorMessage != "" {
		payload["error"] = task.ErrorMessage
	}

	maxAttempts := 3
	for i := 0; i < maxAttempts; i++ {
		detail := httputil.PostJSONWithDetail(ctx, task.CallbackURL, payload, nil)
		s.logRequest(task, model.RequestTypeCallback, detail)
		if detail.Error == nil {
			model.DB().Model(task).Updates(map[string]any{
				"callback_status":   model.CallbackStatusSuccess,
				"callback_attempts": i + 1,
			})
			return
		}
		time.Sleep(time.Duration(i+1) * 5 * time.Second)
	}

	model.DB().Model(task).Updates(map[string]any{
		"callback_status":   model.CallbackStatusFailed,
		"callback_attempts": maxAttempts,
	})
}

// releaseAccount 释放账号
func (s *CapabilityService) releaseAccount(accountID uint) {
	model.DB().Model(&model.ChannelAccount{}).
		Where("id = ? AND current_tasks > 0", accountID).
		UpdateColumn("current_tasks", gorm.Expr("current_tasks - 1"))
}

// GetTask 查询任务
func (s *CapabilityService) GetTask(ctx context.Context, taskNo string, userID uint) (*model.Task, error) {
	var task model.Task
	err := model.DB().Where("task_no = ? AND user_id = ?", taskNo, userID).First(&task).Error
	return &task, err
}

// GetTaskByVendorID 根据供应商任务ID查询
func (s *CapabilityService) GetTaskByVendorID(ctx context.Context, vendorTaskID string) (*model.Task, error) {
	var task model.Task
	err := model.DB().Where("vendor_task_id = ?", vendorTaskID).First(&task).Error
	return &task, err
}

// CancelTask 取消任务
func (s *CapabilityService) CancelTask(ctx context.Context, taskNo string, userID uint) error {
	result := model.DB().Model(&model.Task{}).
		Where("task_no = ? AND user_id = ? AND status IN ?", taskNo, userID,
			[]model.TaskStatus{model.TaskStatusPending, model.TaskStatusProcessing}).
		Update("status", model.TaskStatusCancelled)
	if result.RowsAffected == 0 {
		return fmt.Errorf("task not found or cannot be cancelled")
	}
	return result.Error
}

// HandleCallback 处理供应商回调
func (s *CapabilityService) HandleCallback(ctx context.Context, channelType string, body map[string]any) error {
	// 查找渠道
	var channel model.Channel
	if err := model.DB().Where("type = ?", channelType).First(&channel).Error; err != nil {
		return fmt.Errorf("channel not found: %s", channelType)
	}

	// 查找该渠道下的能力配置
	var ccs []model.ChannelCapability
	model.DB().Where("channel_id = ?", channel.ID).Find(&ccs)

	// 尝试解析回调
	for _, cc := range ccs {
		mappingData := cc.CallbackMapping
		if len(mappingData) == 0 {
			mappingData = cc.ResponseMapping
		}
		if len(mappingData) == 0 {
			continue
		}

		result, _ := s.responseMapper.Map(body, mappingData)
		vendorTaskID, _ := result["task_id"].(string)
		if vendorTaskID == "" {
			continue
		}

		// 查找任务
		task, err := s.GetTaskByVendorID(ctx, vendorTaskID)
		if err != nil {
			continue
		}

		// 更新任务
		status, _ := result["status"].(string)
		if status == "success" {
			s.completeTask(task, &cc, result)
		} else if status == "failed" {
			errMsg, _ := result["error"].(string)
			s.failTask(task, errMsg)
		}
		return nil
	}

	return fmt.Errorf("no matching task found for callback")
}

// extractString 安全地从 any 类型提取字符串
func extractString(v any) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		return fmt.Sprintf("%.0f", val)
	case int:
		return fmt.Sprintf("%d", val)
	case int64:
		return fmt.Sprintf("%d", val)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// logRequest 记录渠道请求日志
func (s *CapabilityService) logRequest(task *model.Task, reqType model.RequestType, detail *httputil.RequestDetail) {
	headersJSON, _ := json.Marshal(detail.RequestHeaders)
	log := &model.ChannelRequestLog{
		TaskID:         task.ID,
		TaskNo:         task.TaskNo,
		ChannelID:      task.ChannelID,
		AccountID:      task.AccountID,
		CapabilityCode: task.CapabilityCode,
		RequestType:    reqType,
		Method:         detail.Method,
		URL:            detail.URL,
		RequestHeaders: string(headersJSON),
		RequestBody:    detail.RequestBody,
		StatusCode:     detail.StatusCode,
		ResponseBody:   string(detail.ResponseBody),
		DurationMs:     detail.DurationMs,
		RequestAt:      time.Now(),
	}
	if detail.Error != nil {
		log.ErrorMessage = detail.Error.Error()
	}
	NewRequestLogService().Log(log)
}
