package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/hibiken/asynq"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

type CallbackPayload struct {
	TaskID   string         `json:"task_id"`
	Status   string         `json:"status"`
	Progress int            `json:"progress"`
	Result   map[string]any `json:"result,omitempty"`
	Error    string         `json:"error,omitempty"`
}

func HandleTaskNotify(ctx context.Context, t *asynq.Task) error {
	var payload TaskNotifyPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	logger.Info("processing notify task", zap.Uint("task_id", payload.TaskID))

	task, err := taskService.GetTaskByID(payload.TaskID)
	if err != nil {
		return fmt.Errorf("get task: %w", err)
	}

	if task.CallbackURL == "" {
		return nil
	}

	// 构造回调内容
	callbackData := CallbackPayload{
		TaskID:   task.TaskNo,
		Status:   string(task.Status),
		Progress: task.Progress,
	}

	if task.Status == model.TaskStatusSuccess {
		var result map[string]any
		json.Unmarshal(task.Result, &result)
		callbackData.Result = result
	} else if task.Status == model.TaskStatusFailed {
		callbackData.Error = task.ErrorMessage
	}

	// 发送回调
	bodyBytes, _ := json.Marshal(callbackData)
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Post(task.CallbackURL, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		logger.Error("callback failed", zap.Error(err))
		taskService.UpdateCallbackStatus(task.ID, model.CallbackStatusFailed, task.CallbackAttempts+1)
		return fmt.Errorf("callback error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		logger.Error("callback returned error", zap.Int("status", resp.StatusCode))
		taskService.UpdateCallbackStatus(task.ID, model.CallbackStatusFailed, task.CallbackAttempts+1)
		return fmt.Errorf("callback returned %d", resp.StatusCode)
	}

	taskService.UpdateCallbackStatus(task.ID, model.CallbackStatusSuccess, task.CallbackAttempts+1)
	logger.Info("callback sent", zap.Uint("task_id", task.ID))

	return nil
}
