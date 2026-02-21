package service

import (
	"github.com/majingzhen/prism/internal/model"
	"gorm.io/gorm"
)

type ConversationService struct{}

func NewConversationService() *ConversationService {
	return &ConversationService{}
}

// ListConversationsRequest 查询对话列表参数
type ListConversationsRequest struct {
	Page      int    `form:"page"`
	PageSize  int    `form:"page_size"`
	UserID    uint   `form:"user_id"`
	Model     string `form:"model"`
	Keyword   string `form:"keyword"`
	TokenID   uint   `form:"token_id"`
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
}

// ConversationItem 对话列表项
type ConversationItem struct {
	model.Conversation
	TotalCost float64 `json:"total_cost"`
}

// ListConversationsResponse 查询对话列表响应
type ListConversationsResponse struct {
	Items    []ConversationItem `json:"items"`
	Total    int64              `json:"total"`
	Page     int                `json:"page"`
	PageSize int                `json:"page_size"`
}

// ListConversations 查询对话列表
func (s *ConversationService) ListConversations(req *ListConversationsRequest) (*ListConversationsResponse, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}

	db := model.DB()

	// 构建子查询计算 total_cost
	costSubQuery := db.Table("messages").
		Select("conversation_id, SUM(cost) as total_cost").
		Group("conversation_id")

	query := db.Model(&model.Conversation{}).
		Select("conversations.*, COALESCE(cost_sub.total_cost, 0) as total_cost").
		Joins("LEFT JOIN (?) as cost_sub ON cost_sub.conversation_id = conversations.id", costSubQuery)

	// 筛选条件
	if req.UserID > 0 {
		query = query.Where("conversations.user_id = ?", req.UserID)
	}
	if req.Model != "" {
		query = query.Where("conversations.model = ?", req.Model)
	}
	if req.Keyword != "" {
		query = query.Where("conversations.title LIKE ?", "%"+req.Keyword+"%")
	}
	if req.TokenID > 0 {
		query = query.Where("conversations.token_id = ?", req.TokenID)
	}
	if req.StartDate != "" {
		query = query.Where("conversations.created_at >= ?", req.StartDate+" 00:00:00")
	}
	if req.EndDate != "" {
		query = query.Where("conversations.created_at <= ?", req.EndDate+" 23:59:59")
	}

	// 总数 - 需要单独查询不带 cost 子查询
	countQuery := db.Model(&model.Conversation{})
	if req.UserID > 0 {
		countQuery = countQuery.Where("user_id = ?", req.UserID)
	}
	if req.Model != "" {
		countQuery = countQuery.Where("model = ?", req.Model)
	}
	if req.Keyword != "" {
		countQuery = countQuery.Where("title LIKE ?", "%"+req.Keyword+"%")
	}
	if req.TokenID > 0 {
		countQuery = countQuery.Where("token_id = ?", req.TokenID)
	}
	if req.StartDate != "" {
		countQuery = countQuery.Where("created_at >= ?", req.StartDate+" 00:00:00")
	}
	if req.EndDate != "" {
		countQuery = countQuery.Where("created_at <= ?", req.EndDate+" 23:59:59")
	}

	var total int64
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询
	var items []ConversationItem
	offset := (req.Page - 1) * req.PageSize
	if err := query.Order("conversations.id DESC").
		Offset(offset).Limit(req.PageSize).
		Scan(&items).Error; err != nil {
		return nil, err
	}

	return &ListConversationsResponse{
		Items:    items,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetConversation 获取单个对话
func (s *ConversationService) GetConversation(id uint) (*model.Conversation, error) {
	var conversation model.Conversation
	if err := model.DB().First(&conversation, id).Error; err != nil {
		return nil, err
	}
	return &conversation, nil
}

// ListMessagesRequest 查询消息列表参数
type ListMessagesRequest struct {
	ConversationID uint `form:"conversation_id"`
	Page           int  `form:"page"`
	PageSize       int  `form:"page_size"`
}

// ListMessagesResponse 查询消息列表响应
type ListMessagesResponse struct {
	Items        []model.Message     `json:"items"`
	Total        int64               `json:"total"`
	Page         int                 `json:"page"`
	PageSize     int                 `json:"page_size"`
	Conversation *model.Conversation `json:"conversation"`
}

// ListMessages 查询消息列表
func (s *ConversationService) ListMessages(conversationID uint, page, pageSize int) (*ListMessagesResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}

	db := model.DB()

	// 获取对话信息
	var conversation model.Conversation
	if err := db.First(&conversation, conversationID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, err
		}
		return nil, err
	}

	// 总数
	var total int64
	if err := db.Model(&model.Message{}).Where("conversation_id = ?", conversationID).Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询，按创建时间正序
	var items []model.Message
	offset := (page - 1) * pageSize
	if err := db.Where("conversation_id = ?", conversationID).
		Order("created_at ASC").
		Offset(offset).Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	return &ListMessagesResponse{
		Items:        items,
		Total:        total,
		Page:         page,
		PageSize:     pageSize,
		Conversation: &conversation,
	}, nil
}
