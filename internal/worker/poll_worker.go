package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/internal/provider"
	"github.com/majingzhen/prism/pkg/logger"
	"github.com/majingzhen/prism/pkg/queue"
	"go.uber.org/zap"
)

const MaxPollCount = 360 // 约 30 分钟

func HandleTaskPoll(ctx context.Context, t *asynq.Task) error {
	var payload TaskPollPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	logger.Info("processing poll task", zap.Uint("task_id", payload.TaskID), zap.Int("poll_count", payload.PollCount))

	// 超时保护
	if payload.PollCount >= MaxPollCount {
		taskService.UpdateTaskFail(payload.TaskID, "poll timeout")
		decrementAccountTasks(payload.TaskID)
		return nil
	}

	// 1. 获取任务
	task, err := taskService.GetTaskByID(payload.TaskID)
	if err != nil {
		return fmt.Errorf("get task: %w", err)
	}

	// 任务已完成，不再轮询
	if task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailed {
		return nil
	}

	// 2. 获取渠道信息
	var channel model.Channel
	model.DB().First(&channel, task.ChannelID)

	var account model.ChannelAccount
	model.DB().First(&account, task.AccountID)

	var channelCapability model.ChannelCapability
	model.DB().First(&channelCapability, task.ChannelCapabilityID)

	// 3. 创建 Provider 并查询进度
	prov, err := provider.NewProvider(&channel, &account, &channelCapability)
	if err != nil {
		return fmt.Errorf("create provider: %w", err)
	}

	result, err := prov.GetProgress(ctx, task.VendorTaskID)
	if err != nil {
		logger.Error("get progress error", zap.Error(err))
		// 继续轮询
		return requeuePoll(payload.TaskID, payload.PollCount+1)
	}

	logger.Info("poll result", zap.String("status", string(result.Status)), zap.Int("progress", result.Progress))

	// 4. 处理结果
	switch result.Status {
	case provider.StatusSuccess:
		// 更新进度
		taskService.UpdateTaskProgress(task.ID, 100)
		// 入队上传任务
		originURL := ""
		if len(result.URLs) > 0 {
			originURL = result.URLs[0]
		}
		return enqueueUpload(task.ID, originURL, result.URLs)

	case provider.StatusFail:
		taskService.UpdateTaskFail(task.ID, result.Error)
		decrementAccountTasks(task.ID)
		return nil

	case provider.StatusProcessing, provider.StatusSubmitted, provider.StatusPending:
		// 更新进度
		taskService.UpdateTaskProgress(task.ID, result.Progress)
		// 继续轮询
		return requeuePoll(payload.TaskID, payload.PollCount+1)
	}

	return nil
}

func requeuePoll(taskID uint, pollCount int) error {
	payload := TaskPollPayload{
		TaskID:    taskID,
		PollCount: pollCount,
	}
	payloadBytes, _ := json.Marshal(payload)
	task := asynq.NewTask(TypeTaskPoll, payloadBytes)
	_, err := queue.Client.Enqueue(task, asynq.ProcessIn(5*time.Second))
	return err
}

func enqueueUpload(taskID uint, originURL string, urls []string) error {
	payload := TaskUploadPayload{
		TaskID:    taskID,
		OriginURL: originURL,
		URLs:      urls,
	}
	payloadBytes, _ := json.Marshal(payload)
	task := asynq.NewTask(TypeTaskUpload, payloadBytes)
	_, err := queue.Client.Enqueue(task)
	return err
}

func decrementAccountTasks(taskID uint) {
	task, err := taskService.GetTaskByID(taskID)
	if err == nil {
		strategyService.DecrementAccountTasks(task.AccountID)
	}
}
