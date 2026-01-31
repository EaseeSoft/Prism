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
