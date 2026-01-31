package model

import (
	"gorm.io/datatypes"
)

// ChannelCapability 渠道能力实现
type ChannelCapability struct {
	BaseModel
	ChannelID      uint    `gorm:"not null;index;comment:渠道ID" json:"channel_id"`
	CapabilityCode string  `gorm:"type:varchar(30);not null;index;comment:能力编码" json:"capability_code"`
	Model          string  `gorm:"type:varchar(50);comment:模型标识" json:"model"`
	Name           string  `gorm:"type:varchar(100);comment:配置名称" json:"name"`
	Price          float64 `gorm:"type:decimal(10,4);default:0;comment:单次调用价格" json:"price"`
	PriceUnit      string  `gorm:"type:varchar(20);default:'request';comment:计价单位" json:"price_unit"`

	// 请求配置
	ResultMode    string `gorm:"type:varchar(10);default:'poll';comment:结果模式(sync/poll/callback)" json:"result_mode"`
	RequestPath   string `gorm:"type:varchar(255);comment:请求路径" json:"request_path"`
	RequestMethod string `gorm:"type:varchar(10);default:'POST';comment:请求方法" json:"request_method"`
	ContentType   string `gorm:"type:varchar(50);default:'application/json';comment:内容类型" json:"content_type"`

	// 认证配置
	AuthLocation    string `gorm:"type:varchar(10);default:'header';comment:认证位置(header/body/query)" json:"auth_location"`
	AuthKey         string `gorm:"type:varchar(50);default:'Authorization';comment:认证参数名" json:"auth_key"`
	AuthValuePrefix string `gorm:"type:varchar(30);default:'Bearer ';comment:认证值前缀" json:"auth_value_prefix"`

	// 轮询配置
	PollPath            string         `gorm:"type:varchar(255);comment:轮询路径" json:"poll_path"`
	PollMethod          string         `gorm:"type:varchar(10);default:'GET';comment:轮询方法" json:"poll_method"`
	PollInterval        int            `gorm:"default:5;comment:轮询间隔(秒)" json:"poll_interval"`
	PollMaxAttempts     int            `gorm:"default:60;comment:最大轮询次数" json:"poll_max_attempts"`
	PollParamMapping    datatypes.JSON `gorm:"type:json;comment:轮询参数映射" json:"poll_param_mapping"`
	PollResponseMapping datatypes.JSON `gorm:"type:json;comment:轮询响应映射" json:"poll_response_mapping"`

	// 映射配置
	ParamMapping    datatypes.JSON `gorm:"type:json;comment:参数映射配置" json:"param_mapping"`
	ResponseMapping datatypes.JSON `gorm:"type:json;comment:响应映射配置" json:"response_mapping"`
	CallbackMapping datatypes.JSON `gorm:"type:json;comment:回调映射配置" json:"callback_mapping"`
	ExtraConfig     datatypes.JSON `gorm:"type:json;comment:扩展配置" json:"extra_config"`

	Status int8 `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`

	// 关联
	Channel    *Channel    `gorm:"foreignKey:ChannelID" json:"channel,omitempty"`
	Capability *Capability `gorm:"foreignKey:CapabilityCode;references:Code" json:"capability,omitempty"`
}

func (ChannelCapability) TableName() string {
	return "channel_capabilities"
}

// 结果模式常量
const (
	ResultModeSync     = "sync"
	ResultModePoll     = "poll"
	ResultModeCallback = "callback"
)
