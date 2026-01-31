package model

type Token struct {
	BaseModel
	UserID    uint    `gorm:"default:0;index;comment:用户ID" json:"user_id"`
	Key       string  `gorm:"type:varchar(64);uniqueIndex;not null;comment:API密钥" json:"key"`
	Name      string  `gorm:"type:varchar(50);comment:令牌名称" json:"name"`
	Balance   float64 `gorm:"type:decimal(10,4);default:0;comment:剩余额度" json:"balance"`
	TotalUsed float64 `gorm:"type:decimal(10,4);default:0;comment:已使用额度" json:"total_used"`
	RateLimit int     `gorm:"default:60;comment:速率限制(次/分钟)" json:"rate_limit"`
	Status    int8    `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`
}

func (Token) TableName() string {
	return "tokens"
}
