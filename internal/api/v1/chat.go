package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/api/middleware"
	"github.com/majingzhen/prism/internal/provider/chat"
	"github.com/majingzhen/prism/internal/service"
)

// ChatCompletions POST /v1/chat/completions
func ChatCompletions(c *gin.Context) {
	var req struct {
		Model          string             `json:"model" binding:"required"`
		Messages       []chat.ChatMessage `json:"messages" binding:"required,min=1"`
		Temperature    float64            `json:"temperature"`
		MaxTokens      int                `json:"max_tokens"`
		TopP           float64            `json:"top_p"`
		ConversationID string             `json:"conversation_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, 400, err.Error())
		return
	}

	token := middleware.GetToken(c)
	completionReq := &service.CompletionRequest{
		UserID:         token.UserID,
		TokenID:        token.ID,
		Model:          req.Model,
		Messages:       req.Messages,
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
		TopP:           req.TopP,
		ConversationID: req.ConversationID,
	}

	chatService := service.NewChatService()
	resp, err := chatService.Complete(c.Request.Context(), completionReq)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ListChatModelsPublic GET /v1/models
func ListChatModelsPublic(c *gin.Context) {
	chatService := service.NewChatService()
	models, err := chatService.ListModels(c.Request.Context())
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, 500, err.Error())
		return
	}

	data := make([]gin.H, 0, len(models))
	for _, m := range models {
		data = append(data, gin.H{
			"id":       m.Code,
			"object":   "model",
			"created":  m.CreatedAt.Unix(),
			"owned_by": m.Provider,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   data,
	})
}
