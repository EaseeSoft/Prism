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
	Name              string                 `json:"name" binding:"required,max=50"`
	Balance           float64                `json:"balance"`
	ChannelPriorities []ChannelPriorityInput `json:"channel_priorities"`
}

type ChannelPriorityInput struct {
	CapabilityCode string `json:"capability_code"`
	ChannelID      uint   `json:"channel_id"`
	Priority       int    `json:"priority"`
}

type UpdateTokenRequest struct {
	Name              string                 `json:"name" binding:"max=50"`
	ChannelPriorities []ChannelPriorityInput `json:"channel_priorities"`
}

func ListMyTokens(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var tokens []model.Token
	if err := model.DB().Model(&model.Token{}).Where("user_id = ?", userID).Find(&tokens).Error; err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	// 查询所有令牌的渠道优先级配置
	tokenIDs := make([]uint, len(tokens))
	for i, t := range tokens {
		tokenIDs[i] = t.ID
	}

	var priorities []model.TokenChannelPriority
	if len(tokenIDs) > 0 {
		model.DB().Where("token_id IN ?", tokenIDs).Order("priority ASC").Find(&priorities)
	}

	// 按令牌ID分组
	priorityMap := make(map[uint][]gin.H)
	for _, p := range priorities {
		priorityMap[p.TokenID] = append(priorityMap[p.TokenID], gin.H{
			"capability_code": p.CapabilityCode,
			"channel_id":      p.ChannelID,
			"priority":        p.Priority,
		})
	}

	result := make([]gin.H, len(tokens))
	for i, t := range tokens {
		result[i] = gin.H{
			"id":                 t.ID,
			"name":               t.Name,
			"key":                t.Key,
			"balance":            t.Balance,
			"total_used":         t.TotalUsed,
			"rate_limit":         t.RateLimit,
			"status":             t.Status,
			"created_at":         t.CreatedAt,
			"channel_priorities": priorityMap[t.ID],
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

	err := model.DB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(token).Error; err != nil {
			return err
		}

		if len(req.ChannelPriorities) > 0 {
			return saveChannelPriorities(tx, token.ID, req.ChannelPriorities)
		}
		return nil
	})

	if err != nil {
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

func GetToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tokenID := c.Param("id")

	var id uint
	if _, err := fmt.Sscanf(tokenID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid token id"))
		return
	}

	var token model.Token
	if err := model.DB().Where("id = ? AND user_id = ?", id, userID).First(&token).Error; err != nil {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	// 查询渠道优先级配置
	var priorities []model.TokenChannelPriority
	model.DB().Where("token_id = ?", id).Order("capability_code ASC, priority ASC").Find(&priorities)

	priorityList := make([]gin.H, len(priorities))
	for i, p := range priorities {
		priorityList[i] = gin.H{
			"capability_code": p.CapabilityCode,
			"channel_id":      p.ChannelID,
			"priority":        p.Priority,
		}
	}

	successResponse(c, gin.H{
		"id":                 token.ID,
		"name":               token.Name,
		"key":                token.Key,
		"balance":            token.Balance,
		"total_used":         token.TotalUsed,
		"rate_limit":         token.RateLimit,
		"status":             token.Status,
		"created_at":         token.CreatedAt,
		"channel_priorities": priorityList,
	})
}

func UpdateToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tokenID := c.Param("id")

	var id uint
	if _, err := fmt.Sscanf(tokenID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid token id"))
		return
	}

	// 验证令牌属于当前用户
	var token model.Token
	if err := model.DB().Where("id = ? AND user_id = ?", id, userID).First(&token).Error; err != nil {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	var req UpdateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	err := model.DB().Transaction(func(tx *gorm.DB) error {
		// 更新名称（如果提供）
		if req.Name != "" {
			if err := tx.Model(&token).Update("name", req.Name).Error; err != nil {
				return err
			}
		}

		// 更新渠道优先级配置
		if req.ChannelPriorities != nil {
			// 删除旧配置
			if err := tx.Where("token_id = ?", id).Delete(&model.TokenChannelPriority{}).Error; err != nil {
				return err
			}
			// 保存新配置
			if len(req.ChannelPriorities) > 0 {
				return saveChannelPriorities(tx, id, req.ChannelPriorities)
			}
		}
		return nil
	})

	if err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"updated": true})
}

func DeleteToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tokenID := c.Param("id")

	var id uint
	if _, err := fmt.Sscanf(tokenID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid token id"))
		return
	}

	err := model.DB().Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&model.Token{}).Where("id = ? AND user_id = ?", id, userID).Delete(&model.Token{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		// 删除关联的渠道优先级配置
		return tx.Where("token_id = ?", id).Delete(&model.TokenChannelPriority{}).Error
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			notFound(c, errors.ErrTaskNotFound)
			return
		}
		internalError(c, errors.ErrInternalError)
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

// saveChannelPriorities 保存渠道优先级配置
func saveChannelPriorities(tx *gorm.DB, tokenID uint, items []ChannelPriorityInput) error {
	priorities := make([]model.TokenChannelPriority, len(items))
	for i, item := range items {
		priorities[i] = model.TokenChannelPriority{
			TokenID:        tokenID,
			CapabilityCode: item.CapabilityCode,
			ChannelID:      item.ChannelID,
			Priority:       item.Priority,
		}
	}
	return tx.Create(&priorities).Error
}
