package service

import (
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

type RequestLogService struct{}

func NewRequestLogService() *RequestLogService {
	return &RequestLogService{}
}

// Log 异步写入请求日志
func (s *RequestLogService) Log(log *model.ChannelRequestLog) {
	go func() {
		if err := model.DB().Create(log).Error; err != nil {
			logger.Error("save request log failed", zap.Error(err))
		}
	}()
}

// ListRequestLogsRequest 查询请求日志参数
type ListRequestLogsRequest struct {
	Page           int    `form:"page"`
	PageSize       int    `form:"page_size"`
	ChannelID      uint   `form:"channel_id"`
	CapabilityCode string `form:"capability_code"`
	RequestType    string `form:"request_type"`
	TaskNo         string `form:"task_no"`
	StartDate      string `form:"start_date"`
	EndDate        string `form:"end_date"`
}

// ListRequestLogsResponse 查询请求日志响应
type ListRequestLogsResponse struct {
	Items    []model.ChannelRequestLog `json:"items"`
	Total    int64                     `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"page_size"`
}

// ListRequestLogs 查询请求日志
func (s *RequestLogService) ListRequestLogs(req *ListRequestLogsRequest) (*ListRequestLogsResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}

	query := model.DB().Model(&model.ChannelRequestLog{})

	// 筛选条件
	if req.ChannelID > 0 {
		query = query.Where("channel_id = ?", req.ChannelID)
	}
	if req.CapabilityCode != "" {
		query = query.Where("capability_code = ?", req.CapabilityCode)
	}
	if req.RequestType != "" {
		query = query.Where("request_type = ?", req.RequestType)
	}
	if req.TaskNo != "" {
		query = query.Where("task_no LIKE ?", "%"+req.TaskNo+"%")
	}
	if req.StartDate != "" {
		query = query.Where("request_at >= ?", req.StartDate+" 00:00:00")
	}
	if req.EndDate != "" {
		query = query.Where("request_at <= ?", req.EndDate+" 23:59:59")
	}

	// 总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询
	var items []model.ChannelRequestLog
	offset := (req.Page - 1) * req.PageSize
	if err := query.Preload("Channel").Preload("Capability").
		Order("id DESC").
		Offset(offset).Limit(req.PageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	return &ListRequestLogsResponse{
		Items:    items,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetRequestLog 获取单个请求日志详情
func (s *RequestLogService) GetRequestLog(id uint) (*model.ChannelRequestLog, error) {
	var log model.ChannelRequestLog
	if err := model.DB().Preload("Channel").Preload("Capability").First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}
