package model

import "time"

// Message 消息
type Message struct {
	ID             uint      `gorm:"primarykey;comment:主键ID" json:"id"`
	ConversationID uint      `gorm:"not null;index:idx_conversation_created;comment:对话ID" json:"conversation_id"`
	Role           string    `gorm:"type:varchar(20);not null;comment:角色" json:"role"`
	Content        string    `gorm:"type:mediumtext;not null;comment:内容" json:"content"`
	InputTokens    int       `gorm:"default:0;comment:输入token" json:"input_tokens"`
	OutputTokens   int       `gorm:"default:0;comment:输出token" json:"output_tokens"`
	Model          string    `gorm:"type:varchar(50);comment:使用模型" json:"model"`
	ChannelID      uint      `gorm:"default:0;comment:渠道ID" json:"channel_id"`
	AccountID      uint      `gorm:"default:0;comment:账号ID" json:"account_id"`
	LatencyMs      int       `gorm:"default:0;comment:耗时毫秒" json:"latency_ms"`
	Cost           float64   `gorm:"type:decimal(10,6);default:0;comment:费用" json:"cost"`
	CreatedAt      time.Time `gorm:"index:idx_conversation_created;comment:创建时间" json:"created_at"`
}

func (Message) TableName() string {
	return "messages"
}

// Role 常量
const (
	RoleSystem    = "system"
	RoleUser      = "user"
	RoleAssistant = "assistant"
)
