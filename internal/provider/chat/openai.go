package chat

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/majingzhen/prism/pkg/httputil"
)

// OpenAIProvider OpenAI 及兼容 API
type OpenAIProvider struct {
	config ProviderConfig
}

func NewOpenAIProvider(config ProviderConfig) *OpenAIProvider {
	return &OpenAIProvider{config: config}
}

func (p *OpenAIProvider) Name() string {
	return "openai"
}

func (p *OpenAIProvider) Complete(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	// 替换模型名
	req.Model = p.config.VendorModel

	// 构建 URL
	url := p.config.BaseURL + p.config.RequestPath

	// 构建请求头
	headers := map[string]string{
		"Authorization": "Bearer " + p.config.APIKey,
	}
	for k, v := range p.config.ExtraHeaders {
		headers[k] = v
	}

	// 设置超时上下文
	ctx, cancel := context.WithTimeout(ctx, p.config.Timeout)
	defer cancel()

	// 发送请求
	resp, err := httputil.PostJSON(ctx, url, req, headers)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	// 解析响应
	var chatResp ChatResponse
	if err := json.Unmarshal(resp, &chatResp); err != nil {
		return nil, fmt.Errorf("unmarshal response failed: %w", err)
	}

	return &chatResp, nil
}
