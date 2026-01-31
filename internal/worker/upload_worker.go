package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/httputil"
	"github.com/majingzhen/prism/pkg/logger"
	"github.com/majingzhen/prism/pkg/queue"
	"github.com/majingzhen/prism/pkg/storage"
	"go.uber.org/zap"
)

func HandleTaskUpload(ctx context.Context, t *asynq.Task) error {
	var payload TaskUploadPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	logger.Info("processing upload task", zap.Uint("task_id", payload.TaskID))

	task, err := taskService.GetTaskByID(payload.TaskID)
	if err != nil {
		return fmt.Errorf("get task: %w", err)
	}

	// 获取渠道能力配置以获取价格
	var cc model.ChannelCapability
	model.DB().First(&cc, task.ChannelCapabilityID)

	// 获取原始URL
	originURL := payload.OriginURL
	if originURL == "" && len(payload.URLs) > 0 {
		originURL = payload.URLs[0]
	}

	// 如果没有配置存储或没有原始URL，直接使用原始URL
	if storage.DefaultStorage == nil || originURL == "" {
		result := buildResult(originURL, payload.URLs)
		taskService.UpdateTaskSuccess(task.ID, result, cc.Price)
		strategyService.DecrementAccountTasks(task.AccountID)
		if task.CallbackURL != "" {
			enqueueNotify(task.ID)
		}
		logger.Info("task upload completed (no transfer)", zap.Uint("task_id", task.ID))
		return nil
	}

	// 下载原始文件
	downloadResult, err := httputil.Download(ctx, originURL)
	if err != nil {
		logger.Error("download file failed", zap.Uint("task_id", task.ID), zap.Error(err))
		taskService.UpdateTaskFail(task.ID, "download failed: "+err.Error())
		strategyService.DecrementAccountTasks(task.AccountID)
		return nil
	}
	defer downloadResult.Body.Close()

	// 生成存储路径
	storagePath := generateStoragePath(task.CapabilityCode, originURL)

	// 上传到COS
	finalURL, err := storage.Upload(ctx, downloadResult.Body, storagePath, downloadResult.ContentType)
	if err != nil {
		logger.Error("upload to cos failed", zap.Uint("task_id", task.ID), zap.Error(err))
		taskService.UpdateTaskFail(task.ID, "upload failed: "+err.Error())
		strategyService.DecrementAccountTasks(task.AccountID)
		return nil
	}

	// 更新任务成功状态
	result := buildResult(finalURL, []string{finalURL})
	taskService.UpdateTaskSuccess(task.ID, result, cc.Price)
	strategyService.DecrementAccountTasks(task.AccountID)

	// 如果有回调地址，入队通知任务
	if task.CallbackURL != "" {
		enqueueNotify(task.ID)
	}

	logger.Info("task upload completed", zap.Uint("task_id", task.ID), zap.String("final_url", finalURL))

	return nil
}

// buildResult 构建结果对象
func buildResult(primaryURL string, urls []string) map[string]any {
	result := map[string]any{
		"url": primaryURL,
	}
	if len(urls) > 0 {
		result["urls"] = urls
	}
	return result
}

// generateStoragePath 生成存储路径
func generateStoragePath(capabilityCode string, originURL string) string {
	now := time.Now()
	ext := filepath.Ext(originURL)
	if ext == "" || len(ext) > 10 {
		// 根据能力类型判断文件扩展名
		if strings.Contains(capabilityCode, "video") {
			ext = ".mp4"
		} else {
			ext = ".png"
		}
	}
	// 去除ext中可能的查询参数
	if idx := strings.Index(ext, "?"); idx > 0 {
		ext = ext[:idx]
	}

	return fmt.Sprintf("%s/%s/%s%s", capabilityCode, now.Format("2006/01/02"), uuid.New().String(), ext)
}

func enqueueNotify(taskID uint) error {
	payload := TaskNotifyPayload{TaskID: taskID}
	payloadBytes, _ := json.Marshal(payload)
	task := asynq.NewTask(TypeTaskNotify, payloadBytes)
	_, err := queue.Client.Enqueue(task)
	return err
}
