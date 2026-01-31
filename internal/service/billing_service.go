package service

import (
	"errors"

	"github.com/majingzhen/prism/internal/model"
	"gorm.io/gorm"
)

var (
	ErrInsufficientTokenBalance = errors.New("insufficient token balance")
	ErrInsufficientUserBalance  = errors.New("insufficient user balance")
)

type BillingService struct{}

func NewBillingService() *BillingService {
	return &BillingService{}
}

func (s *BillingService) Deduct(tokenID uint, userID uint, amount float64) error {
	if amount <= 0 {
		return nil
	}

	return model.DB().Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&model.Token{}).Where("id = ? AND balance >= ?", tokenID, amount).Updates(map[string]any{
			"balance":    gorm.Expr("balance - ?", amount),
			"total_used": gorm.Expr("total_used + ?", amount),
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrInsufficientTokenBalance
		}

		if userID > 0 {
			userResult := tx.Model(&model.User{}).Where("id = ? AND balance >= ?", userID, amount).
				UpdateColumn("balance", gorm.Expr("balance - ?", amount))
			if userResult.Error != nil {
				return userResult.Error
			}
			if userResult.RowsAffected == 0 {
				return ErrInsufficientUserBalance
			}
		}

		return nil
	})
}

func (s *BillingService) Refund(tokenID uint, userID uint, amount float64) error {
	if amount <= 0 {
		return nil
	}

	return model.DB().Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&model.Token{}).Where("id = ?", tokenID).Updates(map[string]any{
			"balance":    gorm.Expr("balance + ?", amount),
			"total_used": gorm.Expr("total_used - ?", amount),
		})
		if result.Error != nil {
			return result.Error
		}

		if userID > 0 {
			userResult := tx.Model(&model.User{}).Where("id = ?", userID).
				UpdateColumn("balance", gorm.Expr("balance + ?", amount))
			if userResult.Error != nil {
				return userResult.Error
			}
		}

		return nil
	})
}
