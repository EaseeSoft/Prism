package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/model"
)

// PricingCapability 价格展示用的能力信息
type PricingCapability struct {
	Code        string                `json:"code"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Channels    []PricingChannelModel `json:"channels"`
}

// PricingChannelModel 价格展示用的渠道模型信息
type PricingChannelModel struct {
	ChannelCode string  `json:"channel_code"`
	Model       string  `json:"model"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	PriceUnit   string  `json:"price_unit"`
}

// GetPricing 获取公开的价格列表
func GetPricing(c *gin.Context) {
	// 查询所有启用的能力
	var capabilities []model.Capability
	if err := model.DB().Where("status = ?", 1).Order("code ASC").Find(&capabilities).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	// 查询所有启用的渠道能力配置，预加载渠道信息
	var channelCapabilities []model.ChannelCapability
	if err := model.DB().
		Where("status = ?", 1).
		Preload("Channel").
		Find(&channelCapabilities).Error; err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	// 按能力分组渠道配置
	ccMap := make(map[string][]PricingChannelModel)
	for _, cc := range channelCapabilities {
		if cc.Channel == nil || cc.Channel.Status != 1 {
			continue
		}
		ccMap[cc.CapabilityCode] = append(ccMap[cc.CapabilityCode], PricingChannelModel{
			ChannelCode: cc.Channel.Type,
			Model:       cc.Model,
			Name:        cc.Name,
			Price:       cc.Price,
			PriceUnit:   cc.PriceUnit,
		})
	}

	// 组装返回数据
	result := make([]PricingCapability, 0, len(capabilities))
	for _, cap := range capabilities {
		channels := ccMap[cap.Code]
		if channels == nil {
			channels = []PricingChannelModel{}
		}
		result = append(result, PricingCapability{
			Code:        cap.Code,
			Name:        cap.Name,
			Description: cap.Description,
			Channels:    channels,
		})
	}

	successResponse(c, result)
}
