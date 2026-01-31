package model

import "time"

// RequestType 请求类型
type RequestType string

const (
	RequestTypeSubmit   RequestType = "submit"   // 提交任务到第三方
	RequestTypePoll     RequestType = "poll"     // 轮询任务状态
	RequestTypeCallback RequestType = "callback" // 发送回调给调用方
)

// ChannelRequestLog 渠道请求日志
type ChannelRequestLog struct {
	BaseModel
	TaskID         uint   `gorm:"index;comment:关联任务ID" json:"task_id"`
	TaskNo         string `gorm:"type:varchar(32);index;comment:任务编号" json:"task_no"`
	ChannelID      uint   `gorm:"index;comment:渠道ID" json:"channel_id"`
	AccountID      uint   `gorm:"comment:渠道账号ID" json:"account_id"`
	CapabilityCode string `gorm:"type:varchar(30);index;comment:能力编码" json:"capability_code"`

	// 请求类型: submit(提交) / poll(轮询) / callback(回调通知)
	RequestType RequestType `gorm:"type:varchar(20);index;comment:请求类型" json:"request_type"`

	// 请求信息
	Method         string `gorm:"type:varchar(10);comment:请求方法" json:"method"`
	URL            string `gorm:"type:varchar(500);comment:请求URL" json:"url"`
	RequestHeaders string `gorm:"type:text;comment:请求头(JSON)" json:"request_headers"`
	RequestBody    string `gorm:"type:text;comment:请求体" json:"request_body"`

	// 响应信息
	StatusCode   int    `gorm:"comment:HTTP状态码" json:"status_code"`
	ResponseBody string `gorm:"type:mediumtext;comment:响应体" json:"response_body"`

	// 耗时
	DurationMs int64 `gorm:"comment:耗时(毫秒)" json:"duration_ms"`

	// 错误信息（网络错误等，非业务错误）
	ErrorMessage string `gorm:"type:text;comment:错误信息" json:"error_message"`

	RequestAt time.Time `gorm:"index;comment:请求时间" json:"request_at"`

	// 关联（禁用外键约束，仅用于 Preload 查询）
	Channel    *Channel    `gorm:"foreignKey:ChannelID;constraint:-" json:"channel,omitempty"`
	Capability *Capability `gorm:"foreignKey:CapabilityCode;references:Code;constraint:-" json:"capability,omitempty"`
}

func (ChannelRequestLog) TableName() string {
	return "channel_request_logs"
}
