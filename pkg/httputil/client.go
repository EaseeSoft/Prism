package httputil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"time"
)

var client = &http.Client{
	Timeout: 5 * time.Minute,
}

// RequestDetail HTTP 请求详情
type RequestDetail struct {
	Method         string
	URL            string
	RequestHeaders map[string]string
	RequestBody    string
	StatusCode     int
	ResponseBody   []byte
	DurationMs     int64
	Error          error
}

// DownloadResult 下载结果
type DownloadResult struct {
	Body        io.ReadCloser
	ContentType string
	Size        int64
}

// Download 下载文件
func Download(ctx context.Context, url string) (*DownloadResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return &DownloadResult{
		Body:        resp.Body,
		ContentType: resp.Header.Get("Content-Type"),
		Size:        resp.ContentLength,
	}, nil
}

// PostJSON 发送 JSON POST 请求
func PostJSON(ctx context.Context, url string, body any, headers map[string]string) ([]byte, error) {
	var bodyBytes []byte
	var err error

	if body != nil {
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("http error: %d, body: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// GetJSON 发送 JSON GET 请求
func GetJSON(ctx context.Context, url string, headers map[string]string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("http error: %d, body: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// Post 发送 POST 请求，根据 contentType 自动处理请求体格式
func Post(ctx context.Context, reqURL string, params map[string]any, headers map[string]string, contentType string) ([]byte, error) {
	var body io.Reader
	var actualContentType string

	switch contentType {
	case "application/x-www-form-urlencoded":
		form := url.Values{}
		for k, v := range params {
			form.Set(k, fmt.Sprintf("%v", v))
		}
		body = bytes.NewBufferString(form.Encode())
		actualContentType = contentType
	case "multipart/form-data":
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		for k, v := range params {
			writer.WriteField(k, fmt.Sprintf("%v", v))
		}
		writer.Close()
		body = &buf
		actualContentType = writer.FormDataContentType()
	default:
		// 默认 JSON
		bodyBytes, err := json.Marshal(params)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
		body = bytes.NewReader(bodyBytes)
		actualContentType = "application/json"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, body)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", actualContentType)
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("http error: %d, body: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// PostWithDetail 发送 POST 请求并返回详情
func PostWithDetail(ctx context.Context, reqURL string, params map[string]any, headers map[string]string, contentType string) *RequestDetail {
	detail := &RequestDetail{
		Method:         http.MethodPost,
		URL:            reqURL,
		RequestHeaders: headers,
	}

	var body io.Reader
	var actualContentType string
	var requestBodyStr string

	switch contentType {
	case "application/x-www-form-urlencoded":
		form := url.Values{}
		for k, v := range params {
			form.Set(k, fmt.Sprintf("%v", v))
		}
		requestBodyStr = form.Encode()
		body = bytes.NewBufferString(requestBodyStr)
		actualContentType = contentType
	case "multipart/form-data":
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		for k, v := range params {
			writer.WriteField(k, fmt.Sprintf("%v", v))
		}
		writer.Close()
		requestBodyStr = buf.String()
		body = bytes.NewBufferString(requestBodyStr)
		actualContentType = writer.FormDataContentType()
	default:
		bodyBytes, err := json.Marshal(params)
		if err != nil {
			detail.Error = fmt.Errorf("marshal body: %w", err)
			return detail
		}
		requestBodyStr = string(bodyBytes)
		body = bytes.NewReader(bodyBytes)
		actualContentType = "application/json"
	}

	detail.RequestBody = requestBodyStr

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, body)
	if err != nil {
		detail.Error = fmt.Errorf("create request: %w", err)
		return detail
	}

	req.Header.Set("Content-Type", actualContentType)
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	startTime := time.Now()
	resp, err := client.Do(req)
	detail.DurationMs = time.Since(startTime).Milliseconds()

	if err != nil {
		detail.Error = fmt.Errorf("do request: %w", err)
		return detail
	}
	defer resp.Body.Close()

	detail.StatusCode = resp.StatusCode

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		detail.Error = fmt.Errorf("read response: %w", err)
		return detail
	}

	detail.ResponseBody = respBody

	if resp.StatusCode >= 400 {
		detail.Error = fmt.Errorf("http error: %d, body: %s", resp.StatusCode, string(respBody))
	}

	return detail
}

// GetJSONWithDetail 发送 GET 请求并返回详情
func GetJSONWithDetail(ctx context.Context, reqURL string, headers map[string]string) *RequestDetail {
	detail := &RequestDetail{
		Method:         http.MethodGet,
		URL:            reqURL,
		RequestHeaders: headers,
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		detail.Error = fmt.Errorf("create request: %w", err)
		return detail
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	startTime := time.Now()
	resp, err := client.Do(req)
	detail.DurationMs = time.Since(startTime).Milliseconds()

	if err != nil {
		detail.Error = fmt.Errorf("do request: %w", err)
		return detail
	}
	defer resp.Body.Close()

	detail.StatusCode = resp.StatusCode

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		detail.Error = fmt.Errorf("read response: %w", err)
		return detail
	}

	detail.ResponseBody = respBody

	if resp.StatusCode >= 400 {
		detail.Error = fmt.Errorf("http error: %d, body: %s", resp.StatusCode, string(respBody))
	}

	return detail
}

// PostJSONWithDetail 发送 JSON POST 请求并返回详情
func PostJSONWithDetail(ctx context.Context, reqURL string, body any, headers map[string]string) *RequestDetail {
	detail := &RequestDetail{
		Method:         http.MethodPost,
		URL:            reqURL,
		RequestHeaders: headers,
	}

	var bodyBytes []byte
	var err error

	if body != nil {
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			detail.Error = fmt.Errorf("marshal body: %w", err)
			return detail
		}
		detail.RequestBody = string(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		detail.Error = fmt.Errorf("create request: %w", err)
		return detail
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	startTime := time.Now()
	resp, err := client.Do(req)
	detail.DurationMs = time.Since(startTime).Milliseconds()

	if err != nil {
		detail.Error = fmt.Errorf("do request: %w", err)
		return detail
	}
	defer resp.Body.Close()

	detail.StatusCode = resp.StatusCode

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		detail.Error = fmt.Errorf("read response: %w", err)
		return detail
	}

	detail.ResponseBody = respBody

	if resp.StatusCode >= 400 {
		detail.Error = fmt.Errorf("http error: %d, body: %s", resp.StatusCode, string(respBody))
	}

	return detail
}
