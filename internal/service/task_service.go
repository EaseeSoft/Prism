package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

var (
	ErrTaskNotFound = errors.New("task not found")
	billingService  = NewBillingService()
)

type CreateTaskRequest struct {
	UserID              uint
	TokenID             uint
	CapabilityCode      string
	ChannelID           uint
	ChannelCapabilityID uint
	AccountID           uint
	RequestParams       map[string]any
	MappedParams        map[string]any
	CallbackURL         string
	Cost                float64
}

type TaskService struct{}

func NewTaskService() *TaskService {
	return &TaskService{}
}

// GenerateTaskNo 生成任务编号
func GenerateTaskNo() string {
	return fmt.Sprintf("task_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:8])
}

func (s *TaskService) CreateTask(req *CreateTaskRequest) (*model.Task, error) {
	requestParamsJSON, _ := json.Marshal(req.RequestParams)
	mappedParamsJSON, _ := json.Marshal(req.MappedParams)

	task := &model.Task{
		TaskNo:              GenerateTaskNo(),
		UserID:              req.UserID,
		TokenID:             req.TokenID,
		CapabilityCode:      req.CapabilityCode,
		ChannelID:           req.ChannelID,
		ChannelCapabilityID: req.ChannelCapabilityID,
		AccountID:           req.AccountID,
		RequestParams:       requestParamsJSON,
		MappedParams:        mappedParamsJSON,
		Status:              model.TaskStatusPending,
		CallbackURL:         req.CallbackURL,
		Cost:                req.Cost,
	}

	if err := model.DB().Create(task).Error; err != nil {
		return nil, err
	}

	logger.Info("task created",
		zap.Uint("task_id", task.ID),
		zap.String("task_no", task.TaskNo),
		zap.String("capability", task.CapabilityCode))

	return task, nil
}

func (s *TaskService) GetTaskByNo(taskNo string) (*model.Task, error) {
	var task model.Task
	err := model.DB().Where("task_no = ?", taskNo).First(&task).Error
	if err != nil {
		return nil, ErrTaskNotFound
	}
	return &task, nil
}

func (s *TaskService) GetTaskByNoAndUser(taskNo string, userID uint) (*model.Task, error) {
	var task model.Task
	err := model.DB().Where("task_no = ? AND user_id = ?", taskNo, userID).First(&task).Error
	if err != nil {
		return nil, ErrTaskNotFound
	}
	return &task, nil
}

func (s *TaskService) GetTaskByID(id uint) (*model.Task, error) {
	var task model.Task
	err := model.DB().Where("id = ?", id).First(&task).Error
	if err != nil {
		return nil, ErrTaskNotFound
	}
	return &task, nil
}

func (s *TaskService) GetTaskByVendorID(vendorTaskID string) (*model.Task, error) {
	var task model.Task
	err := model.DB().Where("vendor_task_id = ?", vendorTaskID).First(&task).Error
	if err != nil {
		return nil, ErrTaskNotFound
	}
	return &task, nil
}

func (s *TaskService) UpdateTaskStatus(taskID uint, status model.TaskStatus, vendorTaskID string) error {
	updates := map[string]any{
		"status": status,
	}
	if vendorTaskID != "" {
		updates["vendor_task_id"] = vendorTaskID
	}
	if status == model.TaskStatusProcessing {
		now := time.Now()
		updates["started_at"] = now
	}

	logger.Info("task status changed",
		zap.Uint("task_id", taskID),
		zap.String("status", string(status)),
		zap.String("vendor_task_id", vendorTaskID))

	return model.DB().Model(&model.Task{}).Where("id = ?", taskID).Updates(updates).Error
}

func (s *TaskService) UpdateTaskProgress(taskID uint, progress int) error {
	logger.Debug("task progress updated",
		zap.Uint("task_id", taskID),
		zap.Int("progress", progress))

	return model.DB().Model(&model.Task{}).Where("id = ?", taskID).
		Update("progress", progress).Error
}

func (s *TaskService) UpdateTaskSuccess(taskID uint, result map[string]any, cost float64) error {
	resultJSON, _ := json.Marshal(result)
	now := time.Now()

	logger.Info("task succeeded", zap.Uint("task_id", taskID))

	return model.DB().Model(&model.Task{}).Where("id = ?", taskID).Updates(map[string]any{
		"status":       model.TaskStatusSuccess,
		"progress":     100,
		"result":       resultJSON,
		"cost":         cost,
		"completed_at": now,
	}).Error
}

func (s *TaskService) UpdateTaskFail(taskID uint, errMsg string) error {
	now := time.Now()

	logger.Warn("task failed",
		zap.Uint("task_id", taskID),
		zap.String("error", errMsg))

	var task model.Task
	if err := model.DB().First(&task, taskID).Error; err != nil {
		return ErrTaskNotFound
	}

	updates := map[string]any{
		"status":        model.TaskStatusFailed,
		"error_message": errMsg,
		"completed_at":  now,
	}

	if task.Cost > 0 && !task.Refunded {
		if err := billingService.Refund(task.TokenID, task.UserID, task.Cost); err != nil {
			logger.Error("refund failed",
				zap.Uint("task_id", task.ID),
				zap.Uint("token_id", task.TokenID),
				zap.Uint("user_id", task.UserID),
				zap.Float64("cost", task.Cost),
				zap.Error(err))
		} else {
			updates["refunded"] = true
		}
	}

	return model.DB().Model(&model.Task{}).Where("id = ?", taskID).Updates(updates).Error
}

func (s *TaskService) UpdateVendorResponse(taskID uint, resp json.RawMessage) error {
	return model.DB().Model(&model.Task{}).Where("id = ?", taskID).
		Update("vendor_response", resp).Error
}

func (s *TaskService) CancelTask(taskNo string, userID uint) error {
	result := model.DB().Model(&model.Task{}).
		Where("task_no = ? AND user_id = ? AND status IN ?", taskNo, userID,
			[]model.TaskStatus{model.TaskStatusPending, model.TaskStatusProcessing}).
		Update("status", model.TaskStatusCancelled)
	if result.RowsAffected == 0 {
		return errors.New("task not found or cannot be cancelled")
	}
	return result.Error
}

func (s *TaskService) UpdateCallbackStatus(taskID uint, status string, attempts int) error {
	return model.DB().Model(&model.Task{}).Where("id = ?", taskID).Updates(map[string]any{
		"callback_status":   status,
		"callback_attempts": attempts,
	}).Error
}
