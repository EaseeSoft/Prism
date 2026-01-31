package service

import (
	"encoding/json"
	"errors"

	"github.com/majingzhen/prism/internal/model"
	"gorm.io/gorm"
)

var (
	ErrChannelNotFound        = errors.New("channel not found")
	ErrChannelAccountNotFound = errors.New("channel account not found")
	ErrChannelTypeExists      = errors.New("channel type already exists")
)

type ChannelService struct{}

func NewChannelService() *ChannelService {
	return &ChannelService{}
}

// ========== Channel CRUD ==========

type CreateChannelRequest struct {
	Type    string         `json:"type" binding:"required,max=20"`
	Name    string         `json:"name" binding:"required,max=50"`
	BaseURL string         `json:"base_url" binding:"required,max=255"`
	Config  map[string]any `json:"config"`
	Status  int8           `json:"status"`
}

type UpdateChannelRequest struct {
	Name    string         `json:"name" binding:"max=50"`
	BaseURL string         `json:"base_url" binding:"max=255"`
	Config  map[string]any `json:"config"`
	Status  *int8          `json:"status"`
}

func (s *ChannelService) CreateChannel(req *CreateChannelRequest) (*model.Channel, error) {
	// 检查 type 是否已存在
	var exist int64
	if err := model.DB().Model(&model.Channel{}).Where("type = ?", req.Type).Count(&exist).Error; err != nil {
		return nil, err
	}
	if exist > 0 {
		return nil, ErrChannelTypeExists
	}

	configJSON, _ := json.Marshal(req.Config)
	channel := &model.Channel{
		Type:    req.Type,
		Name:    req.Name,
		BaseURL: req.BaseURL,
		Config:  configJSON,
		Status:  1,
	}
	if req.Status != 0 {
		channel.Status = req.Status
	}

	if err := model.DB().Model(&model.Channel{}).Create(channel).Error; err != nil {
		return nil, err
	}
	return channel, nil
}

func (s *ChannelService) GetChannelByID(id uint) (*model.Channel, error) {
	var channel model.Channel
	if err := model.DB().Model(&model.Channel{}).First(&channel, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelNotFound
		}
		return nil, err
	}
	return &channel, nil
}

func (s *ChannelService) ListChannels() ([]model.Channel, error) {
	var channels []model.Channel
	if err := model.DB().Model(&model.Channel{}).Order("id ASC").Find(&channels).Error; err != nil {
		return nil, err
	}
	return channels, nil
}

func (s *ChannelService) UpdateChannel(id uint, req *UpdateChannelRequest) error {
	updates := make(map[string]any)
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.BaseURL != "" {
		updates["base_url"] = req.BaseURL
	}
	if req.Config != nil {
		configJSON, _ := json.Marshal(req.Config)
		updates["config"] = configJSON
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	if len(updates) == 0 {
		return nil
	}

	result := model.DB().Model(&model.Channel{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrChannelNotFound
	}
	return nil
}

func (s *ChannelService) DeleteChannel(id uint) error {
	result := model.DB().Model(&model.Channel{}).Delete(&model.Channel{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrChannelNotFound
	}
	return nil
}

// GetChannelAccountCount 获取渠道下的账号数量
func (s *ChannelService) GetChannelAccountCount(channelID uint) (int64, error) {
	var count int64
	if err := model.DB().Model(&model.ChannelAccount{}).Where("channel_id = ?", channelID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// ========== ChannelAccount CRUD ==========

type CreateChannelAccountRequest struct {
	ChannelID uint           `json:"channel_id" binding:"required"`
	Name      string         `json:"name" binding:"required,max=50"`
	APIKey    string         `json:"api_key" binding:"required"`
	Config    map[string]any `json:"config"`
	Weight    int            `json:"weight"`
	Status    int8           `json:"status"`
}

type UpdateChannelAccountRequest struct {
	Name   string         `json:"name" binding:"max=50"`
	APIKey string         `json:"api_key"`
	Config map[string]any `json:"config"`
	Weight *int           `json:"weight"`
	Status *int8          `json:"status"`
}

func (s *ChannelService) CreateChannelAccount(req *CreateChannelAccountRequest) (*model.ChannelAccount, error) {
	// 验证渠道是否存在
	var channel model.Channel
	if err := model.DB().Model(&model.Channel{}).First(&channel, req.ChannelID).Error; err != nil {
		return nil, ErrChannelNotFound
	}

	configJSON, _ := json.Marshal(req.Config)
	account := &model.ChannelAccount{
		ChannelID: req.ChannelID,
		Name:      req.Name,
		APIKey:    req.APIKey,
		Config:    configJSON,
		Weight:    10,
		Status:    1,
	}
	if req.Weight > 0 {
		account.Weight = req.Weight
	}
	if req.Status != 0 {
		account.Status = req.Status
	}

	if err := model.DB().Model(&model.ChannelAccount{}).Create(account).Error; err != nil {
		return nil, err
	}
	return account, nil
}

func (s *ChannelService) GetChannelAccountByID(id uint) (*model.ChannelAccount, error) {
	var account model.ChannelAccount
	if err := model.DB().Model(&model.ChannelAccount{}).First(&account, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelAccountNotFound
		}
		return nil, err
	}
	return &account, nil
}

func (s *ChannelService) ListChannelAccounts(channelID uint) ([]model.ChannelAccount, error) {
	var accounts []model.ChannelAccount
	query := model.DB().Model(&model.ChannelAccount{})
	if channelID > 0 {
		query = query.Where("channel_id = ?", channelID)
	}
	if err := query.Order("id ASC").Find(&accounts).Error; err != nil {
		return nil, err
	}
	return accounts, nil
}

func (s *ChannelService) UpdateChannelAccount(id uint, req *UpdateChannelAccountRequest) error {
	updates := make(map[string]any)
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.APIKey != "" {
		updates["api_key"] = req.APIKey
	}
	if req.Config != nil {
		configJSON, _ := json.Marshal(req.Config)
		updates["config"] = configJSON
	}
	if req.Weight != nil {
		updates["weight"] = *req.Weight
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	if len(updates) == 0 {
		return nil
	}

	result := model.DB().Model(&model.ChannelAccount{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrChannelAccountNotFound
	}
	return nil
}

func (s *ChannelService) DeleteChannelAccount(id uint) error {
	result := model.DB().Model(&model.ChannelAccount{}).Delete(&model.ChannelAccount{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrChannelAccountNotFound
	}
	return nil
}
