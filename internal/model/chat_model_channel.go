package model

import "encoding/json"

// ChatModelChannel 模型渠道映射
type ChatModelChannel struct {
	BaseModel
	ModelCode    string          `gorm:"type:varchar(50);not null;index;comment:模型标识" json:"model_code"`
	ChannelID    uint            `gorm:"not null;index;comment:渠道ID" json:"channel_id"`
	VendorModel  string          `gorm:"type:varchar(50);not null;comment:供应商模型名" json:"vendor_model"`
	Priority     int             `gorm:"default:0;comment:优先级" json:"priority"`
	PriceMode    string          `gorm:"type:varchar(10);default:'token';comment:计价模式" json:"price_mode"`
	InputPrice   float64         `gorm:"type:decimal(12,8);default:0;comment:输入价格($/1M tokens)" json:"input_price"`
	OutputPrice  float64         `gorm:"type:decimal(12,8);default:0;comment:输出价格($/1M tokens)" json:"output_price"`
	RequestPath  string          `gorm:"type:varchar(255);default:'/v1/chat/completions';comment:请求路径" json:"request_path"`
	Timeout      int             `gorm:"default:120;comment:超时时间" json:"timeout"`
	ExtraHeaders json.RawMessage `gorm:"type:json;comment:额外请求头" json:"extra_headers"`
	ExtraConfig  json.RawMessage `gorm:"type:json;comment:扩展配置" json:"extra_config"`
	Status       int8            `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`

	// 关联
	ChatModel *ChatModel `gorm:"foreignKey:ModelCode;references:Code" json:"chat_model,omitempty"`
	Channel   *Channel   `gorm:"foreignKey:ChannelID" json:"channel,omitempty"`
}

func (ChatModelChannel) TableName() string {
	return "chat_model_channels"
}

// 计价模式
const (
	PriceModeToken   = "token"
	PriceModeRequest = "request"
)
