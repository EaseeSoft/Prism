package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/internal/provider"
	"github.com/majingzhen/prism/internal/service"
	"github.com/majingzhen/prism/pkg/logger"
	"github.com/majingzhen/prism/pkg/queue"
	"go.uber.org/zap"
)

var (
	taskService     = service.NewTaskService()
	strategyService = service.NewStrategyService()
)

func HandleTaskSubmit(ctx context.Context, t *asynq.Task) error {
	var payload TaskSubmitPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	logger.Info("processing submit task", zap.Uint("task_id", payload.TaskID))

	// 1. 获取任务
	task, err := taskService.GetTaskByID(payload.TaskID)
	if err != nil {
		return fmt.Errorf("get task: %w", err)
	}

	// 2. 获取渠道信息
	var channel model.Channel
	if err := model.DB().First(&channel, task.ChannelID).Error; err != nil {
		return fmt.Errorf("get channel: %w", err)
	}

	var account model.ChannelAccount
	if err := model.DB().First(&account, task.AccountID).Error; err != nil {
		return fmt.Errorf("get account: %w", err)
	}

	var channelCapability model.ChannelCapability
	if err := model.DB().First(&channelCapability, task.ChannelCapabilityID).Error; err != nil {
		return fmt.Errorf("get channel capability: %w", err)
	}

	// 3. 创建 Provider
	prov, err := provider.NewProvider(&channel, &account, &channelCapability)
	if err != nil {
		taskService.UpdateTaskFail(task.ID, "create provider error: "+err.Error())
		return nil
	}

	// 4. 解析参数
	var mappedParams map[string]any
	json.Unmarshal(task.MappedParams, &mappedParams)

	// 5. 提交到上游
	submitReq := provider.SubmitRequest{
		TaskNo:      task.TaskNo,
		Params:      mappedParams,
		CallbackURL: task.CallbackURL,
	}

	result, err := prov.Submit(ctx, submitReq)
	if err != nil {
		taskService.UpdateTaskFail(task.ID, "submit error: "+err.Error())
		strategyService.DecrementAccountTasks(task.AccountID)
		return nil
	}

	// 6. 更新任务状态
	taskService.UpdateTaskStatus(task.ID, model.TaskStatusProcessing, result.ProviderTaskID)

	// 7. 根据 result_mode 入队
	if channelCapability.ResultMode == string(provider.ResultModePoll) {
		pollPayload := TaskPollPayload{
			TaskID:    task.ID,
			PollCount: 0,
		}
		payloadBytes, _ := json.Marshal(pollPayload)
		pollTask := asynq.NewTask(TypeTaskPoll, payloadBytes)
		queue.Client.Enqueue(pollTask, asynq.ProcessIn(time.Duration(channelCapability.PollInterval)*time.Second))
	}

	logger.Info("task submitted", zap.Uint("task_id", task.ID), zap.String("vendor_task_id", result.ProviderTaskID))

	return nil
}

func NewTaskSubmit(taskID uint) (*asynq.Task, error) {
	payload := TaskSubmitPayload{TaskID: taskID}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeTaskSubmit, payloadBytes), nil
}

func EnqueueTaskSubmit(taskID uint) error {
	task, err := NewTaskSubmit(taskID)
	if err != nil {
		return err
	}
	_, err = queue.Client.Enqueue(task)
	return err
}
