package model

import (
	"time"

	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uint           `gorm:"primarykey;comment:主键ID" json:"id"`
	CreatedAt time.Time      `gorm:"comment:创建时间" json:"created_at"`
	UpdatedAt time.Time      `gorm:"comment:更新时间" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index;comment:删除时间" json:"-"`
}

// db 原始数据库连接，私有变量
var db *gorm.DB

// DB 返回一个新的数据库 session，避免 session 污染
func DB() *gorm.DB {
	return db.Session(&gorm.Session{})
}

// SetDB 设置数据库连接
func SetDB(d *gorm.DB) {
	db = d
}

// AutoMigrate 自动迁移数据库表结构
func AutoMigrate() error {
	return db.AutoMigrate(
		&User{},
		&Token{},
		&Channel{},
		&ChannelAccount{},
		&Capability{},
		&ChannelCapability{},
		&Task{},
		&ChannelRequestLog{},
		&TokenChannelPriority{},
	)
}
