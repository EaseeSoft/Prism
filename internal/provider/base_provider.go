package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type BaseProvider struct {
	Name            string
	BaseURL         string
	APIKey          string
	AuthLocation    string // header/body/query
	AuthKey         string
	AuthValuePrefix string
	ContentType     string // application/json / application/x-www-form-urlencoded
	RequestMethod   string // POST / GET
	SubmitPath      string
	ProgressPath    string
	Converter       ParamConverter
	Parser          ResponseParser
	ResponseMapping *ResponseMapping
	CallbackMapping *ResponseMapping
}

// buildRequestBody 根据 ContentType 构建请求体
func (p *BaseProvider) buildRequestBody(params map[string]any) (io.Reader, string) {
	ct := p.ContentType
	if ct == "application/x-www-form-urlencoded" {
		form := url.Values{}
		for k, v := range params {
			form.Set(k, fmt.Sprintf("%v", v))
		}
		return strings.NewReader(form.Encode()), ct
	}
	if ct == "multipart/form-data" {
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		for k, v := range params {
			writer.WriteField(k, fmt.Sprintf("%v", v))
		}
		writer.Close()
		return &buf, writer.FormDataContentType()
	}
	// 默认 JSON
	bodyBytes, _ := json.Marshal(params)
	return bytes.NewReader(bodyBytes), "application/json"
}

// setAuth 设置认证信息
func (p *BaseProvider) setAuth(httpReq *http.Request) {
	if p.AuthLocation == "" || p.AuthLocation == "header" {
		httpReq.Header.Set(p.AuthKey, p.AuthValuePrefix+p.APIKey)
	}
}

// appendQueryAuth 给 URL 追加 query 认证参数
func (p *BaseProvider) appendQueryAuth(rawURL string) string {
	if p.AuthLocation != "query" {
		return rawURL
	}
	sep := "?"
	if strings.Contains(rawURL, "?") {
		sep = "&"
	}
	return rawURL + sep + url.QueryEscape(p.AuthKey) + "=" + url.QueryEscape(p.APIKey)
}

func (p *BaseProvider) Submit(ctx context.Context, req SubmitRequest) (SubmitResult, error) {
	reqURL := p.appendQueryAuth(p.BaseURL + p.SubmitPath)

	// body 认证：将 token 注入到请求参数中
	params := req.Params
	if p.AuthLocation == "body" {
		if params == nil {
			params = make(map[string]any)
		}
		params[p.AuthKey] = p.AuthValuePrefix + p.APIKey
	}

	body, contentType := p.buildRequestBody(params)

	method := p.RequestMethod
	if method == "" {
		method = "POST"
	}

	httpReq, err := http.NewRequestWithContext(ctx, method, reqURL, body)
	if err != nil {
		return SubmitResult{}, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", contentType)
	p.setAuth(httpReq)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return SubmitResult{}, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return SubmitResult{}, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return SubmitResult{}, fmt.Errorf("api error: %s", string(respBody))
	}

	return p.Parser.ParseSubmitResponse(respBody, p.ResponseMapping)
}

func (p *BaseProvider) GetProgress(ctx context.Context, providerTaskID string) (ProgressResult, error) {
	reqURL := p.appendQueryAuth(fmt.Sprintf("%s%s/%s", p.BaseURL, p.ProgressPath, providerTaskID))

	httpReq, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return ProgressResult{}, fmt.Errorf("create request: %w", err)
	}

	p.setAuth(httpReq)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return ProgressResult{}, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return ProgressResult{}, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return ProgressResult{Error: string(respBody)}, nil
	}

	return p.Parser.ParseProgressResponse(respBody, p.ResponseMapping)
}

// ParseCallback 使用独立的 CallbackMapping 解析回调
func (p *BaseProvider) ParseCallback(ctx context.Context, body []byte) (ProgressResult, string, error) {
	// 优先使用 CallbackMapping，如果没有配置则回退到 ResponseMapping
	mapping := p.CallbackMapping
	if mapping == nil {
		mapping = p.ResponseMapping
	}

	return p.Parser.ParseCallbackResponse(body, mapping)
}
