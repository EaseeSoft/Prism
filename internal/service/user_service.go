package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/pkg/auth"
	"github.com/majingzhen/prism/pkg/cache"
	"github.com/majingzhen/prism/pkg/logger"
	"gorm.io/gorm"
)

type UserService struct{}

func NewUserService() *UserService {
	return &UserService{}
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  *model.User `json:"user"`
}

func (s *UserService) Register(req *RegisterRequest) (*model.User, error) {
	var exist int64
	err := model.DB().Model(&model.User{}).Where("username = ?", req.Username).Count(&exist).Error
	if err != nil || exist > 0 {
		return nil, errors.New("username already exists")
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Username: req.Username,
		Password: hashedPassword,
		Role:     model.UserRoleUser,
		Status:   1,
	}

	logger.Error("user type: " + fmt.Sprintf("%T", user))
	logger.Error("user value: " + fmt.Sprintf("%#v", user))
	if err := model.DB().Model(&model.User{}).Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (s *UserService) Login(req *LoginRequest) (*LoginResponse, error) {
	var user model.User
	if err := model.DB().Model(&model.User{}).Where("username = ? AND status = 1", req.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid username or password")
		}
		return nil, err
	}

	if !auth.CheckPassword(req.Password, user.Password) {
		return nil, errors.New("invalid username or password")
	}

	token, err := auth.GenerateToken(user.ID, user.Username, string(user.Role))
	if err != nil {
		return nil, err
	}

	// 将登录 token 存入缓存
	if err := cache.SetLoginToken(context.Background(), token, user.ID); err != nil {
		logger.Error("failed to cache login token: " + err.Error())
		return nil, errors.New("login failed, please try again")
	}

	return &LoginResponse{
		Token: token,
		User:  &user,
	}, nil
}

// Logout 用户登出，删除缓存中的 token
func (s *UserService) Logout(token string) error {
	return cache.DeleteLoginToken(context.Background(), token)
}

func (s *UserService) GetUserByID(id uint) (*model.User, error) {
	var user model.User
	if err := model.DB().Model(&model.User{}).First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) ListUsers() ([]model.User, error) {
	var users []model.User
	if err := model.DB().Model(&model.User{}).Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (s *UserService) UpdateUserRole(userID uint, role model.UserRole) error {
	return model.DB().Model(&model.User{}).Where("id = ?", userID).Update("role", role).Error
}

func (s *UserService) UpdateUserStatus(userID uint, status int8) error {
	return model.DB().Model(&model.User{}).Where("id = ?", userID).Update("status", status).Error
}

// RechargeUser 给指定用户充值额度
func (s *UserService) RechargeUser(userID uint, amount float64) error {
	return model.DB().Model(&model.User{}).Where("id = ?", userID).
		UpdateColumn("balance", gorm.Expr("balance + ?", amount)).Error
}
