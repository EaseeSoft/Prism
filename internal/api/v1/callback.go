package v1

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/internal/provider"
	"github.com/majingzhen/prism/internal/worker"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

func HandleCallback(c *gin.Context) {
	channelType := c.Param("channel_type")

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, 40003, "read body error")
		return
	}

	logger.Info("received callback", zap.String("channel_type", channelType), zap.String("body", string(body)))

	// 1. 获取渠道
	var channel model.Channel
	if err := model.DB().Where("type = ?", channelType).First(&channel).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 40004, "channel not found")
		return
	}

	// 2. 遍历该渠道下的所有回调模式 channel_capability 尝试解析
	var channelCapabilities []model.ChannelCapability
	model.DB().Where("channel_id = ? AND result_mode = 'callback'", channel.ID).Find(&channelCapabilities)

	var matchedTask *model.Task
	var matchedResult provider.ProgressResult

	parser := provider.NewDefaultParser()

	for _, cc := range channelCapabilities {
		// 优先使用 callback_mapping
		mappingData := cc.CallbackMapping
		if len(mappingData) == 0 {
			mappingData = cc.ResponseMapping
		}

		mapping, err := provider.ParseResponseMapping(mappingData)
		if err != nil || mapping == nil {
			continue
		}

		result, vendorTaskID, err := parser.ParseCallbackResponse(body, mapping)
		if err != nil || vendorTaskID == "" {
			continue
		}

		// 查找任务
		var task model.Task
		if err := model.DB().Where("vendor_task_id = ? AND channel_capability_id = ?", vendorTaskID, cc.ID).First(&task).Error; err != nil {
			continue
		}

		matchedTask = &task
		matchedResult = result
		break
	}

	if matchedTask == nil {
		logger.Warn("no matching task found for callback")
		successResponse(c, gin.H{"received": true, "matched": false})
		return
	}

	// 3. 处理回调结果
	worker.HandleCallbackResult(matchedTask, matchedResult)

	successResponse(c, gin.H{"received": true, "matched": true, "task_id": matchedTask.TaskNo})
}
