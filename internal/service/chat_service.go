package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/internal/provider/chat"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

type ChatService struct {
	billingService    *BillingService
	requestLogService *RequestLogService
}

func NewChatService() *ChatService {
	return &ChatService{
		billingService:    NewBillingService(),
		requestLogService: NewRequestLogService(),
	}
}

// CompletionRequest 对话补全请求
type CompletionRequest struct {
	UserID         uint
	TokenID        uint
	Model          string
	Messages       []chat.ChatMessage
	Temperature    float64
	MaxTokens      int
	TopP           float64
	ConversationID string
}

// CompletionResponse 对话补全响应
type CompletionResponse struct {
	ID             string            `json:"id"`
	Object         string            `json:"object"`
	Created        int64             `json:"created"`
	Model          string            `json:"model"`
	ConversationID string            `json:"conversation_id,omitempty"`
	Choices        []chat.ChatChoice `json:"choices"`
	Usage          *chat.ChatUsage   `json:"usage,omitempty"`
}

// Complete 执行对话补全
func (s *ChatService) Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error) {
	startTime := time.Now()

	// 1. 查找模型
	var chatModel model.ChatModel
	if err := model.DB().Where("code = ? AND status = 1", req.Model).First(&chatModel).Error; err != nil {
		return nil, fmt.Errorf("model not found: %s", req.Model)
	}

	// 2. 查找模型渠道映射（支持令牌优先级配置）
	modelChannel, err := s.selectModelChannel(req.TokenID, req.Model)
	if err != nil {
		return nil, err
	}

	// 3. 获取渠道信息
	var channel model.Channel
	if err := model.DB().Where("id = ? AND status = 1", modelChannel.ChannelID).First(&channel).Error; err != nil {
		return nil, fmt.Errorf("channel not found: %d", modelChannel.ChannelID)
	}

	// 4. 选择账号
	var account model.ChannelAccount
	err = model.DB().Where("channel_id = ? AND status = 1", channel.ID).
		Order("current_tasks ASC, weight DESC").
		First(&account).Error
	if err != nil {
		return nil, fmt.Errorf("no available account for channel: %s", channel.Type)
	}

	// 5. 处理对话记忆
	var conversation *model.Conversation
	messages := req.Messages

	if req.ConversationID != "" {
		conversation, err = s.loadConversation(req.ConversationID, req.TokenID)
		if err == nil {
			historyMessages, _ := s.loadMessages(conversation.ID)
			messages = append(historyMessages, req.Messages...)
		}
	} else {
		conversation = s.createConversation(req.UserID, req.TokenID, req.Model, req.Messages)
	}

	// 6. 构建 Provider 并调用
	providerConfig := chat.ProviderConfig{
		BaseURL:     channel.BaseURL,
		APIKey:      account.APIKey,
		VendorModel: modelChannel.VendorModel,
		RequestPath: modelChannel.RequestPath,
		Timeout:     time.Duration(modelChannel.Timeout) * time.Second,
	}

	provider, err := chat.GetProvider(chatModel.Provider, providerConfig)
	if err != nil {
		return nil, fmt.Errorf("get provider failed: %w", err)
	}

	chatReq := &chat.ChatRequest{
		Model:       req.Model,
		Messages:    messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		TopP:        req.TopP,
	}

	chatResp, err := provider.Complete(ctx, chatReq)
	latencyMs := int(time.Since(startTime).Milliseconds())

	// 7. 记录请求日志
	var conversationID uint
	if conversation != nil {
		conversationID = conversation.ID
	}
	s.logRequest(conversationID, req.Model, &channel, &account, chatReq, chatResp, latencyMs, err)

	if err != nil {
		logger.Error("chat completion failed",
			zap.String("model", req.Model),
			zap.String("channel", channel.Type),
			zap.Error(err))
		return nil, fmt.Errorf("chat completion failed: %w", err)
	}

	// 8. 计费
	cost, err := s.charge(req.TokenID, req.UserID, chatResp.Usage, modelChannel)
	if err != nil {
		logger.Warn("charge failed", zap.Error(err))
	}

	// 9. 保存消息
	if conversation != nil {
		s.saveMessages(conversation, req.Messages, chatResp, modelChannel, &account, latencyMs, cost)
	}

	// 10. 构建响应
	response := &CompletionResponse{
		ID:      chatResp.ID,
		Object:  "chat.completion",
		Created: chatResp.Created,
		Model:   req.Model,
		Choices: chatResp.Choices,
		Usage:   chatResp.Usage,
	}

	if conversation != nil {
		response.ConversationID = fmt.Sprintf("%d", conversation.ID)
	}

	logger.Info("chat completion success",
		zap.String("model", req.Model),
		zap.String("channel", channel.Type),
		zap.Int("latency_ms", latencyMs),
		zap.Float64("cost", cost))

	return response, nil
}

// selectModelChannel 根据令牌优先级选择模型渠道
func (s *ChatService) selectModelChannel(tokenID uint, modelCode string) (*model.ChatModelChannel, error) {
	// 查询令牌的 Chat 模型渠道优先级配置
	// capability_code 格式: "chat:model_code"
	priorityKey := "chat:" + modelCode

	var priorities []model.TokenChannelPriority
	model.DB().Where("token_id = ? AND capability_code = ?", tokenID, priorityKey).
		Order("priority ASC").
		Find(&priorities)

	// 按优先级遍历，找到第一个可用的渠道
	for _, p := range priorities {
		var mc model.ChatModelChannel
		err := model.DB().Where("model_code = ? AND channel_id = ? AND status = 1", modelCode, p.ChannelID).
			First(&mc).Error
		if err == nil {
			// 检查渠道是否启用
			var ch model.Channel
			if model.DB().Where("id = ? AND status = 1", p.ChannelID).First(&ch).Error == nil {
				return &mc, nil
			}
		}
	}

	// 没有配置优先级或优先级配置的渠道都不可用，使用默认优先级
	var modelChannel model.ChatModelChannel
	err := model.DB().Where("model_code = ? AND status = 1", modelCode).
		Order("priority DESC").
		First(&modelChannel).Error
	if err != nil {
		return nil, fmt.Errorf("no available channel for model: %s", modelCode)
	}

	return &modelChannel, nil
}

// logRequest 记录 Chat 请求日志
func (s *ChatService) logRequest(
	conversationID uint,
	modelCode string,
	channel *model.Channel,
	account *model.ChannelAccount,
	req *chat.ChatRequest,
	resp *chat.ChatResponse,
	latencyMs int,
	reqErr error,
) {
	reqBody, _ := json.Marshal(req)
	respBody := ""
	statusCode := 0
	errMsg := ""

	if resp != nil {
		respData, _ := json.Marshal(resp)
		respBody = string(respData)
		statusCode = 200
	}
	if reqErr != nil {
		errMsg = reqErr.Error()
		statusCode = 500
	}

	requestURL := strings.TrimSuffix(channel.BaseURL, "/") + "/v1/chat/completions"

	log := &model.ChannelRequestLog{
		ConversationID: conversationID,
		ChannelID:      channel.ID,
		AccountID:      account.ID,
		CapabilityCode: modelCode,
		RequestType:    model.RequestTypeChat,
		Method:         "POST",
		URL:            requestURL,
		RequestBody:    string(reqBody),
		StatusCode:     statusCode,
		ResponseBody:   respBody,
		DurationMs:     int64(latencyMs),
		ErrorMessage:   errMsg,
		RequestAt:      time.Now(),
	}

	s.requestLogService.Log(log)
}

func (s *ChatService) loadConversation(conversationID string, tokenID uint) (*model.Conversation, error) {
	var conv model.Conversation
	err := model.DB().Where("id = ? AND token_id = ? AND status = 1", conversationID, tokenID).
		First(&conv).Error
	return &conv, err
}

func (s *ChatService) loadMessages(conversationID uint) ([]chat.ChatMessage, error) {
	var messages []model.Message
	model.DB().Where("conversation_id = ?", conversationID).
		Order("created_at ASC").
		Find(&messages)

	result := make([]chat.ChatMessage, 0, len(messages))
	for _, msg := range messages {
		result = append(result, chat.ChatMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}
	return result, nil
}

func (s *ChatService) createConversation(userID, tokenID uint, modelCode string, messages []chat.ChatMessage) *model.Conversation {
	title := ""
	systemPrompt := ""

	for _, msg := range messages {
		if msg.Role == "system" {
			systemPrompt = msg.Content
		} else if msg.Role == "user" && title == "" {
			title = truncateString(msg.Content, 50)
		}
	}

	conv := &model.Conversation{
		UserID:       userID,
		TokenID:      tokenID,
		Title:        title,
		Model:        modelCode,
		SystemPrompt: systemPrompt,
		Status:       1,
	}
	model.DB().Create(conv)
	return conv
}

func (s *ChatService) saveMessages(
	conv *model.Conversation,
	userMessages []chat.ChatMessage,
	resp *chat.ChatResponse,
	mc *model.ChatModelChannel,
	account *model.ChannelAccount,
	latencyMs int,
	cost float64,
) {
	// 保存用户消息
	for _, msg := range userMessages {
		model.DB().Create(&model.Message{
			ConversationID: conv.ID,
			Role:           msg.Role,
			Content:        msg.Content,
			Model:          mc.ModelCode,
		})
	}

	// 保存助手消息
	if len(resp.Choices) > 0 {
		assistantMsg := resp.Choices[0].Message
		inputTokens := 0
		outputTokens := 0
		if resp.Usage != nil {
			inputTokens = resp.Usage.PromptTokens
			outputTokens = resp.Usage.PromptTokens + resp.Usage.CompletionTokens
		}

		model.DB().Create(&model.Message{
			ConversationID: conv.ID,
			Role:           assistantMsg.Role,
			Content:        assistantMsg.Content,
			InputTokens:    inputTokens,
			OutputTokens:   outputTokens,
			Model:          mc.ModelCode,
			ChannelID:      mc.ChannelID,
			AccountID:      account.ID,
			LatencyMs:      latencyMs,
			Cost:           cost,
		})

		// 更新对话统计
		model.DB().Model(conv).Updates(map[string]any{
			"total_tokens":  conv.TotalTokens + outputTokens,
			"message_count": conv.MessageCount + len(userMessages) + 1,
			"model":         mc.ModelCode,
		})
	}
}

func (s *ChatService) charge(tokenID, userID uint, usage *chat.ChatUsage, mc *model.ChatModelChannel) (float64, error) {
	if usage == nil {
		return 0, nil
	}

	var cost float64
	if mc.PriceMode == model.PriceModeToken {
		cost = float64(usage.PromptTokens)/1000000*mc.InputPrice +
			float64(usage.CompletionTokens)/1000000*mc.OutputPrice
	} else {
		cost = mc.InputPrice
	}

	if cost > 0 {
		if err := s.billingService.Deduct(tokenID, userID, cost); err != nil {
			return 0, err
		}
	}

	return cost, nil
}

// ListModels 获取可用模型列表
func (s *ChatService) ListModels(ctx context.Context) ([]model.ChatModel, error) {
	var models []model.ChatModel
	err := model.DB().Where("status = 1").Order("id ASC").Find(&models).Error
	return models, err
}

func truncateString(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + "..."
}
