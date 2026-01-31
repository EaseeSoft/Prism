package worker

import (
	"context"
	"time"

	"github.com/hibiken/asynq"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

const TypeTaskTimeoutCheck = "task:timeout_check"

// HandleTaskTimeoutCheck 检查超时任务
func HandleTaskTimeoutCheck(ctx context.Context, t *asynq.Task) error {
	logger.Info("checking timeout tasks")

	// 查找 30 分钟前提交但仍在处理中的任务
	timeout := time.Now().Add(-30 * time.Minute)

	var tasks []model.Task
	err := model.DB().Where("status = ? AND updated_at < ?",
		model.TaskStatusProcessing,
		timeout,
	).Find(&tasks).Error

	if err != nil {
		logger.Error("query timeout tasks error", zap.Error(err))
		return nil
	}

	for _, task := range tasks {
		logger.Warn("task timeout", zap.Uint("task_id", task.ID), zap.String("task_no", task.TaskNo))
		taskService.UpdateTaskFail(task.ID, "task timeout")
		strategyService.DecrementAccountTasks(task.AccountID)
	}

	logger.Info("timeout check completed", zap.Int("count", len(tasks)))

	return nil
}

func NewTimeoutCheckTask() *asynq.Task {
	return asynq.NewTask(TypeTaskTimeoutCheck, nil)
}
