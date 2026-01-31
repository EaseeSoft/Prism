package service

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// ParamMapping 参数映射配置
type ParamMapping struct {
	FieldMapping   map[string]string              `json:"field_mapping"`
	ValueMapping   map[string]map[string]string   `json:"value_mapping"`
	TypeConvert    map[string]ParamTypeConversion `json:"type_convert"`
	FixedParams    map[string]any                 `json:"fixed_params"`
	ComputedParams map[string]string              `json:"computed_params"`
	ParamRules     map[string]ParamRule           `json:"param_rules"`
}

// ParamTypeConversion 参数类型转换配置
type ParamTypeConversion struct {
	Type      string `json:"type"`      // array_to_string, string_to_array
	Separator string `json:"separator"` // 分隔符
}

type ParamRule struct {
	Excludes []string `json:"excludes"`
	Requires []string `json:"requires"`
}

// ParamMapper 参数映射器
type ParamMapper struct{}

func NewParamMapper() *ParamMapper {
	return &ParamMapper{}
}

// Map 将统一参数映射为供应商参数
func (m *ParamMapper) Map(standardParams map[string]any, mappingConfig []byte) (map[string]any, error) {
	if len(mappingConfig) == 0 {
		return standardParams, nil
	}

	var mapping ParamMapping
	if err := json.Unmarshal(mappingConfig, &mapping); err != nil {
		return nil, fmt.Errorf("invalid mapping config: %w", err)
	}

	result := make(map[string]any)

	// 1. 添加固定参数
	for k, v := range mapping.FixedParams {
		result[k] = v
	}

	// 2. 字段映射
	for stdField, value := range standardParams {
		// 检查排除规则
		if rule, ok := mapping.ParamRules[stdField]; ok {
			skip := false
			for _, excludeField := range rule.Excludes {
				if _, exists := standardParams[excludeField]; exists {
					skip = true
					break
				}
			}
			if skip {
				continue
			}
		}

		// 获取目标字段名
		targetField := stdField
		if mapped, ok := mapping.FieldMapping[stdField]; ok {
			targetField = mapped
		}

		// 值映射
		finalValue := value
		if valueMap, ok := mapping.ValueMapping[stdField]; ok {
			if strValue, ok := value.(string); ok {
				if mappedValue, ok := valueMap[strValue]; ok {
					finalValue = mappedValue
				}
			}
		}

		// 类型转换
		if typeConv, ok := mapping.TypeConvert[stdField]; ok {
			finalValue = m.convertType(finalValue, typeConv)
		}

		result[targetField] = finalValue
	}

	// 3. 计算参数
	for targetField, template := range mapping.ComputedParams {
		computed := m.computeParam(template, standardParams)
		if computed != "" {
			result[targetField] = computed
		}
	}

	return result, nil
}

// convertType 执行类型转换
func (m *ParamMapper) convertType(value any, conv ParamTypeConversion) any {
	sep := conv.Separator
	if sep == "" {
		sep = ","
	}
	// 处理转义的换行符
	sep = strings.ReplaceAll(sep, "\\n", "\n")

	switch conv.Type {
	case "array_to_string":
		// 数组转为分隔符连接的字符串（用于三方接口期望字符串的情况）
		if arr, ok := value.([]any); ok {
			parts := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					parts = append(parts, s)
				} else {
					parts = append(parts, fmt.Sprintf("%v", v))
				}
			}
			return strings.Join(parts, sep)
		}
		if arr, ok := value.([]string); ok {
			return strings.Join(arr, sep)
		}
		// 已经是字符串，直接返回
		if str, ok := value.(string); ok {
			return str
		}
	case "string_to_array":
		// 字符串拆分为数组（用于三方接口期望数组的情况）
		if str, ok := value.(string); ok {
			if str == "" {
				return []string{}
			}
			parts := strings.Split(str, sep)
			result := make([]string, 0, len(parts))
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					result = append(result, p)
				}
			}
			return result
		}
		// 已经是数组，转换元素类型
		if arr, ok := value.([]any); ok {
			result := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					result = append(result, s)
				}
			}
			return result
		}
	}
	return value
}

// computeParam 计算模板参数，如 "{width}x{height}"
func (m *ParamMapper) computeParam(template string, params map[string]any) string {
	re := regexp.MustCompile(`\{(\w+)\}`)
	hasAllParams := true

	result := re.ReplaceAllStringFunc(template, func(match string) string {
		key := strings.Trim(match, "{}")
		if val, ok := params[key]; ok {
			return fmt.Sprintf("%v", val)
		}
		hasAllParams = false
		return ""
	})

	if !hasAllParams {
		return ""
	}
	return result
}

// ParseParamMapping 解析参数映射配置
func ParseParamMapping(data json.RawMessage) (*ParamMapping, error) {
	if len(data) == 0 {
		return nil, nil
	}
	var mapping ParamMapping
	if err := json.Unmarshal(data, &mapping); err != nil {
		return nil, err
	}
	return &mapping, nil
}
