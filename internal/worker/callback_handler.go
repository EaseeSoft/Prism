package worker

import (
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/internal/provider"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

func HandleCallbackResult(task *model.Task, result provider.ProgressResult) {
	logger.Info("handling callback result",
		zap.Uint("task_id", task.ID),
		zap.String("status", string(result.Status)))

	switch result.Status {
	case provider.StatusSuccess:
		// 入队上传任务
		originURL := ""
		if len(result.URLs) > 0 {
			originURL = result.URLs[0]
		}
		enqueueUpload(task.ID, originURL, result.URLs)

	case provider.StatusFail:
		taskService.UpdateTaskFail(task.ID, result.Error)
		strategyService.DecrementAccountTasks(task.AccountID)

	case provider.StatusProcessing:
		taskService.UpdateTaskProgress(task.ID, result.Progress)
	}
}
