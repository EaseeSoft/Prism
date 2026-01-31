package model

import (
	"time"

	"gorm.io/datatypes"
)

// Capability 能力定义（平台级）
type Capability struct {
	Code             string         `gorm:"primaryKey;type:varchar(30);comment:能力编码" json:"code"`
	Name             string         `gorm:"type:varchar(50);not null;comment:能力名称" json:"name"`
	Type             string         `gorm:"type:varchar(10);default:'image';comment:能力类型(image/video/chat/other)" json:"type"`
	Description      string         `gorm:"type:text;comment:能力描述" json:"description"`
	StandardParams   datatypes.JSON `gorm:"type:json;comment:标准参数定义" json:"standard_params"`
	StandardResponse datatypes.JSON `gorm:"type:json;comment:标准响应定义" json:"standard_response"`
	Status           int8           `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`
	CreatedAt        time.Time      `gorm:"comment:创建时间" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"comment:更新时间" json:"updated_at"`
}

// 能力类型常量
const (
	CapabilityTypeImage = "image"
	CapabilityTypeVideo = "video"
	CapabilityTypeChat  = "chat"
	CapabilityTypeOther = "other"
)

func (Capability) TableName() string {
	return "capabilities"
}

// 能力编码常量
const (
	CapabilityText2Img     = "text2img"
	CapabilityImg2Img      = "img2img"
	CapabilityText2Video   = "text2video"
	CapabilityImg2Video    = "img2video"
	CapabilityCharacterGen = "character_gen"
)
