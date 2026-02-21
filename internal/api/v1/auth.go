package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/api/middleware"
	"github.com/majingzhen/prism/internal/service"
	"github.com/majingzhen/prism/pkg/errors"
	"github.com/majingzhen/prism/pkg/logger"
)

var userService = service.NewUserService()

func Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	user, err := userService.Register(&req)
	if err != nil {
		if err.Error() == "username already exists" {
			badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
			return
		}
		logger.Error("register error: " + err.Error())
		internalError(c, errors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"role":     user.Role,
	})
}

func Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	resp, err := userService.Login(&req)
	if err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	successResponse(c, gin.H{
		"token": resp.Token,
		"user": gin.H{
			"id":       resp.User.ID,
			"username": resp.User.Username,
			"role":     resp.User.Role,
			"balance":  resp.User.Balance,
		},
	})
}

func GetCurrentUser(c *gin.Context) {
	userID := middleware.GetUserID(c)
	user, err := userService.GetUserByID(userID)
	if err != nil {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	successResponse(c, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"role":     user.Role,
		"balance":  user.Balance,
	})
}

// Logout 用户登出
func Logout(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		successResponse(c, gin.H{"logged_out": true})
		return
	}

	if err := userService.Logout(token); err != nil {
		logger.Error("logout error: " + err.Error())
	}

	successResponse(c, gin.H{"logged_out": true})
}

// ChangePassword 修改密码
func ChangePassword(c *gin.Context) {
	var req service.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	userID := middleware.GetUserID(c)
	if err := userService.ChangePassword(userID, &req); err != nil {
		if err.Error() == "incorrect old password" {
			badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "旧密码不正确"))
			return
		}
		logger.Error("change password error: " + err.Error())
		internalError(c, errors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"changed": true})
}
