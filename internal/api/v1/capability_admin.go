package v1

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/model"
	"gorm.io/datatypes"
)

// ListCapabilities 能力列表
func ListCapabilities(c *gin.Context) {
	var capabilities []model.Capability
	query := model.DB().Model(&model.Capability{})

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Order("code ASC").Find(&capabilities).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, capabilities)
}

// GetCapability 获取能力详情
func GetCapability(c *gin.Context) {
	code := c.Param("code")

	var capability model.Capability
	if err := model.DB().Where("code = ?", code).First(&capability).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 404, "capability not found")
		return
	}

	successResponse(c, capability)
}

// CreateCapability 创建能力
func CreateCapability(c *gin.Context) {
	var req struct {
		Code             string         `json:"code" binding:"required"`
		Name             string         `json:"name" binding:"required"`
		Description      string         `json:"description"`
		StandardParams   datatypes.JSON `json:"standard_params"`
		StandardResponse datatypes.JSON `json:"standard_response"`
		Status           int8           `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	capability := &model.Capability{
		Code:             req.Code,
		Name:             req.Name,
		Description:      req.Description,
		StandardParams:   req.StandardParams,
		StandardResponse: req.StandardResponse,
		Status:           req.Status,
	}
	if capability.Status == 0 {
		capability.Status = 1
	}

	if err := model.DB().Create(capability).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, capability)
}

// UpdateCapability 更新能力
func UpdateCapability(c *gin.Context) {
	code := c.Param("code")

	var capability model.Capability
	if err := model.DB().Where("code = ?", code).First(&capability).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 404, "capability not found")
		return
	}

	var req struct {
		Name             string         `json:"name"`
		Description      string         `json:"description"`
		StandardParams   datatypes.JSON `json:"standard_params"`
		StandardResponse datatypes.JSON `json:"standard_response"`
		Status           *int8          `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	updates := map[string]any{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if len(req.StandardParams) > 0 {
		updates["standard_params"] = req.StandardParams
	}
	if len(req.StandardResponse) > 0 {
		updates["standard_response"] = req.StandardResponse
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	if err := model.DB().Model(&capability).Updates(updates).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, capability)
}

// DeleteCapability 删除能力
func DeleteCapability(c *gin.Context) {
	code := c.Param("code")

	result := model.DB().Where("code = ?", code).Delete(&model.Capability{})
	if result.Error != nil {
		errorResponse(c, http.StatusInternalServerError, 500, result.Error.Error())
		return
	}
	if result.RowsAffected == 0 {
		errorResponse(c, http.StatusNotFound, 404, "capability not found")
		return
	}

	successResponse(c, gin.H{"message": "deleted"})
}

// ListChannelCapabilities 渠道能力列表
func ListChannelCapabilities(c *gin.Context) {
	var ccs []model.ChannelCapability
	query := model.DB().Model(&model.ChannelCapability{}).Preload("Channel").Preload("Capability")

	if channelID := c.Query("channel_id"); channelID != "" {
		query = query.Where("channel_id = ?", channelID)
	}
	if capabilityCode := c.Query("capability_code"); capabilityCode != "" {
		query = query.Where("capability_code = ?", capabilityCode)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Order("id DESC").Find(&ccs).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, ccs)
}

// GetChannelCapability 获取渠道能力详情
func GetChannelCapability(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var cc model.ChannelCapability
	if err := model.DB().Preload("Channel").Preload("Capability").First(&cc, id).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 404, "channel capability not found")
		return
	}

	successResponse(c, cc)
}

// CreateChannelCapability 创建渠道能力
func CreateChannelCapability(c *gin.Context) {
	var req struct {
		ChannelID           uint           `json:"channel_id" binding:"required"`
		CapabilityCode      string         `json:"capability_code" binding:"required"`
		Model               string         `json:"model"`
		Name                string         `json:"name"`
		Price               float64        `json:"price"`
		PriceUnit           string         `json:"price_unit"`
		ResultMode          string         `json:"result_mode"`
		RequestPath         string         `json:"request_path"`
		RequestMethod       string         `json:"request_method"`
		ContentType         string         `json:"content_type"`
		AuthLocation        string         `json:"auth_location"`
		AuthKey             string         `json:"auth_key"`
		AuthValuePrefix     string         `json:"auth_value_prefix"`
		PollPath            string         `json:"poll_path"`
		PollMethod          string         `json:"poll_method"`
		PollInterval        int            `json:"poll_interval"`
		PollMaxAttempts     int            `json:"poll_max_attempts"`
		PollParamMapping    datatypes.JSON `json:"poll_param_mapping"`
		PollResponseMapping datatypes.JSON `json:"poll_response_mapping"`
		ParamMapping        datatypes.JSON `json:"param_mapping"`
		ResponseMapping     datatypes.JSON `json:"response_mapping"`
		CallbackMapping     datatypes.JSON `json:"callback_mapping"`
		ExtraConfig         datatypes.JSON `json:"extra_config"`
		Status              int8           `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	cc := &model.ChannelCapability{
		ChannelID:           req.ChannelID,
		CapabilityCode:      req.CapabilityCode,
		Model:               req.Model,
		Name:                req.Name,
		Price:               req.Price,
		PriceUnit:           req.PriceUnit,
		ResultMode:          req.ResultMode,
		RequestPath:         req.RequestPath,
		RequestMethod:       req.RequestMethod,
		ContentType:         req.ContentType,
		AuthLocation:        req.AuthLocation,
		AuthKey:             req.AuthKey,
		AuthValuePrefix:     req.AuthValuePrefix,
		PollPath:            req.PollPath,
		PollMethod:          req.PollMethod,
		PollInterval:        req.PollInterval,
		PollMaxAttempts:     req.PollMaxAttempts,
		PollParamMapping:    req.PollParamMapping,
		PollResponseMapping: req.PollResponseMapping,
		ParamMapping:        req.ParamMapping,
		ResponseMapping:     req.ResponseMapping,
		CallbackMapping:     req.CallbackMapping,
		ExtraConfig:         req.ExtraConfig,
		Status:              req.Status,
	}

	// 设置默认值
	if cc.Status == 0 {
		cc.Status = 1
	}
	if cc.ResultMode == "" {
		cc.ResultMode = model.ResultModePoll
	}
	if cc.RequestMethod == "" {
		cc.RequestMethod = "POST"
	}
	if cc.ContentType == "" {
		cc.ContentType = "application/json"
	}
	if cc.AuthLocation == "" {
		cc.AuthLocation = "header"
	}
	if cc.AuthKey == "" {
		cc.AuthKey = "Authorization"
	}
	if cc.AuthValuePrefix == "" {
		cc.AuthValuePrefix = "Bearer "
	}
	if cc.PollMethod == "" {
		cc.PollMethod = "GET"
	}
	if cc.PollInterval == 0 {
		cc.PollInterval = 5
	}
	if cc.PollMaxAttempts == 0 {
		cc.PollMaxAttempts = 60
	}

	if err := model.DB().Create(cc).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	successResponse(c, cc)
}

// UpdateChannelCapability 更新渠道能力
func UpdateChannelCapability(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var cc model.ChannelCapability
	if err := model.DB().First(&cc, id).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 404, "channel capability not found")
		return
	}

	var req map[string]any
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	// 移除不可更新字段
	delete(req, "id")
	delete(req, "created_at")
	delete(req, "updated_at")

	// JSON 字段需要序列化为 []byte，GORM 不能直接处理 map[string]any
	jsonFields := []string{"param_mapping", "response_mapping", "callback_mapping", "extra_config", "poll_param_mapping", "poll_response_mapping"}
	for _, field := range jsonFields {
		if v, ok := req[field]; ok {
			// 处理 nil 和空值，确保能清空字段
			if v == nil {
				req[field] = datatypes.JSON([]byte("{}"))
			} else {
				b, err := json.Marshal(v)
				if err != nil {
					errorResponse(c, http.StatusBadRequest, 400, "invalid "+field)
					return
				}
				req[field] = datatypes.JSON(b)
			}
		}
	}

	if err := model.DB().Model(&cc).Updates(req).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	// 重新查询更新后的数据
	model.DB().First(&cc, id)
	successResponse(c, cc)
}

// DeleteChannelCapability 删除渠道能力
func DeleteChannelCapability(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	result := model.DB().Delete(&model.ChannelCapability{}, id)
	if result.Error != nil {
		errorResponse(c, http.StatusInternalServerError, 500, result.Error.Error())
		return
	}
	if result.RowsAffected == 0 {
		errorResponse(c, http.StatusNotFound, 404, "channel capability not found")
		return
	}

	successResponse(c, gin.H{"message": "deleted"})
}
