package model

import (
	"time"

	"gorm.io/datatypes"
)

type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusProcessing TaskStatus = "processing"
	TaskStatusSuccess    TaskStatus = "success"
	TaskStatusFailed     TaskStatus = "failed"
	TaskStatusCancelled  TaskStatus = "cancelled"
)

// Task 任务记录
type Task struct {
	BaseModel
	TaskNo              string `gorm:"type:varchar(32);uniqueIndex;not null;comment:任务编号" json:"task_no"`
	UserID              uint   `gorm:"index;comment:用户ID" json:"user_id"`
	TokenID             uint   `gorm:"index;comment:令牌ID" json:"token_id"`
	CapabilityCode      string `gorm:"type:varchar(30);index;comment:能力编码" json:"capability_code"`
	ChannelID           uint   `gorm:"index;comment:渠道ID" json:"channel_id"`
	ChannelCapabilityID uint   `gorm:"comment:渠道能力配置ID" json:"channel_capability_id"`
	AccountID           uint   `gorm:"comment:渠道账号ID" json:"account_id"`
	VendorTaskID        string `gorm:"type:varchar(100);index;comment:供应商任务ID" json:"vendor_task_id"`

	Status   TaskStatus `gorm:"type:varchar(20);index;default:'pending';comment:任务状态" json:"status"`
	Progress int        `gorm:"default:0;comment:进度(0-100)" json:"progress"`

	CallbackURL      string `gorm:"type:varchar(500);comment:回调地址" json:"callback_url"`
	CallbackStatus   string `gorm:"type:varchar(20);comment:回调状态" json:"callback_status"`
	CallbackAttempts int    `gorm:"default:0;comment:回调尝试次数" json:"callback_attempts"`

	RequestParams  datatypes.JSON `gorm:"type:json;comment:原始请求参数" json:"request_params"`
	MappedParams   datatypes.JSON `gorm:"type:json;comment:映射后参数" json:"mapped_params"`
	VendorResponse datatypes.JSON `gorm:"type:json;comment:供应商原始响应" json:"vendor_response"`
	Result         datatypes.JSON `gorm:"type:json;comment:统一结果" json:"result"`
	ErrorMessage   string         `gorm:"type:text;comment:错误信息" json:"error_message"`

	Cost        float64    `gorm:"type:decimal(10,4);comment:费用" json:"cost"`
	Refunded    bool       `gorm:"default:false;comment:是否已退款" json:"refunded"`
	StartedAt   *time.Time `gorm:"comment:开始时间" json:"started_at"`
	CompletedAt *time.Time `gorm:"comment:完成时间" json:"completed_at"`

	// 关联
	Channel           *Channel           `gorm:"foreignKey:ChannelID" json:"channel,omitempty"`
	ChannelCapability *ChannelCapability `gorm:"foreignKey:ChannelCapabilityID" json:"channel_capability,omitempty"`
	Capability        *Capability        `gorm:"foreignKey:CapabilityCode;references:Code" json:"capability,omitempty"`
}

func (Task) TableName() string {
	return "tasks"
}

// 回调状态常量
const (
	CallbackStatusPending = "pending"
	CallbackStatusSuccess = "success"
	CallbackStatusFailed  = "failed"
)
