package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/auth"
	"github.com/majingzhen/prism/pkg/cache"
	"github.com/majingzhen/prism/pkg/errors"
)

const (
	ContextKeyUserID   = "user_id"
	ContextKeyUsername = "username"
	ContextKeyUserRole = "user_role"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    errors.ErrInvalidToken.Code,
				"message": "missing authorization header",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    errors.ErrInvalidToken.Code,
				"message": "invalid authorization format",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// 验证 JWT token
		claims, err := auth.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    errors.ErrInvalidToken.Code,
				"message": "invalid or expired token",
			})
			c.Abort()
			return
		}

		// 检查 token 是否在缓存中（未被登出）
		_, err = cache.GetLoginToken(c.Request.Context(), tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    errors.ErrInvalidToken.Code,
				"message": "token has been revoked or expired",
			})
			c.Abort()
			return
		}

		c.Set(ContextKeyUserID, claims.UserID)
		c.Set(ContextKeyUsername, claims.Username)
		c.Set(ContextKeyUserRole, claims.Role)
		c.Next()
	}
}

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(ContextKeyUserRole)
		if !exists || role != string(model.UserRoleAdmin) {
			c.JSON(http.StatusForbidden, gin.H{
				"code":    errors.ErrNoPermission.Code,
				"message": "admin permission required",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func GetUserID(c *gin.Context) uint {
	if v, exists := c.Get(ContextKeyUserID); exists {
		return v.(uint)
	}
	return 0
}

func GetUserRole(c *gin.Context) string {
	if v, exists := c.Get(ContextKeyUserRole); exists {
		return v.(string)
	}
	return ""
}
