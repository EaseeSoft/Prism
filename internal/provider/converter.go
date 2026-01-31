package provider

import (
	"encoding/json"
	"fmt"
)

type ParamTemplate struct {
	FieldMapping map[string]string         `json:"field_mapping"`
	ValueMapping map[string]map[string]any `json:"value_mapping"`
	Defaults     map[string]any            `json:"defaults"`
}

type ParamConverter interface {
	Convert(unified map[string]any, template *ParamTemplate) (map[string]any, error)
}

type DefaultConverter struct{}

func NewDefaultConverter() *DefaultConverter {
	return &DefaultConverter{}
}

func (c *DefaultConverter) Convert(unified map[string]any, tpl *ParamTemplate) (map[string]any, error) {
	if tpl == nil {
		return unified, nil
	}

	result := make(map[string]any)

	// 1. 应用默认值
	for k, v := range tpl.Defaults {
		result[k] = v
	}

	// 2. 字段映射转换
	for unifiedKey, providerKey := range tpl.FieldMapping {
		val, ok := unified[unifiedKey]
		if !ok {
			continue
		}

		// 检查是否需要值映射
		if valueMap, hasMapping := tpl.ValueMapping[unifiedKey]; hasMapping {
			strVal := fmt.Sprint(val)
			if mappedVal, found := valueMap[strVal]; found {
				result[providerKey] = mappedVal
				continue
			}
		}
		result[providerKey] = val
	}

	// 3. 保留未映射的字段
	for k, v := range unified {
		if _, mapped := tpl.FieldMapping[k]; !mapped {
			if _, exists := result[k]; !exists {
				result[k] = v
			}
		}
	}

	return result, nil
}

func ParseParamTemplate(data []byte) (*ParamTemplate, error) {
	if len(data) == 0 {
		return nil, nil
	}
	var tpl ParamTemplate
	if err := json.Unmarshal(data, &tpl); err != nil {
		return nil, err
	}
	return &tpl, nil
}
