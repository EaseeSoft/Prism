package storage

import (
	"context"
	"io"
)

// Storage 定义存储接口
type Storage interface {
	// Upload 上传文件
	Upload(ctx context.Context, reader io.Reader, path string, contentType string) (string, error)
	// Delete 删除文件
	Delete(ctx context.Context, path string) error
	// GetURL 获取文件访问URL
	GetURL(path string) string
}

var DefaultStorage Storage

// SetDefault 设置默认存储实例
func SetDefault(s Storage) {
	DefaultStorage = s
}

// Upload 使用默认存储上传文件
func Upload(ctx context.Context, reader io.Reader, path string, contentType string) (string, error) {
	return DefaultStorage.Upload(ctx, reader, path, contentType)
}

// Delete 使用默认存储删除文件
func Delete(ctx context.Context, path string) error {
	return DefaultStorage.Delete(ctx, path)
}

// GetURL 使用默认存储获取文件URL
func GetURL(path string) string {
	return DefaultStorage.GetURL(path)
}
