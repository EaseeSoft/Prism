package v1

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/api/middleware"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/errors"
	"gorm.io/gorm"
)

type CreateTokenRequest struct {
	Name    string  `json:"name" binding:"required,max=50"`
	Balance float64 `json:"balance"`
}

func ListMyTokens(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var tokens []model.Token
	if err := model.DB().Model(&model.Token{}).Where("user_id = ?", userID).Find(&tokens).Error; err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	result := make([]gin.H, len(tokens))
	for i, t := range tokens {
		result[i] = gin.H{
			"id":         t.ID,
			"name":       t.Name,
			"key":        t.Key,
			"balance":    t.Balance,
			"total_used": t.TotalUsed,
			"rate_limit": t.RateLimit,
			"status":     t.Status,
			"created_at": t.CreatedAt,
		}
	}

	successResponse(c, result)
}

func CreateToken(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	key := generateAPIKey()

	token := &model.Token{
		UserID:    userID,
		Name:      req.Name,
		Key:       key,
		Balance:   req.Balance,
		RateLimit: 60,
		Status:    1,
	}

	if err := model.DB().Model(&model.Token{}).Create(token).Error; err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{
		"id":      token.ID,
		"name":    token.Name,
		"key":     key,
		"balance": token.Balance,
	})
}

func DeleteToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tokenID := c.Param("id")

	var id uint
	if _, err := fmt.Sscanf(tokenID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid token id"))
		return
	}

	result := model.DB().Model(&model.Token{}).Where("id = ? AND user_id = ?", id, userID).Delete(&model.Token{})
	if result.Error != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	if result.RowsAffected == 0 {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	successResponse(c, gin.H{"deleted": true})
}

type RechargeTokenRequest struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
}

func RechargeToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tokenID := c.Param("id")

	var id uint
	if _, err := fmt.Sscanf(tokenID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid token id"))
		return
	}

	var req RechargeTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	result := model.DB().Model(&model.Token{}).
		Where("id = ? AND user_id = ?", id, userID).
		UpdateColumn("balance", gorm.Expr("balance + ?", req.Amount))

	if result.Error != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	if result.RowsAffected == 0 {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	var token model.Token
	model.DB().First(&token, id)

	successResponse(c, gin.H{
		"id":      token.ID,
		"balance": token.Balance,
	})
}

func generateAPIKey() string {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return "sk-prism-" + hex.EncodeToString(bytes)
}

// ChannelPriorityItem 渠道优先级项
type ChannelPriorityItem struct {
	ChannelID   uint   `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	ChannelType string `json:"channel_type"`
	Priority    int    `json:"priority"`
}

// CapabilityPriorityResponse 能力渠道优先级响应
type CapabilityPriorityResponse struct {
	CapabilityCode string                `json:"capability_code"`
	CapabilityName string                `json:"capability_name"`
	Channels       []ChannelPriorityItem `json:"channels"`
}

// GetTokenChannelPriorities 获取令牌的能力渠道优先级配置
func GetTokenChannelPriorities(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tokenID := c.Param("id")

	var id uint
	if _, err := fmt.Sscanf(tokenID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid token id"))
		return
	}

	// 验证令牌归属
	var token model.Token
	if err := model.DB().Where("id = ? AND user_id = ?", id, userID).First(&token).Error; err != nil {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	// 获取所有启用的能力
	var capabilities []model.Capability
	model.DB().Where("status = 1").Find(&capabilities)

	// 获取该令牌的所有优先级配置
	var priorities []model.TokenChannelPriority
	model.DB().Where("token_id = ?", id).Order("priority ASC").Find(&priorities)

	// 按能力分组
	priorityMap := make(map[string][]model.TokenChannelPriority)
	for _, p := range priorities {
		priorityMap[p.CapabilityCode] = append(priorityMap[p.CapabilityCode], p)
	}

	// 获取所有渠道信息
	channelMap := make(map[uint]model.Channel)
	var channels []model.Channel
	model.DB().Where("status = 1").Find(&channels)
	for _, ch := range channels {
		channelMap[ch.ID] = ch
	}

	// 构建响应
	result := make([]CapabilityPriorityResponse, 0, len(capabilities))
	for _, cap := range capabilities {
		item := CapabilityPriorityResponse{
			CapabilityCode: cap.Code,
			CapabilityName: cap.Name,
			Channels:       make([]ChannelPriorityItem, 0),
		}

		// 添加已配置的渠道
		if pList, ok := priorityMap[cap.Code]; ok {
			for _, p := range pList {
				if ch, exists := channelMap[p.ChannelID]; exists {
					item.Channels = append(item.Channels, ChannelPriorityItem{
						ChannelID:   p.ChannelID,
						ChannelName: ch.Name,
						ChannelType: ch.Type,
						Priority:    p.Priority,
					})
				}
			}
		}

		result = append(result, item)
	}

	successResponse(c, result)
}

// SaveTokenChannelPrioritiesRequest 保存令牌渠道优先级请求
type SaveTokenChannelPrioritiesRequest struct {
	CapabilityCode    string `json:"capability_code" binding:"required"`
	ChannelPriorities []struct {
		ChannelID uint `json:"channel_id" binding:"required"`
		Priority  int  `json:"priority" binding:"required,min=1"`
	} `json:"channel_priorities" binding:"required"`
}

// SaveTokenChannelPriorities 批量保存令牌的能力渠道优先级配置
func SaveTokenChannelPriorities(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tokenID := c.Param("id")

	var id uint
	if _, err := fmt.Sscanf(tokenID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid token id"))
		return
	}

	// 验证令牌归属
	var token model.Token
	if err := model.DB().Where("id = ? AND user_id = ?", id, userID).First(&token).Error; err != nil {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	var req SaveTokenChannelPrioritiesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	// 开启事务
	tx := model.DB().Begin()

	// 删除该令牌该能力的所有旧配置
	if err := tx.Where("token_id = ? AND capability_code = ?", id, req.CapabilityCode).
		Delete(&model.TokenChannelPriority{}).Error; err != nil {
		tx.Rollback()
		internalError(c, errors.ErrInternalError)
		return
	}

	// 批量插入新配置
	for _, cp := range req.ChannelPriorities {
		priority := &model.TokenChannelPriority{
			TokenID:        id,
			CapabilityCode: req.CapabilityCode,
			ChannelID:      cp.ChannelID,
			Priority:       cp.Priority,
		}
		if err := tx.Create(priority).Error; err != nil {
			tx.Rollback()
			internalError(c, errors.ErrInternalError)
			return
		}
	}

	tx.Commit()
	successResponse(c, gin.H{"saved": true})
}

// GetCapabilityChannels 获取某个能力支持的所有渠道
func GetCapabilityChannels(c *gin.Context) {
	capabilityCode := c.Query("code")
	if capabilityCode == "" {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "capability code is required"))
		return
	}

	// 查询支持该能力的渠道能力配置
	var channelCapabilities []model.ChannelCapability
	model.DB().Where("capability_code = ? AND status = 1", capabilityCode).Find(&channelCapabilities)

	// 获取渠道ID列表
	channelIDs := make([]uint, 0, len(channelCapabilities))
	for _, cc := range channelCapabilities {
		channelIDs = append(channelIDs, cc.ChannelID)
	}

	// 查询渠道信息
	var channels []model.Channel
	if len(channelIDs) > 0 {
		model.DB().Where("id IN ? AND status = 1", channelIDs).Find(&channels)
	}

	result := make([]gin.H, 0, len(channels))
	for _, ch := range channels {
		result = append(result, gin.H{
			"id":   ch.ID,
			"type": ch.Type,
			"name": ch.Name,
		})
	}

	successResponse(c, result)
}
