package v1

import (
	"errors"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/internal/service"
	pkgErrors "github.com/majingzhen/prism/pkg/errors"
)

var channelService = service.NewChannelService()

// ========== Channel Handlers ==========

func ListChannels(c *gin.Context) {
	channels, err := channelService.ListChannels()
	if err != nil {
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	result := make([]gin.H, len(channels))
	for i, ch := range channels {
		accountCount, _ := channelService.GetChannelAccountCount(ch.ID)
		result[i] = gin.H{
			"id":             ch.ID,
			"type":           ch.Type,
			"name":           ch.Name,
			"base_url":       ch.BaseURL,
			"config":         ch.Config,
			"status":         ch.Status,
			"accounts_count": accountCount,
			"created_at":     ch.CreatedAt,
			"updated_at":     ch.UpdatedAt,
		}
	}

	successResponse(c, result)
}

func GetChannel(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return
	}

	channel, err := channelService.GetChannelByID(id)
	if err != nil {
		if errors.Is(err, service.ErrChannelNotFound) {
			notFound(c, pkgErrors.ErrTaskNotFound)
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	accountCount, _ := channelService.GetChannelAccountCount(channel.ID)

	successResponse(c, gin.H{
		"id":             channel.ID,
		"type":           channel.Type,
		"name":           channel.Name,
		"base_url":       channel.BaseURL,
		"config":         channel.Config,
		"status":         channel.Status,
		"accounts_count": accountCount,
		"created_at":     channel.CreatedAt,
		"updated_at":     channel.UpdatedAt,
	})
}

func CreateChannel(c *gin.Context) {
	var req service.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, pkgErrors.WithMessage(pkgErrors.ErrInvalidParams, err.Error()))
		return
	}

	channel, err := channelService.CreateChannel(&req)
	if err != nil {
		if errors.Is(err, service.ErrChannelTypeExists) {
			badRequest(c, pkgErrors.WithMessage(pkgErrors.ErrInvalidParams, "channel type already exists"))
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{
		"id":       channel.ID,
		"type":     channel.Type,
		"name":     channel.Name,
		"base_url": channel.BaseURL,
		"status":   channel.Status,
	})
}

func UpdateChannel(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return
	}

	var req service.UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, pkgErrors.WithMessage(pkgErrors.ErrInvalidParams, err.Error()))
		return
	}

	if err := channelService.UpdateChannel(id, &req); err != nil {
		if errors.Is(err, service.ErrChannelNotFound) {
			notFound(c, pkgErrors.ErrTaskNotFound)
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"updated": true})
}

func DeleteChannel(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return
	}

	if err := channelService.DeleteChannel(id); err != nil {
		if errors.Is(err, service.ErrChannelNotFound) {
			notFound(c, pkgErrors.ErrTaskNotFound)
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"deleted": true})
}

// ========== ChannelAccount Handlers ==========

func ListChannelAccounts(c *gin.Context) {
	channelID, _ := parseOptionalUintQuery(c, "channel_id")

	accounts, err := channelService.ListChannelAccounts(channelID)
	if err != nil {
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	result := make([]gin.H, len(accounts))
	for i, acc := range accounts {
		result[i] = gin.H{
			"id":            acc.ID,
			"channel_id":    acc.ChannelID,
			"name":          acc.Name,
			"api_key":       acc.APIKey,
			"config":        acc.Config,
			"weight":        acc.Weight,
			"status":        acc.Status,
			"current_tasks": acc.CurrentTasks,
			"created_at":    acc.CreatedAt,
			"updated_at":    acc.UpdatedAt,
		}
	}

	successResponse(c, result)
}

func GetChannelAccount(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return
	}

	account, err := channelService.GetChannelAccountByID(id)
	if err != nil {
		if errors.Is(err, service.ErrChannelAccountNotFound) {
			notFound(c, pkgErrors.ErrTaskNotFound)
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{
		"id":            account.ID,
		"channel_id":    account.ChannelID,
		"name":          account.Name,
		"api_key":       account.APIKey,
		"config":        account.Config,
		"weight":        account.Weight,
		"status":        account.Status,
		"current_tasks": account.CurrentTasks,
		"created_at":    account.CreatedAt,
		"updated_at":    account.UpdatedAt,
	})
}

func CreateChannelAccount(c *gin.Context) {
	var req service.CreateChannelAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, pkgErrors.WithMessage(pkgErrors.ErrInvalidParams, err.Error()))
		return
	}

	account, err := channelService.CreateChannelAccount(&req)
	if err != nil {
		if errors.Is(err, service.ErrChannelNotFound) {
			badRequest(c, pkgErrors.WithMessage(pkgErrors.ErrInvalidParams, "channel not found"))
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{
		"id":         account.ID,
		"channel_id": account.ChannelID,
		"name":       account.Name,
		"weight":     account.Weight,
		"status":     account.Status,
	})
}

func UpdateChannelAccount(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return
	}

	var req service.UpdateChannelAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, pkgErrors.WithMessage(pkgErrors.ErrInvalidParams, err.Error()))
		return
	}

	if err := channelService.UpdateChannelAccount(id, &req); err != nil {
		if errors.Is(err, service.ErrChannelAccountNotFound) {
			notFound(c, pkgErrors.ErrTaskNotFound)
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"updated": true})
}

func DeleteChannelAccount(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return
	}

	if err := channelService.DeleteChannelAccount(id); err != nil {
		if errors.Is(err, service.ErrChannelAccountNotFound) {
			notFound(c, pkgErrors.ErrTaskNotFound)
			return
		}
		internalError(c, pkgErrors.ErrInternalError)
		return
	}

	successResponse(c, gin.H{"deleted": true})
}

// ========== Helper Functions ==========

func parseUintParam(c *gin.Context, name string) (uint, error) {
	param := c.Param(name)
	var id uint
	if _, err := fmt.Sscanf(param, "%d", &id); err != nil {
		badRequest(c, pkgErrors.WithMessage(pkgErrors.ErrInvalidParams, "invalid "+name))
		return 0, err
	}
	return id, nil
}

func parseOptionalUintQuery(c *gin.Context, name string) (uint, error) {
	param := c.Query(name)
	if param == "" {
		return 0, nil
	}
	var id uint
	if _, err := fmt.Sscanf(param, "%d", &id); err != nil {
		return 0, err
	}
	return id, nil
}
