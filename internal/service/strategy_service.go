package service

import (
	"errors"

	"github.com/majingzhen/prism/internal/model"
	"gorm.io/gorm"
)

var (
	ErrNoChannelCapability = errors.New("no available channel capability")
	ErrNoChannelAccount    = errors.New("no available channel account")
)

type ChannelCapabilityResult struct {
	Channel           *model.Channel
	ChannelCapability *model.ChannelCapability
}

type AccountResult struct {
	Account *model.ChannelAccount
}

type StrategyService struct{}

func NewStrategyService() *StrategyService {
	return &StrategyService{}
}

// SelectChannelCapability 根据统一模型名选择渠道能力配置
func (s *StrategyService) SelectChannelCapability(modelName string) (*ChannelCapabilityResult, error) {
	var cc model.ChannelCapability
	err := model.DB().Where("model = ? AND status = 1", modelName).First(&cc).Error
	if err != nil {
		return nil, ErrNoChannelCapability
	}

	var channel model.Channel
	err = model.DB().Where("id = ? AND status = 1", cc.ChannelID).First(&channel).Error
	if err != nil {
		return nil, ErrNoChannelCapability
	}

	return &ChannelCapabilityResult{
		Channel:           &channel,
		ChannelCapability: &cc,
	}, nil
}

// SelectAccount 从渠道账号池中选择账号 (负载均衡)
func (s *StrategyService) SelectAccount(channelID uint) (*AccountResult, error) {
	var account model.ChannelAccount
	// 按 current_tasks 升序, weight 降序选择
	err := model.DB().Where("channel_id = ? AND status = 1", channelID).
		Order("current_tasks ASC, weight DESC").
		First(&account).Error
	if err != nil {
		return nil, ErrNoChannelAccount
	}

	return &AccountResult{
		Account: &account,
	}, nil
}

// IncrementAccountTasks 增加账号当前任务数
func (s *StrategyService) IncrementAccountTasks(accountID uint) error {
	return model.DB().Model(&model.ChannelAccount{}).
		Where("id = ?", accountID).
		UpdateColumn("current_tasks", gorm.Expr("current_tasks + 1")).Error
}

// DecrementAccountTasks 减少账号当前任务数
func (s *StrategyService) DecrementAccountTasks(accountID uint) error {
	return model.DB().Model(&model.ChannelAccount{}).
		Where("id = ? AND current_tasks > 0", accountID).
		UpdateColumn("current_tasks", gorm.Expr("current_tasks - 1")).Error
}
