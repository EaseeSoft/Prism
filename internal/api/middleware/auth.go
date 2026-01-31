package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/errors"
)

const (
	ContextKeyTokenID = "token_id"
	ContextKeyToken   = "token"
)

func Auth() gin.HandlerFunc {
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

		tokenKey := parts[1]
		var token model.Token
		if err := model.DB().Model(&model.Token{}).Where("`key` = ? AND status = 1", tokenKey).First(&token).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    errors.ErrInvalidToken.Code,
				"message": errors.ErrInvalidToken.Message,
			})
			c.Abort()
			return
		}

		c.Set(ContextKeyTokenID, token.ID)
		c.Set(ContextKeyToken, &token)
		c.Next()
	}
}

func GetTokenID(c *gin.Context) uint {
	if v, exists := c.Get(ContextKeyTokenID); exists {
		return v.(uint)
	}
	return 0
}

func GetToken(c *gin.Context) *model.Token {
	if v, exists := c.Get(ContextKeyToken); exists {
		return v.(*model.Token)
	}
	return nil
}
