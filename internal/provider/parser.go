package provider

import (
	"encoding/json"

	"github.com/tidwall/gjson"
)

type ResponseMapping struct {
	TaskID        string            `json:"task_id"`
	Status        string            `json:"status"`
	Progress      string            `json:"progress"`
	OutputURL     string            `json:"output_url"`
	Error         string            `json:"error"`
	StatusMapping map[string]string `json:"status_mapping"`
}

type ResponseParser interface {
	ParseSubmitResponse(body []byte, mapping *ResponseMapping) (SubmitResult, error)
	ParseProgressResponse(body []byte, mapping *ResponseMapping) (ProgressResult, error)
	ParseCallbackResponse(body []byte, mapping *ResponseMapping) (ProgressResult, string, error)
}

type DefaultParser struct{}

func NewDefaultParser() *DefaultParser {
	return &DefaultParser{}
}

func (p *DefaultParser) ParseSubmitResponse(body []byte, mapping *ResponseMapping) (SubmitResult, error) {
	var result SubmitResult

	if mapping == nil {
		return result, nil
	}

	jsonStr := string(body)

	if mapping.TaskID != "" {
		result.ProviderTaskID = gjson.Get(jsonStr, mapping.TaskID).String()
	}

	if mapping.Status != "" {
		rawStatus := gjson.Get(jsonStr, mapping.Status).String()
		result.Status = p.mapStatus(rawStatus, mapping.StatusMapping)
	}

	if mapping.Progress != "" {
		result.Progress = int(gjson.Get(jsonStr, mapping.Progress).Int())
	}

	if mapping.OutputURL != "" {
		url := gjson.Get(jsonStr, mapping.OutputURL).String()
		if url != "" {
			result.URLs = []string{url}
		}
	}

	return result, nil
}

func (p *DefaultParser) ParseProgressResponse(body []byte, mapping *ResponseMapping) (ProgressResult, error) {
	var result ProgressResult

	if mapping == nil {
		return result, nil
	}

	jsonStr := string(body)

	if mapping.Status != "" {
		rawStatus := gjson.Get(jsonStr, mapping.Status).String()
		result.Status = p.mapStatus(rawStatus, mapping.StatusMapping)
	}

	if mapping.Progress != "" {
		result.Progress = int(gjson.Get(jsonStr, mapping.Progress).Int())
	}

	if mapping.OutputURL != "" {
		url := gjson.Get(jsonStr, mapping.OutputURL).String()
		if url != "" {
			result.URLs = []string{url}
		}
	}

	if mapping.Error != "" {
		result.Error = gjson.Get(jsonStr, mapping.Error).String()
	}

	return result, nil
}

// ParseCallbackResponse 解析回调请求体，返回进度结果和 provider_task_id
func (p *DefaultParser) ParseCallbackResponse(body []byte, mapping *ResponseMapping) (ProgressResult, string, error) {
	var result ProgressResult
	var providerTaskID string

	if mapping == nil {
		return result, "", nil
	}

	jsonStr := string(body)

	// 提取 provider_task_id
	if mapping.TaskID != "" {
		providerTaskID = gjson.Get(jsonStr, mapping.TaskID).String()
	}

	// 提取状态
	if mapping.Status != "" {
		rawStatus := gjson.Get(jsonStr, mapping.Status).String()
		result.Status = p.mapStatus(rawStatus, mapping.StatusMapping)
	}

	// 提取进度
	if mapping.Progress != "" {
		result.Progress = int(gjson.Get(jsonStr, mapping.Progress).Int())
	}

	// 提取输出 URL
	if mapping.OutputURL != "" {
		url := gjson.Get(jsonStr, mapping.OutputURL).String()
		if url != "" {
			result.URLs = []string{url}
		}
	}

	// 提取错误信息
	if mapping.Error != "" {
		result.Error = gjson.Get(jsonStr, mapping.Error).String()
	}

	return result, providerTaskID, nil
}

func (p *DefaultParser) mapStatus(raw string, mapping map[string]string) TaskStatus {
	if mapping == nil {
		return TaskStatus(raw)
	}
	if mapped, ok := mapping[raw]; ok {
		return TaskStatus(mapped)
	}
	return TaskStatus(raw)
}

func ParseResponseMapping(data []byte) (*ResponseMapping, error) {
	if len(data) == 0 {
		return nil, nil
	}
	var mapping ResponseMapping
	if err := json.Unmarshal(data, &mapping); err != nil {
		return nil, err
	}
	return &mapping, nil
}
