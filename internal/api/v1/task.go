package v1

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/api/middleware"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/errors"
)

type TaskResponse struct {
	ID        string         `json:"id"`
	Status    string         `json:"status"`
	Progress  int            `json:"progress"`
	Result    map[string]any `json:"result,omitempty"`
	Error     string         `json:"error,omitempty"`
	Cost      float64        `json:"cost,omitempty"`
	CreatedAt string         `json:"created_at"`
	UpdatedAt string         `json:"updated_at"`
}

func GetTask(c *gin.Context) {
	taskNo := c.Param("id")
	tokenID := middleware.GetTokenID(c)

	task, err := taskService.GetTaskByNo(taskNo)
	if err != nil {
		notFound(c, errors.ErrTaskNotFound)
		return
	}

	// 检查权限
	if task.TokenID != tokenID {
		forbidden(c, errors.ErrNoPermission)
		return
	}

	resp := TaskResponse{
		ID:        task.TaskNo,
		Status:    string(task.Status),
		Progress:  task.Progress,
		Cost:      task.Cost,
		CreatedAt: task.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: task.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}

	if task.Status == model.TaskStatusSuccess && len(task.Result) > 0 {
		var result map[string]any
		json.Unmarshal(task.Result, &result)
		resp.Result = result
	}

	if task.Status == model.TaskStatusFailed {
		resp.Error = task.ErrorMessage
	}

	successResponse(c, resp)
}
