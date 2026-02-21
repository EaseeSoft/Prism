package chat

import (
	"context"
	"time"
)

// ChatProvider LLM 请求适配接口
type ChatProvider interface {
	Complete(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
	Name() string
}

// ChatRequest 统一请求格式
type ChatRequest struct {
	Model            string        `json:"model"`
	Messages         []ChatMessage `json:"messages"`
	Temperature      float64       `json:"temperature,omitempty"`
	MaxTokens        int           `json:"max_tokens,omitempty"`
	TopP             float64       `json:"top_p,omitempty"`
	FrequencyPenalty float64       `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64       `json:"presence_penalty,omitempty"`
	Stop             []string      `json:"stop,omitempty"`
	Stream           bool          `json:"stream,omitempty"`
}

// ChatMessage 消息
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse 统一响应格式
type ChatResponse struct {
	ID      string       `json:"id"`
	Object  string       `json:"object"`
	Created int64        `json:"created"`
	Model   string       `json:"model"`
	Choices []ChatChoice `json:"choices"`
	Usage   *ChatUsage   `json:"usage,omitempty"`
}

// ChatChoice 选项
type ChatChoice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

// ChatUsage Token 使用统计
type ChatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ProviderConfig Provider 配置
type ProviderConfig struct {
	BaseURL      string
	APIKey       string
	VendorModel  string
	RequestPath  string
	Timeout      time.Duration
	ExtraHeaders map[string]string
}
