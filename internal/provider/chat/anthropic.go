package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/majingzhen/prism/pkg/httputil"
)

// AnthropicProvider Claude API
type AnthropicProvider struct {
	config ProviderConfig
}

func NewAnthropicProvider(config ProviderConfig) *AnthropicProvider {
	return &AnthropicProvider{config: config}
}

func (p *AnthropicProvider) Name() string {
	return "anthropic"
}

func (p *AnthropicProvider) Complete(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	// 转换请求格式
	anthropicReq := p.convertRequest(req)

	// 构建 URL
	url := p.config.BaseURL + "/v1/messages"

	// 构建请求头
	headers := map[string]string{
		"x-api-key":         p.config.APIKey,
		"anthropic-version": "2023-06-01",
	}
	for k, v := range p.config.ExtraHeaders {
		headers[k] = v
	}

	// 设置超时上下文
	ctx, cancel := context.WithTimeout(ctx, p.config.Timeout)
	defer cancel()

	// 发送请求
	resp, err := httputil.PostJSON(ctx, url, anthropicReq, headers)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	return p.convertResponse(resp)
}

func (p *AnthropicProvider) convertRequest(req *ChatRequest) map[string]any {
	result := map[string]any{
		"model":      p.config.VendorModel,
		"max_tokens": req.MaxTokens,
	}

	if req.MaxTokens == 0 {
		result["max_tokens"] = 4096
	}

	if req.Temperature > 0 {
		result["temperature"] = req.Temperature
	}

	var messages []map[string]string
	for _, msg := range req.Messages {
		if msg.Role == "system" {
			result["system"] = msg.Content
		} else {
			messages = append(messages, map[string]string{
				"role":    msg.Role,
				"content": msg.Content,
			})
		}
	}
	result["messages"] = messages

	return result
}

func (p *AnthropicProvider) convertResponse(body []byte) (*ChatResponse, error) {
	var anthropicResp struct {
		ID      string `json:"id"`
		Type    string `json:"type"`
		Role    string `json:"role"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
		Usage      struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return nil, fmt.Errorf("unmarshal response failed: %w", err)
	}

	content := ""
	if len(anthropicResp.Content) > 0 {
		content = anthropicResp.Content[0].Text
	}

	return &ChatResponse{
		ID:      anthropicResp.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   p.config.VendorModel,
		Choices: []ChatChoice{{
			Index: 0,
			Message: ChatMessage{
				Role:    "assistant",
				Content: content,
			},
			FinishReason: anthropicResp.StopReason,
		}},
		Usage: &ChatUsage{
			PromptTokens:     anthropicResp.Usage.InputTokens,
			CompletionTokens: anthropicResp.Usage.OutputTokens,
			TotalTokens:      anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		},
	}, nil
}
