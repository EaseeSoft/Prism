package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/majingzhen/prism/pkg/httputil"
)

// GoogleProvider Gemini API
type GoogleProvider struct {
	config ProviderConfig
}

func NewGoogleProvider(config ProviderConfig) *GoogleProvider {
	return &GoogleProvider{config: config}
}

func (p *GoogleProvider) Name() string {
	return "google"
}

func (p *GoogleProvider) Complete(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	geminiReq := p.convertRequest(req)

	// API key 在 URL 参数中
	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s",
		p.config.BaseURL, p.config.VendorModel, p.config.APIKey)

	// 设置超时上下文
	ctx, cancel := context.WithTimeout(ctx, p.config.Timeout)
	defer cancel()

	// 发送请求
	resp, err := httputil.PostJSON(ctx, url, geminiReq, p.config.ExtraHeaders)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	return p.convertResponse(resp)
}

func (p *GoogleProvider) convertRequest(req *ChatRequest) map[string]any {
	var contents []map[string]any

	for _, msg := range req.Messages {
		role := msg.Role
		if role == "assistant" {
			role = "model"
		}
		if role == "system" {
			role = "user" // Gemini 将 system 作为特殊的 user message
		}

		contents = append(contents, map[string]any{
			"role": role,
			"parts": []map[string]string{
				{"text": msg.Content},
			},
		})
	}

	result := map[string]any{
		"contents": contents,
	}

	if req.MaxTokens > 0 || req.Temperature > 0 {
		generationConfig := map[string]any{}
		if req.MaxTokens > 0 {
			generationConfig["maxOutputTokens"] = req.MaxTokens
		}
		if req.Temperature > 0 {
			generationConfig["temperature"] = req.Temperature
		}
		result["generationConfig"] = generationConfig
	}

	return result
}

func (p *GoogleProvider) convertResponse(body []byte) (*ChatResponse, error) {
	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}

	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return nil, fmt.Errorf("unmarshal response failed: %w", err)
	}

	content := ""
	finishReason := ""
	if len(geminiResp.Candidates) > 0 {
		candidate := geminiResp.Candidates[0]
		if len(candidate.Content.Parts) > 0 {
			content = candidate.Content.Parts[0].Text
		}
		finishReason = candidate.FinishReason
	}

	return &ChatResponse{
		ID:      fmt.Sprintf("gemini-%d", time.Now().UnixNano()),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   p.config.VendorModel,
		Choices: []ChatChoice{{
			Index: 0,
			Message: ChatMessage{
				Role:    "assistant",
				Content: content,
			},
			FinishReason: finishReason,
		}},
		Usage: &ChatUsage{
			PromptTokens:     geminiResp.UsageMetadata.PromptTokenCount,
			CompletionTokens: geminiResp.UsageMetadata.CandidatesTokenCount,
			TotalTokens:      geminiResp.UsageMetadata.TotalTokenCount,
		},
	}, nil
}
