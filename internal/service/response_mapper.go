package service

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// ResponseMapping 响应映射配置
type ResponseMapping struct {
	FieldMapping     map[string]string            `json:"field_mapping"`
	ValueMapping     map[string]map[string]string `json:"value_mapping"`
	TypeConvert      map[string]TypeConversion    `json:"type_convert"`
	ArrayHandling    map[string]ArrayMapping      `json:"array_handling"`
	SuccessCondition *SuccessCondition            `json:"success_condition"`
}

// SuccessCondition 成功条件配置
type SuccessCondition struct {
	Field    string `json:"field"`    // 字段路径，支持 data.code 格式
	Operator string `json:"operator"` // 操作符: eq, ne, exists, not_exists, in, not_in, gt, gte, lt, lte
	Value    any    `json:"value"`    // 比较值（用于 eq, ne, gt, gte, lt, lte）
	Values   []any  `json:"values"`   // 值列表（用于 in, not_in）
}

// TypeConversion 类型转换配置
type TypeConversion struct {
	Type      string `json:"type"`      // string_to_array, array_to_string
	Separator string `json:"separator"` // 分隔符，如 "," 或 "\n"
}

type ArrayMapping struct {
	SourcePath  string            `json:"source_path"`
	ItemMapping map[string]string `json:"item_mapping"`
}

// ResponseMapper 响应映射器
type ResponseMapper struct{}

func NewResponseMapper() *ResponseMapper {
	return &ResponseMapper{}
}

// Map 将供应商响应映射为统一响应
func (m *ResponseMapper) Map(vendorResponse map[string]any, mappingConfig []byte) (map[string]any, error) {
	if len(mappingConfig) == 0 {
		return vendorResponse, nil
	}

	var mapping ResponseMapping
	if err := json.Unmarshal(mappingConfig, &mapping); err != nil {
		return nil, fmt.Errorf("invalid mapping config: %w", err)
	}

	result := make(map[string]any)

	// 字段映射
	for stdField, path := range mapping.FieldMapping {
		value := m.getValueByPath(vendorResponse, path)
		if value != nil {
			// 值映射
			if valueMap, ok := mapping.ValueMapping[stdField]; ok {
				if strValue, ok := value.(string); ok {
					if mappedValue, ok := valueMap[strValue]; ok {
						value = mappedValue
					}
				}
			}
			// 类型转换
			if typeConv, ok := mapping.TypeConvert[stdField]; ok {
				value = m.convertType(value, typeConv)
			}
			result[stdField] = value
		}
	}

	// 数组处理
	for stdField, arrayMapping := range mapping.ArrayHandling {
		sourceArray := m.getValueByPath(vendorResponse, arrayMapping.SourcePath)
		if arr, ok := sourceArray.([]any); ok {
			mappedArray := make([]map[string]any, 0, len(arr))
			for _, item := range arr {
				if itemMap, ok := item.(map[string]any); ok {
					mappedItem := make(map[string]any)
					for stdKey, srcKey := range arrayMapping.ItemMapping {
						if val, exists := itemMap[srcKey]; exists {
							mappedItem[stdKey] = val
						}
					}
					mappedArray = append(mappedArray, mappedItem)
				}
			}
			result[stdField] = mappedArray
		}
	}

	return result, nil
}

// convertType 执行类型转换
func (m *ResponseMapper) convertType(value any, conv TypeConversion) any {
	sep := conv.Separator
	if sep == "" {
		sep = ","
	}
	// 处理转义的换行符
	sep = strings.ReplaceAll(sep, "\\n", "\n")

	switch conv.Type {
	case "string_to_array":
		// 字符串按分隔符拆分为数组
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
		// 如果已经是数组，直接返回
		if arr, ok := value.([]any); ok {
			result := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					result = append(result, s)
				}
			}
			return result
		}
	case "array_to_string":
		// 数组合并为字符串
		if arr, ok := value.([]any); ok {
			parts := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					parts = append(parts, s)
				}
			}
			return strings.Join(parts, sep)
		}
		if arr, ok := value.([]string); ok {
			return strings.Join(arr, sep)
		}
		// 如果已经是字符串，直接返回
		if str, ok := value.(string); ok {
			return str
		}
	}
	return value
}

// getValueByPath 根据路径获取值，支持 data.output.images[0] 格式
func (m *ResponseMapper) getValueByPath(data map[string]any, path string) any {
	parts := strings.Split(path, ".")
	var current any = data

	for _, part := range parts {
		// 处理数组索引，如 images[0]
		if idx := strings.Index(part, "["); idx != -1 {
			key := part[:idx]
			indexStr := part[idx+1 : len(part)-1]
			index, _ := strconv.Atoi(indexStr)

			if m, ok := current.(map[string]any); ok {
				if arr, ok := m[key].([]any); ok && index < len(arr) {
					current = arr[index]
					continue
				}
			}
			return nil
		}

		if m, ok := current.(map[string]any); ok {
			current = m[part]
		} else {
			return nil
		}
	}

	return current
}

// ParseResponseMapping 解析响应映射配置
func ParseResponseMapping(data json.RawMessage) (*ResponseMapping, error) {
	if len(data) == 0 {
		return nil, nil
	}
	var mapping ResponseMapping
	if err := json.Unmarshal(data, &mapping); err != nil {
		return nil, err
	}
	return &mapping, nil
}

// CheckSuccess 根据配置检查响应是否成功
// 返回值: isSuccess(是否成功), isFailed(是否明确失败), 如果两者都为false则继续轮询
func (m *ResponseMapper) CheckSuccess(vendorResponse map[string]any, mappingConfig []byte) (isSuccess bool, isFailed bool) {
	if len(mappingConfig) == 0 {
		return false, false
	}

	var mapping ResponseMapping
	if err := json.Unmarshal(mappingConfig, &mapping); err != nil {
		return false, false
	}

	// 如果没有配置成功条件，使用默认逻辑（检查 status 字段）
	if mapping.SuccessCondition == nil {
		return false, false
	}

	return m.evaluateCondition(vendorResponse, mapping.SuccessCondition)
}

// evaluateCondition 评估成功条件
func (m *ResponseMapper) evaluateCondition(data map[string]any, cond *SuccessCondition) (isSuccess bool, isFailed bool) {
	if cond == nil || cond.Field == "" {
		return false, false
	}

	value := m.getValueByPath(data, cond.Field)

	switch cond.Operator {
	case "exists":
		return value != nil, value == nil
	case "not_exists":
		return value == nil, value != nil
	case "eq":
		return m.compareEqual(value, cond.Value), false
	case "ne":
		return !m.compareEqual(value, cond.Value), false
	case "in":
		return m.valueInList(value, cond.Values), false
	case "not_in":
		return !m.valueInList(value, cond.Values), false
	case "gt":
		result, ok := m.compareNumeric(value, cond.Value)
		if !ok {
			return false, false
		}
		return result > 0, false
	case "gte":
		result, ok := m.compareNumeric(value, cond.Value)
		if !ok {
			return false, false
		}
		return result >= 0, false
	case "lt":
		result, ok := m.compareNumeric(value, cond.Value)
		if !ok {
			return false, false
		}
		return result < 0, false
	case "lte":
		result, ok := m.compareNumeric(value, cond.Value)
		if !ok {
			return false, false
		}
		return result <= 0, false
	default:
		return false, false
	}
}

// compareEqual 比较两个值是否相等（支持类型转换）
func (m *ResponseMapper) compareEqual(a, b any) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// 转换为可比较的类型
	aStr := m.toComparableString(a)
	bStr := m.toComparableString(b)
	return aStr == bStr
}

// valueInList 检查值是否在列表中
func (m *ResponseMapper) valueInList(value any, list []any) bool {
	if value == nil || len(list) == 0 {
		return false
	}
	for _, item := range list {
		if m.compareEqual(value, item) {
			return true
		}
	}
	return false
}

// compareNumeric 数值比较，返回: -1(a<b), 0(a==b), 1(a>b)
func (m *ResponseMapper) compareNumeric(a, b any) (int, bool) {
	aFloat, aOk := m.toFloat64(a)
	bFloat, bOk := m.toFloat64(b)
	if !aOk || !bOk {
		return 0, false
	}
	if aFloat < bFloat {
		return -1, true
	}
	if aFloat > bFloat {
		return 1, true
	}
	return 0, true
}

// toComparableString 将值转换为可比较的字符串
func (m *ResponseMapper) toComparableString(v any) string {
	switch val := v.(type) {
	case string:
		return val
	case float64:
		if val == float64(int64(val)) {
			return strconv.FormatInt(int64(val), 10)
		}
		return strconv.FormatFloat(val, 'f', -1, 64)
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	case bool:
		return strconv.FormatBool(val)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// toFloat64 将值转换为 float64
func (m *ResponseMapper) toFloat64(v any) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case string:
		f, err := strconv.ParseFloat(val, 64)
		return f, err == nil
	default:
		return 0, false
	}
}
