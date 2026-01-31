package v1

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/api/middleware"
	"github.com/majingzhen/prism/internal/model"
	"gorm.io/gorm"
)

// DashboardStats 仪表盘统计数据
func DashboardStats(c *gin.Context) {
	db := model.DB()
	userID := middleware.GetUserID(c)
	role := middleware.GetUserRole(c)
	isAdmin := role == string(model.UserRoleAdmin)

	// 构建基础查询
	baseQuery := func() *gorm.DB {
		q := db.Model(&model.Task{})
		if !isAdmin {
			q = q.Where("user_id = ?", userID)
		}
		return q
	}

	// 今日统计
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	yesterdayStart := todayStart.AddDate(0, 0, -1)

	var todayStats struct {
		TotalRequests int64   `json:"total_requests"`
		TotalCost     float64 `json:"total_cost"`
		SuccessCount  int64   `json:"success_count"`
		FailedCount   int64   `json:"failed_count"`
	}

	// 今日请求数和费用
	baseQuery().
		Where("created_at >= ?", todayStart).
		Select("COUNT(*) as total_requests, COALESCE(SUM(cost), 0) as total_cost").
		Scan(&todayStats)

	// 今日成功/失败数
	baseQuery().
		Where("created_at >= ? AND status = ?", todayStart, model.TaskStatusSuccess).
		Count(&todayStats.SuccessCount)
	baseQuery().
		Where("created_at >= ? AND status = ?", todayStart, model.TaskStatusFailed).
		Count(&todayStats.FailedCount)

	// 昨日统计（用于对比）
	var yesterdayStats struct {
		TotalRequests int64   `json:"total_requests"`
		TotalCost     float64 `json:"total_cost"`
	}
	baseQuery().
		Where("created_at >= ? AND created_at < ?", yesterdayStart, todayStart).
		Select("COUNT(*) as total_requests, COALESCE(SUM(cost), 0) as total_cost").
		Scan(&yesterdayStats)

	// 计算错误率
	errorRate := float64(0)
	if todayStats.TotalRequests > 0 {
		errorRate = float64(todayStats.FailedCount) / float64(todayStats.TotalRequests) * 100
	}

	// 计算趋势
	requestTrend := float64(0)
	if yesterdayStats.TotalRequests > 0 {
		requestTrend = float64(todayStats.TotalRequests-yesterdayStats.TotalRequests) / float64(yesterdayStats.TotalRequests) * 100
	}
	costTrend := float64(0)
	if yesterdayStats.TotalCost > 0 {
		costTrend = (todayStats.TotalCost - yesterdayStats.TotalCost) / yesterdayStats.TotalCost * 100
	}

	// 过去7天的趋势数据
	type DailyStats struct {
		Date     string  `json:"date"`
		Requests int64   `json:"requests" gorm:"column:requests"`
		Cost     float64 `json:"cost" gorm:"column:cost"`
		Errors   int64   `json:"errors"`
	}
	var weeklyStats []DailyStats

	for i := 6; i >= 0; i-- {
		dayStart := todayStart.AddDate(0, 0, -i)
		dayEnd := dayStart.AddDate(0, 0, 1)

		var dayAgg struct {
			Requests int64   `gorm:"column:requests"`
			Cost     float64 `gorm:"column:cost"`
		}

		// 使用 Table 替代 Model 以确保 Scan 正确映射列名
		q := db.Table("tasks")
		if !isAdmin {
			q = q.Where("user_id = ?", userID)
		}
		q.Where("created_at >= ? AND created_at < ?", dayStart, dayEnd).
			Select("COUNT(*) as requests, COALESCE(SUM(cost), 0) as cost").
			Scan(&dayAgg)

		dayStat := DailyStats{
			Date:     dayStart.Format("01-02"),
			Requests: dayAgg.Requests,
			Cost:     dayAgg.Cost,
		}

		// 错误数单独查询
		var errCount int64
		eq := db.Table("tasks")
		if !isAdmin {
			eq = eq.Where("user_id = ?", userID)
		}
		eq.Where("created_at >= ? AND created_at < ? AND status = ?", dayStart, dayEnd, model.TaskStatusFailed).
			Count(&errCount)
		dayStat.Errors = errCount

		weeklyStats = append(weeklyStats, dayStat)
	}

	// 能力分布
	type CapabilityDist struct {
		Capability string `json:"capability"`
		Count      int64  `json:"count"`
	}
	var capabilityStats []CapabilityDist
	baseQuery().
		Where("created_at >= ?", todayStart.AddDate(0, 0, -7)).
		Select("capability_code as capability, COUNT(*) as count").
		Group("capability_code").
		Order("count DESC").
		Limit(5).
		Scan(&capabilityStats)

	successResponse(c, gin.H{
		"today": gin.H{
			"total_requests": todayStats.TotalRequests,
			"total_cost":     todayStats.TotalCost,
			"success_count":  todayStats.SuccessCount,
			"failed_count":   todayStats.FailedCount,
			"error_rate":     errorRate,
			"request_trend":  requestTrend,
			"cost_trend":     costTrend,
		},
		"weekly_trend":    weeklyStats,
		"capability_dist": capabilityStats,
	})
}

// ListTasks 任务列表（分页）
func ListTasks(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role := middleware.GetUserRole(c)
	isAdmin := role == string(model.UserRoleAdmin)

	var req struct {
		Page       int    `form:"page"`
		PageSize   int    `form:"page_size"`
		Status     string `form:"status"`
		Capability string `form:"capability"`
		StartDate  string `form:"start_date"`
		EndDate    string `form:"end_date"`
		Keyword    string `form:"keyword"`
	}
	c.ShouldBindQuery(&req)

	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	db := model.DB().Model(&model.Task{})

	// 根据角色过滤
	if !isAdmin {
		db = db.Where("user_id = ?", userID)
	}

	// 过滤条件
	if req.Status != "" {
		db = db.Where("status = ?", req.Status)
	}
	if req.Capability != "" {
		db = db.Where("capability_code = ?", req.Capability)
	}
	if req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			db = db.Where("created_at >= ?", t)
		}
	}
	if req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			db = db.Where("created_at < ?", t.AddDate(0, 0, 1))
		}
	}
	if req.Keyword != "" {
		db = db.Where("task_no LIKE ?", "%"+req.Keyword+"%")
	}

	// 总数
	var total int64
	db.Count(&total)

	// 分页查询
	var tasks []model.Task
	db.Order("created_at DESC").
		Offset((req.Page - 1) * req.PageSize).
		Limit(req.PageSize).
		Preload("Channel").
		Preload("Capability").
		Find(&tasks)

	// 转换响应
	type TaskItem struct {
		ID             string  `json:"id"`
		TaskNo         string  `json:"task_no"`
		Capability     string  `json:"capability"`
		CapabilityName string  `json:"capability_name"`
		Channel        string  `json:"channel"`
		Status         string  `json:"status"`
		Progress       int     `json:"progress"`
		Cost           float64 `json:"cost"`
		Refunded       bool    `json:"refunded"`
		Error          string  `json:"error,omitempty"`
		CreatedAt      string  `json:"created_at"`
		CompletedAt    string  `json:"completed_at,omitempty"`
	}

	items := make([]TaskItem, 0, len(tasks))
	for _, t := range tasks {
		item := TaskItem{
			ID:         t.TaskNo,
			TaskNo:     t.TaskNo,
			Capability: t.CapabilityCode,
			Status:     string(t.Status),
			Progress:   t.Progress,
			Cost:       t.Cost,
			Refunded:   t.Refunded,
			Error:      t.ErrorMessage,
			CreatedAt:  t.CreatedAt.Format("2006-01-02 15:04:05"),
		}
		if t.Capability != nil {
			item.CapabilityName = t.Capability.Name
		}
		if t.Channel != nil {
			item.Channel = t.Channel.Type
		}
		if t.CompletedAt != nil {
			item.CompletedAt = t.CompletedAt.Format("2006-01-02 15:04:05")
		}
		items = append(items, item)
	}

	successResponse(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      req.Page,
		"page_size": req.PageSize,
	})
}

// GetTaskDetail 获取任务详情
func GetTaskDetail(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role := middleware.GetUserRole(c)
	isAdmin := role == string(model.UserRoleAdmin)

	taskNo := c.Param("task_no")

	query := model.DB().Where("task_no = ?", taskNo)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}

	var task model.Task
	if err := query.
		Preload("Channel").
		Preload("Capability").
		First(&task).Error; err != nil {
		errorResponse(c, http.StatusNotFound, 404, "task not found")
		return
	}

	// 解析结果
	var result map[string]any
	if len(task.Result) > 0 {
		json.Unmarshal(task.Result, &result)
	}

	// 解析原始请求参数
	var rawParams map[string]any
	if len(task.RequestParams) > 0 {
		json.Unmarshal(task.RequestParams, &rawParams)
	}

	// 解析供应商响应（仅管理员可见）
	var vendorResponse map[string]any
	if isAdmin && len(task.VendorResponse) > 0 {
		json.Unmarshal(task.VendorResponse, &vendorResponse)
	}

	resp := gin.H{
		"task_no":        task.TaskNo,
		"capability":     task.CapabilityCode,
		"status":         task.Status,
		"progress":       task.Progress,
		"cost":           task.Cost,
		"refunded":       task.Refunded,
		"error":          task.ErrorMessage,
		"result":         result,
		"raw_params":     rawParams,
		"vendor_task_id": task.VendorTaskID,
		"created_at":     task.CreatedAt.Format("2006-01-02 15:04:05"),
	}

	// 仅管理员返回供应商响应
	if isAdmin {
		resp["vendor_response"] = vendorResponse
	}

	if task.Channel != nil {
		resp["channel"] = task.Channel.Type
	}
	if task.Capability != nil {
		resp["capability_name"] = task.Capability.Name
	}
	if task.StartedAt != nil {
		resp["started_at"] = task.StartedAt.Format("2006-01-02 15:04:05")
	}
	if task.CompletedAt != nil {
		resp["completed_at"] = task.CompletedAt.Format("2006-01-02 15:04:05")
	}

	successResponse(c, resp)
}
