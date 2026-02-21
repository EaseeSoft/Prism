package v1

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/api/middleware"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/internal/service"
	perrors "github.com/majingzhen/prism/pkg/errors"
)

var capabilityService = service.NewCapabilityService()

// ListAvailableChannels 列出所有可用渠道
func ListAvailableChannels(c *gin.Context) {
	var channels []model.Channel
	if err := model.DB().Where("status = ?", 1).Find(&channels).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get channels")
		return
	}

	result := make([]string, 0, len(channels))
	for _, ch := range channels {
		result = append(result, ch.Type)
	}

	successResponse(c, result)
}

// ListAvailableCapabilities 列出可用能力（返回能力及其支持的渠道）
func ListAvailableCapabilities(c *gin.Context) {
	channelType := c.Query("channel")
	capabilityType := c.Query("type")

	// 查询所有启用的能力
	query := model.DB().Where("status = ?", 1)
	if capabilityType != "" {
		query = query.Where("type = ?", capabilityType)
	}

	var capabilities []model.Capability
	if err := query.Find(&capabilities).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get capabilities")
		return
	}

	// 获取所有启用的渠道
	var channels []model.Channel
	if err := model.DB().Where("status = ?", 1).Find(&channels).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get channels")
		return
	}
	channelMap := make(map[uint]model.Channel)
	for _, ch := range channels {
		channelMap[ch.ID] = ch
	}

	// 查询所有渠道能力配置
	var channelCaps []model.ChannelCapability
	ccQuery := model.DB().Where("status = ?", 1)
	if channelType != "" {
		// 如果指定了渠道，先查找渠道ID
		var channel model.Channel
		if err := model.DB().Where("type = ? AND status = ?", channelType, 1).First(&channel).Error; err != nil {
			errorResponse(c, http.StatusNotFound, 404, "channel not found")
			return
		}
		ccQuery = ccQuery.Where("channel_id = ?", channel.ID)
	}
	if err := ccQuery.Find(&channelCaps).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get channel capabilities")
		return
	}

	// 构建能力->渠道映射（包含渠道详细信息）
	capChannels := make(map[string][]gin.H)
	for _, cc := range channelCaps {
		if ch, ok := channelMap[cc.ChannelID]; ok {
			capChannels[cc.CapabilityCode] = append(capChannels[cc.CapabilityCode], gin.H{
				"channel_type": ch.Type,
				"channel_name": ch.Name,
				"model":        cc.Model,
				"price":        cc.Price,
			})
		}
	}

	// 构建响应
	result := make([]gin.H, 0, len(capabilities))
	for _, cap := range capabilities {
		channels := capChannels[cap.Code]
		// 如果指定了渠道筛选，跳过没有配置的能力
		if channelType != "" && len(channels) == 0 {
			continue
		}
		if channels == nil {
			channels = []gin.H{}
		}
		result = append(result, gin.H{
			"code":        cap.Code,
			"name":        cap.Name,
			"type":        cap.Type,
			"description": cap.Description,
			"channels":    channels,
		})
	}

	successResponse(c, result)
}

// InvokeCapability 调用能力接口
func InvokeCapability(c *gin.Context) {
	capability := c.Param("capability")
	if capability == "" {
		errorResponse(c, http.StatusBadRequest, 400, "capability is required")
		return
	}

	var params map[string]any
	if err := c.ShouldBindJSON(&params); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, "invalid request body")
		return
	}

	// 从参数中提取可选字段
	channel, _ := params["channel"].(string)
	model, _ := params["model"].(string)
	callbackURL, _ := params["callback_url"].(string)

	// 移除非业务参数
	delete(params, "channel")
	delete(params, "model")
	delete(params, "callback_url")

	token := middleware.GetToken(c)
	if token == nil {
		errorResponse(c, http.StatusUnauthorized, 401, "unauthorized")
		return
	}

	req := &service.InvokeRequest{
		UserID:      token.UserID,
		TokenID:     token.ID,
		Capability:  capability,
		Channel:     channel,
		Model:       model,
		CallbackURL: callbackURL,
		Params:      params,
	}

	resp, err := capabilityService.Invoke(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInsufficientTokenBalance) || errors.Is(err, service.ErrInsufficientUserBalance) {
			badRequest(c, perrors.WithMessage(perrors.ErrInsufficientQuota, err.Error()))
			return
		}
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, resp)
}

// GetTaskByNo 查询任务
func GetTaskByNo(c *gin.Context) {
	taskNo := c.Param("task_no")
	token := middleware.GetToken(c)
	if token == nil {
		errorResponse(c, http.StatusUnauthorized, 401, "unauthorized")
		return
	}

	task, err := capabilityService.GetTask(c.Request.Context(), taskNo, token.UserID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, 404, "task not found")
		return
	}

	successResponse(c, gin.H{
		"task_id":  task.TaskNo,
		"status":   task.Status,
		"progress": task.Progress,
		"result":   task.Result,
		"error":    task.ErrorMessage,
		"cost":     task.Cost,
	})
}

// CancelTask 取消任务
func CancelTask(c *gin.Context) {
	taskNo := c.Param("task_no")
	token := middleware.GetToken(c)
	if token == nil {
		errorResponse(c, http.StatusUnauthorized, 401, "unauthorized")
		return
	}

	err := capabilityService.CancelTask(c.Request.Context(), taskNo, token.UserID)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	successResponse(c, gin.H{"message": "task cancelled"})
}

// HandleCapabilityCallback 处理供应商回调
func HandleCapabilityCallback(c *gin.Context) {
	channelType := c.Param("channel_type")

	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, "invalid request body")
		return
	}

	err := capabilityService.HandleCallback(c.Request.Context(), channelType, body)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	successResponse(c, gin.H{"message": "ok"})
}

// ListCapabilityChannels 返回每个能力可用的渠道列表（用户级API）
func ListCapabilityChannels(c *gin.Context) {
	// 查询所有启用的能力
	var capabilities []model.Capability
	if err := model.DB().Where("status = ?", 1).Find(&capabilities).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get capabilities")
		return
	}

	// 查询所有启用的渠道
	var channels []model.Channel
	if err := model.DB().Where("status = ?", 1).Find(&channels).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get channels")
		return
	}
	channelMap := make(map[uint]model.Channel)
	for _, ch := range channels {
		channelMap[ch.ID] = ch
	}

	// 查询所有启用的渠道能力配置
	var channelCaps []model.ChannelCapability
	if err := model.DB().Where("status = ?", 1).Find(&channelCaps).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get channel capabilities")
		return
	}

	// 按能力分组渠道
	capChannels := make(map[string][]gin.H)
	for _, cc := range channelCaps {
		ch, ok := channelMap[cc.ChannelID]
		if !ok {
			continue
		}
		capChannels[cc.CapabilityCode] = append(capChannels[cc.CapabilityCode], gin.H{
			"channel_id":   ch.ID,
			"channel_type": ch.Type,
			"channel_name": ch.Name,
			"model":        cc.Model,
			"price":        cc.Price,
		})
	}

	// 构建响应
	result := make([]gin.H, 0, len(capabilities))
	for _, cap := range capabilities {
		channels := capChannels[cap.Code]
		if len(channels) == 0 {
			channels = []gin.H{}
		}
		result = append(result, gin.H{
			"code":        cap.Code,
			"name":        cap.Name,
			"type":        cap.Type,
			"description": cap.Description,
			"channels":    channels,
		})
	}

	successResponse(c, result)
}

// ListChatModelChannelsForToken 返回每个 Chat 模型可用的渠道列表（用于令牌渠道优先级配置）
func ListChatModelChannelsForToken(c *gin.Context) {
	// 查询所有启用的 Chat 模型
	var chatModels []model.ChatModel
	if err := model.DB().Where("status = ?", 1).Find(&chatModels).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get chat models")
		return
	}

	// 查询所有启用的渠道
	var channels []model.Channel
	if err := model.DB().Where("status = ?", 1).Find(&channels).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get channels")
		return
	}
	channelMap := make(map[uint]model.Channel)
	for _, ch := range channels {
		channelMap[ch.ID] = ch
	}

	// 查询所有启用的模型渠道映射
	var modelChannels []model.ChatModelChannel
	if err := model.DB().Where("status = ?", 1).Find(&modelChannels).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, "failed to get model channels")
		return
	}

	// 按模型分组渠道
	modelChannelMap := make(map[string][]gin.H)
	for _, mc := range modelChannels {
		ch, ok := channelMap[mc.ChannelID]
		if !ok {
			continue
		}
		modelChannelMap[mc.ModelCode] = append(modelChannelMap[mc.ModelCode], gin.H{
			"channel_id":   ch.ID,
			"channel_type": ch.Type,
			"channel_name": ch.Name,
			"model":        mc.VendorModel,
			"price":        mc.InputPrice,
		})
	}

	// 构建响应
	result := make([]gin.H, 0, len(chatModels))
	for _, m := range chatModels {
		channels := modelChannelMap[m.Code]
		if len(channels) == 0 {
			channels = []gin.H{}
		}
		result = append(result, gin.H{
			"code":        "chat:" + m.Code,
			"name":        m.Name + " (Chat)",
			"type":        "chat",
			"description": m.Description,
			"channels":    channels,
		})
	}

	successResponse(c, result)
}
