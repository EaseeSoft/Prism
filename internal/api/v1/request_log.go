package v1

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/service"
	"github.com/majingzhen/prism/pkg/errors"
)

var requestLogService = service.NewRequestLogService()

// ListRequestLogs 获取渠道请求日志列表
func ListRequestLogs(c *gin.Context) {
	var req service.ListRequestLogsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, err.Error()))
		return
	}

	resp, err := requestLogService.ListRequestLogs(&req)
	if err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	// 转换为前端友好的格式
	items := make([]gin.H, len(resp.Items))
	for i, log := range resp.Items {
		item := gin.H{
			"id":              log.ID,
			"task_id":         log.TaskID,
			"task_no":         log.TaskNo,
			"channel_id":      log.ChannelID,
			"account_id":      log.AccountID,
			"capability_code": log.CapabilityCode,
			"request_type":    log.RequestType,
			"method":          log.Method,
			"url":             log.URL,
			"request_headers": log.RequestHeaders,
			"request_body":    log.RequestBody,
			"status_code":     log.StatusCode,
			"response_body":   log.ResponseBody,
			"duration_ms":     log.DurationMs,
			"error_message":   log.ErrorMessage,
			"request_at":      log.RequestAt,
			"created_at":      log.CreatedAt,
		}
		if log.Channel != nil {
			item["channel_name"] = log.Channel.Name
			item["channel_type"] = log.Channel.Type
		}
		if log.Capability != nil {
			item["capability_name"] = log.Capability.Name
		}
		items[i] = item
	}

	successResponse(c, gin.H{
		"items":     items,
		"total":     resp.Total,
		"page":      resp.Page,
		"page_size": resp.PageSize,
	})
}

// GetRequestLog 获取单个请求日志详情
func GetRequestLog(c *gin.Context) {
	idStr := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid id"))
		return
	}

	log, err := requestLogService.GetRequestLog(id)
	if err != nil {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	result := gin.H{
		"id":              log.ID,
		"task_id":         log.TaskID,
		"task_no":         log.TaskNo,
		"channel_id":      log.ChannelID,
		"account_id":      log.AccountID,
		"capability_code": log.CapabilityCode,
		"request_type":    log.RequestType,
		"method":          log.Method,
		"url":             log.URL,
		"request_headers": log.RequestHeaders,
		"request_body":    log.RequestBody,
		"status_code":     log.StatusCode,
		"response_body":   log.ResponseBody,
		"duration_ms":     log.DurationMs,
		"error_message":   log.ErrorMessage,
		"request_at":      log.RequestAt,
		"created_at":      log.CreatedAt,
	}
	if log.Channel != nil {
		result["channel_name"] = log.Channel.Name
		result["channel_type"] = log.Channel.Type
	}
	if log.Capability != nil {
		result["capability_name"] = log.Capability.Name
	}

	successResponse(c, result)
}

// RetryRequest 重试请求
func RetryRequest(c *gin.Context) {
	idStr := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		badRequest(c, errors.WithMessage(errors.ErrInvalidParams, "invalid id"))
		return
	}

	newLog, err := requestLogService.RetryRequest(id)
	if err != nil {
		internalError(c, errors.ErrInternalError)
		return
	}

	result := gin.H{
		"id":              newLog.ID,
		"task_id":         newLog.TaskID,
		"task_no":         newLog.TaskNo,
		"channel_id":      newLog.ChannelID,
		"account_id":      newLog.AccountID,
		"capability_code": newLog.CapabilityCode,
		"request_type":    newLog.RequestType,
		"method":          newLog.Method,
		"url":             newLog.URL,
		"request_headers": newLog.RequestHeaders,
		"request_body":    newLog.RequestBody,
		"status_code":     newLog.StatusCode,
		"response_body":   newLog.ResponseBody,
		"duration_ms":     newLog.DurationMs,
		"error_message":   newLog.ErrorMessage,
		"request_at":      newLog.RequestAt,
		"created_at":      newLog.CreatedAt,
	}
	if newLog.Channel != nil {
		result["channel_name"] = newLog.Channel.Name
		result["channel_type"] = newLog.Channel.Type
	}
	if newLog.Capability != nil {
		result["capability_name"] = newLog.Capability.Name
	}

	successResponse(c, result)
}
