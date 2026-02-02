package model

// TokenChannelPriority 令牌能力渠道优先级配置
type TokenChannelPriority struct {
	BaseModel
	TokenID        uint   `gorm:"not null;index:idx_token_capability;comment:令牌ID" json:"token_id"`
	CapabilityCode string `gorm:"type:varchar(30);not null;index:idx_token_capability;comment:能力编码" json:"capability_code"`
	ChannelID      uint   `gorm:"not null;comment:渠道ID" json:"channel_id"`
	Priority       int    `gorm:"default:1;comment:优先级(1最高)" json:"priority"`
}

func (TokenChannelPriority) TableName() string {
	return "token_channel_priorities"
}
