package chat

import (
	"fmt"
	"time"
)

type ProviderFactory func(ProviderConfig) ChatProvider

var providerRegistry = map[string]ProviderFactory{
	"openai":    func(c ProviderConfig) ChatProvider { return NewOpenAIProvider(c) },
	"anthropic": func(c ProviderConfig) ChatProvider { return NewAnthropicProvider(c) },
	"google":    func(c ProviderConfig) ChatProvider { return NewGoogleProvider(c) },
	"deepseek":  func(c ProviderConfig) ChatProvider { return NewOpenAIProvider(c) },
	"qwen":      func(c ProviderConfig) ChatProvider { return NewOpenAIProvider(c) },
	"moonshot":  func(c ProviderConfig) ChatProvider { return NewOpenAIProvider(c) },
}

// GetProvider 根据类型获取 Provider
func GetProvider(providerType string, config ProviderConfig) (ChatProvider, error) {
	factory, ok := providerRegistry[providerType]
	if !ok {
		return nil, fmt.Errorf("unknown provider type: %s", providerType)
	}

	// 设置默认超时
	if config.Timeout == 0 {
		config.Timeout = 120 * time.Second
	}

	// 设置默认请求路径
	if config.RequestPath == "" {
		config.RequestPath = "/v1/chat/completions"
	}

	return factory(config), nil
}

// RegisterProvider 注册新的 Provider
func RegisterProvider(name string, factory ProviderFactory) {
	providerRegistry[name] = factory
}
