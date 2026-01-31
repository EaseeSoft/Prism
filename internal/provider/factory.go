package provider

import (
	"github.com/majingzhen/prism/internal/model"
)

func NewProvider(channel *model.Channel, account *model.ChannelAccount, cc *model.ChannelCapability) (Provider, error) {
	// 解析响应映射
	responseMapping, err := ParseResponseMapping(cc.ResponseMapping)
	if err != nil {
		return nil, err
	}

	// 解析回调映射
	callbackMapping, err := ParseResponseMapping(cc.CallbackMapping)
	if err != nil {
		return nil, err
	}

	apiKey := account.APIKey
	baseURL := channel.BaseURL

	// 认证配置默认值
	authLocation := cc.AuthLocation
	if authLocation == "" {
		authLocation = "header"
	}
	authKey := cc.AuthKey
	if authKey == "" {
		authKey = "Authorization"
	}
	authValuePrefix := cc.AuthValuePrefix
	if authValuePrefix == "" && authLocation == "header" {
		authValuePrefix = "Bearer "
	}

	base := &BaseProvider{
		Name:            channel.Type,
		BaseURL:         baseURL,
		APIKey:          apiKey,
		AuthLocation:    authLocation,
		AuthKey:         authKey,
		AuthValuePrefix: authValuePrefix,
		ContentType:     cc.ContentType,
		RequestMethod:   cc.RequestMethod,
		SubmitPath:      cc.RequestPath,
		ProgressPath:    cc.PollPath,
		Converter:       NewDefaultConverter(),
		Parser:          NewDefaultParser(),
		ResponseMapping: responseMapping,
		CallbackMapping: callbackMapping,
	}

	return base, nil
}
