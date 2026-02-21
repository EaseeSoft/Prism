package model

// ChatModel 语言模型
type ChatModel struct {
	BaseModel
	Code        string `gorm:"type:varchar(50);uniqueIndex;not null;comment:模型标识" json:"code"`
	Name        string `gorm:"type:varchar(100);not null;comment:显示名称" json:"name"`
	Provider    string `gorm:"type:varchar(30);not null;comment:提供商类型" json:"provider"`
	Description string `gorm:"type:varchar(500);comment:模型描述" json:"description"`
	Status      int8   `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`
}

func (ChatModel) TableName() string {
	return "chat_models"
}

// Provider 类型常量
const (
	ProviderOpenAI    = "openai"
	ProviderAnthropic = "anthropic"
	ProviderGoogle    = "google"
	ProviderDeepSeek  = "deepseek"
	ProviderQwen      = "qwen"
	ProviderMoonshot  = "moonshot"
)
