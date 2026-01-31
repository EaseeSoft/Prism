package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/majingzhen/prism/pkg/config"
	"github.com/tencentyun/cos-go-sdk-v5"
)

// TencentCOS 腾讯云对象存储
type TencentCOS struct {
	client  *cos.Client
	bucket  string
	region  string
	baseURL string
	cdnURL  string
}

// NewTencentCOS 创建腾讯云COS存储实例
func NewTencentCOS(cfg config.TencentCOSConfig) (*TencentCOS, error) {
	bucketURL, err := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.Bucket, cfg.Region))
	if err != nil {
		return nil, fmt.Errorf("parse bucket url: %w", err)
	}

	serviceURL, err := url.Parse(fmt.Sprintf("https://cos.%s.myqcloud.com", cfg.Region))
	if err != nil {
		return nil, fmt.Errorf("parse service url: %w", err)
	}

	client := cos.NewClient(&cos.BaseURL{
		BucketURL:  bucketURL,
		ServiceURL: serviceURL,
	}, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  cfg.SecretID,
			SecretKey: cfg.SecretKey,
		},
	})

	baseURL := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.Bucket, cfg.Region)
	cdnURL := cfg.CDN
	if cdnURL == "" {
		cdnURL = baseURL
	}

	return &TencentCOS{
		client:  client,
		bucket:  cfg.Bucket,
		region:  cfg.Region,
		baseURL: baseURL,
		cdnURL:  cdnURL,
	}, nil
}

// Upload 上传文件到COS
func (t *TencentCOS) Upload(ctx context.Context, reader io.Reader, path string, contentType string) (string, error) {
	opt := &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	}

	_, err := t.client.Object.Put(ctx, path, reader, opt)
	if err != nil {
		return "", fmt.Errorf("cos put object: %w", err)
	}

	return t.GetURL(path), nil
}

// Delete 从COS删除文件
func (t *TencentCOS) Delete(ctx context.Context, path string) error {
	_, err := t.client.Object.Delete(ctx, path)
	if err != nil {
		return fmt.Errorf("cos delete object: %w", err)
	}
	return nil
}

// GetURL 获取文件访问URL
func (t *TencentCOS) GetURL(path string) string {
	return fmt.Sprintf("%s/%s", t.cdnURL, path)
}
