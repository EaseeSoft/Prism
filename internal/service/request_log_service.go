package service

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

type RequestLogService struct{}

func NewRequestLogService() *RequestLogService {
	return &RequestLogService{}
}

// Log 异步写入请求日志
func (s *RequestLogService) Log(log *model.ChannelRequestLog) {
	go func() {
		if err := model.DB().Create(log).Error; err != nil {
			logger.Error("save request log failed", zap.Error(err))
		}
	}()
}

// ListRequestLogsRequest 查询请求日志参数
type ListRequestLogsRequest struct {
	Page           int    `form:"page"`
	PageSize       int    `form:"page_size"`
	ChannelID      uint   `form:"channel_id"`
	CapabilityCode string `form:"capability_code"`
	RequestType    string `form:"request_type"`
	TaskNo         string `form:"task_no"`
	ConversationID uint   `form:"conversation_id"`
	StartDate      string `form:"start_date"`
	EndDate        string `form:"end_date"`
}

// ListRequestLogsResponse 查询请求日志响应
type ListRequestLogsResponse struct {
	Items    []model.ChannelRequestLog `json:"items"`
	Total    int64                     `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"page_size"`
}

// ListRequestLogs 查询请求日志
func (s *RequestLogService) ListRequestLogs(req *ListRequestLogsRequest) (*ListRequestLogsResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}

	query := model.DB().Model(&model.ChannelRequestLog{})

	// 筛选条件
	if req.ChannelID > 0 {
		query = query.Where("channel_id = ?", req.ChannelID)
	}
	if req.CapabilityCode != "" {
		query = query.Where("capability_code = ?", req.CapabilityCode)
	}
	if req.RequestType != "" {
		query = query.Where("request_type = ?", req.RequestType)
	}
	if req.TaskNo != "" {
		query = query.Where("task_no LIKE ?", "%"+req.TaskNo+"%")
	}
	if req.ConversationID > 0 {
		query = query.Where("conversation_id = ?", req.ConversationID)
	}
	if req.StartDate != "" {
		query = query.Where("request_at >= ?", req.StartDate+" 00:00:00")
	}
	if req.EndDate != "" {
		query = query.Where("request_at <= ?", req.EndDate+" 23:59:59")
	}

	// 总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询
	var items []model.ChannelRequestLog
	offset := (req.Page - 1) * req.PageSize
	if err := query.Preload("Channel").Preload("Capability").
		Order("id DESC").
		Offset(offset).Limit(req.PageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	return &ListRequestLogsResponse{
		Items:    items,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetRequestLog 获取单个请求日志详情
func (s *RequestLogService) GetRequestLog(id uint) (*model.ChannelRequestLog, error) {
	var log model.ChannelRequestLog
	if err := model.DB().Preload("Channel").Preload("Capability").First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

// RetryRequest 重试请求日志中的 HTTP 请求
func (s *RequestLogService) RetryRequest(id uint) (*model.ChannelRequestLog, error) {
	original, err := s.GetRequestLog(id)
	if err != nil {
		return nil, err
	}

	// 查询渠道账号获取最新 APIKey
	var account model.ChannelAccount
	if original.AccountID > 0 {
		if err := model.DB().First(&account, original.AccountID).Error; err != nil {
			return nil, errors.New("渠道账号不存在或已删除")
		}
	}

	// 获取认证配置
	authLocation, authKey, authValuePrefix := s.resolveAuthConfig(original)

	// 还原原始请求头（排除旧的认证头）
	headers := make(map[string]string)
	if original.RequestHeaders != "" {
		json.Unmarshal([]byte(original.RequestHeaders), &headers)
	}

	// 用最新的 APIKey 重新填充认证信息
	reqURL := original.URL
	requestBody := original.RequestBody
	if account.APIKey != "" {
		authValue := authValuePrefix + account.APIKey
		switch authLocation {
		case "header":
			headers[authKey] = authValue
		case "query":
			sep := "?"
			if strings.Contains(reqURL, "?") {
				sep = "&"
			}
			reqURL = reqURL + sep + url.QueryEscape(authKey) + "=" + url.QueryEscape(account.APIKey)
		case "body":
			// 将认证信息注入到请求体 JSON 中
			var bodyMap map[string]any
			if json.Unmarshal([]byte(requestBody), &bodyMap) == nil {
				bodyMap[authKey] = authValue
				if bodyBytes, err := json.Marshal(bodyMap); err == nil {
					requestBody = string(bodyBytes)
				}
			}
		}
	}

	// 序列化新的请求头用于日志记录
	headersJSON, _ := json.Marshal(headers)

	// 构建 HTTP 请求
	var bodyReader io.Reader
	if requestBody != "" {
		bodyReader = strings.NewReader(requestBody)
	}

	req, err := http.NewRequest(original.Method, reqURL, bodyReader)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	// 发送请求
	start := time.Now()
	client := &http.Client{Timeout: 120 * time.Second}
	resp, httpErr := client.Do(req)
	duration := time.Since(start).Milliseconds()

	// 构建新的日志记录
	newLog := &model.ChannelRequestLog{
		TaskID:         original.TaskID,
		TaskNo:         original.TaskNo,
		ConversationID: original.ConversationID,
		ChannelID:      original.ChannelID,
		AccountID:      original.AccountID,
		CapabilityCode: original.CapabilityCode,
		RequestType:    original.RequestType,
		Method:         original.Method,
		URL:            reqURL,
		RequestHeaders: string(headersJSON),
		RequestBody:    requestBody,
		DurationMs:     duration,
		RequestAt:      start,
	}

	if httpErr != nil {
		newLog.ErrorMessage = httpErr.Error()
	} else {
		defer resp.Body.Close()
		newLog.StatusCode = resp.StatusCode
		respBody, _ := io.ReadAll(resp.Body)
		newLog.ResponseBody = string(respBody)
	}

	if err := model.DB().Create(newLog).Error; err != nil {
		logger.Error("save retry request log failed", zap.Error(err))
		return nil, err
	}

	return s.GetRequestLog(newLog.ID)
}

// resolveAuthConfig 根据请求类型解析认证配置
func (s *RequestLogService) resolveAuthConfig(log *model.ChannelRequestLog) (location, key, valuePrefix string) {
	// Chat 请求默认使用 Bearer Token
	if log.RequestType == model.RequestTypeChat {
		return "header", "Authorization", "Bearer "
	}

	// 能力请求从 ChannelCapability 读取认证配置
	if log.ChannelID > 0 && log.CapabilityCode != "" {
		var cc model.ChannelCapability
		err := model.DB().
			Where("channel_id = ? AND capability_code = ?", log.ChannelID, log.CapabilityCode).
			First(&cc).Error
		if err == nil {
			loc := cc.AuthLocation
			if loc == "" {
				loc = "header"
			}
			k := cc.AuthKey
			if k == "" {
				k = "Authorization"
			}
			return loc, k, cc.AuthValuePrefix
		}
	}

	// 默认 Bearer Header 认证
	return "header", "Authorization", "Bearer "
}
