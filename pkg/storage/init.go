package storage

import (
	"fmt"

	"github.com/majingzhen/prism/pkg/config"
)

// Init 根据配置初始化存储
func Init() error {
	cfg := config.C.Storage

	switch cfg.Type {
	case "tencent":
		s, err := NewTencentCOS(cfg.Tencent)
		if err != nil {
			return fmt.Errorf("init tencent cos: %w", err)
		}
		SetDefault(s)
	default:
		return fmt.Errorf("unsupported storage type: %s", cfg.Type)
	}

	return nil
}
