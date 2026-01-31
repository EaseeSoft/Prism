package v1

import (
	"strings"

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
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		successResponse(c, gin.H{"logged_out": true})
		return
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 && parts[0] == "Bearer" {
		token := parts[1]
		if err := userService.Logout(token); err != nil {
			logger.Error("logout error: " + err.Error())
		}
	}

	successResponse(c, gin.H{"logged_out": true})
}
