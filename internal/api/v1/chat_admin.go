package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/model"
)

// ========== ChatModel CRUD ==========

// ListChatModels GET /api/admin/chat-models
func ListChatModels(c *gin.Context) {
	var models []model.ChatModel
	model.DB().Order("id ASC").Find(&models)
	successResponse(c, models)
}

// GetChatModel GET /api/admin/chat-models/:code
func GetChatModel(c *gin.Context) {
	code := c.Param("code")
	var chatModel model.ChatModel
	if err := model.DB().Where("code = ?", code).First(&chatModel).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 404, "model not found")
		return
	}
	successResponse(c, chatModel)
}

// CreateChatModel POST /api/admin/chat-models
func CreateChatModel(c *gin.Context) {
	var req struct {
		Code        string `json:"code" binding:"required,max=50"`
		Name        string `json:"name" binding:"required,max=100"`
		Provider    string `json:"provider" binding:"required,max=30"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	chatModel := model.ChatModel{
		Code:        req.Code,
		Name:        req.Name,
		Provider:    req.Provider,
		Description: req.Description,
		Status:      1,
	}

	if err := model.DB().Create(&chatModel).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, chatModel)
}

// UpdateChatModel PUT /api/admin/chat-models/:code
func UpdateChatModel(c *gin.Context) {
	code := c.Param("code")

	var req struct {
		Name        string `json:"name"`
		Provider    string `json:"provider"`
		Description string `json:"description"`
		Status      *int8  `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	updates := make(map[string]any)
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Provider != "" {
		updates["provider"] = req.Provider
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	result := model.DB().Model(&model.ChatModel{}).Where("code = ?", code).Updates(updates)
	if result.RowsAffected == 0 {
		errorResponse(c, http.StatusNotFound, 404, "model not found")
		return
	}

	successResponse(c, nil)
}

// DeleteChatModel DELETE /api/admin/chat-models/:code
func DeleteChatModel(c *gin.Context) {
	code := c.Param("code")
	result := model.DB().Where("code = ?", code).Delete(&model.ChatModel{})
	if result.RowsAffected == 0 {
		errorResponse(c, http.StatusNotFound, 404, "model not found")
		return
	}
	successResponse(c, nil)
}

// ========== ChatModelChannel CRUD ==========

// ListChatModelChannels GET /api/admin/chat-model-channels
func ListChatModelChannels(c *gin.Context) {
	modelCode := c.Query("model_code")
	channelID := c.Query("channel_id")

	query := model.DB().Model(&model.ChatModelChannel{})
	if modelCode != "" {
		query = query.Where("model_code = ?", modelCode)
	}
	if channelID != "" {
		query = query.Where("channel_id = ?", channelID)
	}

	var channels []model.ChatModelChannel
	query.Preload("ChatModel").Preload("Channel").Order("model_code, priority DESC").Find(&channels)
	successResponse(c, channels)
}

// GetChatModelChannel GET /api/admin/chat-model-channels/:id
func GetChatModelChannel(c *gin.Context) {
	id := c.Param("id")
	var mc model.ChatModelChannel
	if err := model.DB().Preload("ChatModel").Preload("Channel").First(&mc, id).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 404, "model channel not found")
		return
	}
	successResponse(c, mc)
}

// CreateChatModelChannel POST /api/admin/chat-model-channels
func CreateChatModelChannel(c *gin.Context) {
	var req struct {
		ModelCode   string  `json:"model_code" binding:"required"`
		ChannelID   uint    `json:"channel_id" binding:"required"`
		VendorModel string  `json:"vendor_model" binding:"required"`
		Priority    int     `json:"priority"`
		PriceMode   string  `json:"price_mode"`
		InputPrice  float64 `json:"input_price"`
		OutputPrice float64 `json:"output_price"`
		RequestPath string  `json:"request_path"`
		Timeout     int     `json:"timeout"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	mc := model.ChatModelChannel{
		ModelCode:   req.ModelCode,
		ChannelID:   req.ChannelID,
		VendorModel: req.VendorModel,
		Priority:    req.Priority,
		PriceMode:   req.PriceMode,
		InputPrice:  req.InputPrice,
		OutputPrice: req.OutputPrice,
		RequestPath: req.RequestPath,
		Timeout:     req.Timeout,
		Status:      1,
	}

	if mc.PriceMode == "" {
		mc.PriceMode = "token"
	}
	if mc.RequestPath == "" {
		mc.RequestPath = "/v1/chat/completions"
	}
	if mc.Timeout == 0 {
		mc.Timeout = 120
	}

	if err := model.DB().Create(&mc).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, mc)
}

// UpdateChatModelChannel PUT /api/admin/chat-model-channels/:id
func UpdateChatModelChannel(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		VendorModel string   `json:"vendor_model"`
		Priority    *int     `json:"priority"`
		PriceMode   string   `json:"price_mode"`
		InputPrice  *float64 `json:"input_price"`
		OutputPrice *float64 `json:"output_price"`
		RequestPath string   `json:"request_path"`
		Timeout     *int     `json:"timeout"`
		Status      *int8    `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	updates := make(map[string]any)
	if req.VendorModel != "" {
		updates["vendor_model"] = req.VendorModel
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.PriceMode != "" {
		updates["price_mode"] = req.PriceMode
	}
	if req.InputPrice != nil {
		updates["input_price"] = *req.InputPrice
	}
	if req.OutputPrice != nil {
		updates["output_price"] = *req.OutputPrice
	}
	if req.RequestPath != "" {
		updates["request_path"] = req.RequestPath
	}
	if req.Timeout != nil {
		updates["timeout"] = *req.Timeout
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	result := model.DB().Model(&model.ChatModelChannel{}).Where("id = ?", id).Updates(updates)
	if result.RowsAffected == 0 {
		errorResponse(c, http.StatusNotFound, 404, "model channel not found")
		return
	}

	successResponse(c, nil)
}

// DeleteChatModelChannel DELETE /api/admin/chat-model-channels/:id
func DeleteChatModelChannel(c *gin.Context) {
	id := c.Param("id")
	result := model.DB().Delete(&model.ChatModelChannel{}, id)
	if result.RowsAffected == 0 {
		errorResponse(c, http.StatusNotFound, 404, "model channel not found")
		return
	}
	successResponse(c, nil)
}
