package model

import "encoding/json"

type Channel struct {
	BaseModel
	Type    string          `gorm:"type:varchar(20);uniqueIndex;not null;comment:渠道类型标识" json:"type"`
	Name    string          `gorm:"type:varchar(50);comment:渠道名称" json:"name"`
	BaseURL string          `gorm:"type:varchar(255);comment:基础URL" json:"base_url"`
	Config  json.RawMessage `gorm:"type:json;comment:渠道配置(JSON)" json:"config"`
	Status  int8            `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`
}

func (Channel) TableName() string {
	return "channels"
}
