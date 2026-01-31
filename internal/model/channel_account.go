package model

import "encoding/json"

type ChannelAccount struct {
	BaseModel
	ChannelID    uint            `gorm:"not null;index;comment:所属渠道ID" json:"channel_id"`
	Name         string          `gorm:"type:varchar(50);comment:账号名称" json:"name"`
	APIKey       string          `gorm:"type:text;comment:API密钥" json:"api_key"`
	Config       json.RawMessage `gorm:"type:json;comment:账号配置(JSON)" json:"config"`
	Weight       int             `gorm:"default:10;comment:负载均衡权重" json:"weight"`
	Status       int8            `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`
	CurrentTasks int             `gorm:"default:0;comment:当前任务数" json:"current_tasks"`
}

func (ChannelAccount) TableName() string {
	return "channel_accounts"
}
