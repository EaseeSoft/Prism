package model

// Conversation 对话
type Conversation struct {
	BaseModel
	UserID       uint   `gorm:"not null;index;comment:用户ID" json:"user_id"`
	TokenID      uint   `gorm:"not null;index;comment:Token ID" json:"token_id"`
	Title        string `gorm:"type:varchar(200);comment:对话标题" json:"title"`
	Model        string `gorm:"type:varchar(50);comment:最后使用模型" json:"model"`
	SystemPrompt string `gorm:"type:text;comment:系统提示词" json:"system_prompt"`
	TotalTokens  int    `gorm:"default:0;comment:累计token" json:"total_tokens"`
	MessageCount int    `gorm:"default:0;comment:消息数量" json:"message_count"`
	Status       int8   `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`
}

func (Conversation) TableName() string {
	return "conversations"
}
