package v1

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/errors"
)

func ListUsers(c *gin.Context) {
	users, err := userService.ListUsers()
	if err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	result := make([]gin.H, len(users))
	for i, u := range users {
		result[i] = gin.H{
			"id":         u.ID,
			"username":   u.Username,
			"role":       u.Role,
			"balance":    u.Balance,
			"status":     u.Status,
			"created_at": u.CreatedAt,
		}
	}

	successResponse(c, result)
}

type UpdateRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin user"`
}

func UpdateUserRole(c *gin.Context) {
	userID := c.Param("id")

	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	var id uint
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid user id"))
		return
	}

	if err := userService.UpdateUserRole(id, model.UserRole(req.Role)); err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"updated": true})
}

type UpdateStatusRequest struct {
	Status int8 `json:"status" binding:"oneof=0 1"`
}

func UpdateUserStatus(c *gin.Context) {
	userID := c.Param("id")

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	var id uint
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid user id"))
		return
	}

	if err := userService.UpdateUserStatus(id, req.Status); err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"updated": true})
}

type RechargeRequest struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
}

func RechargeUser(c *gin.Context) {
	userID := c.Param("id")

	var req RechargeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	var id uint
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid user id"))
		return
	}

	if err := userService.RechargeUser(id, req.Amount); err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"recharged": true})
}
