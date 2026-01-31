package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Storage  StorageConfig  `mapstructure:"storage"`
	Worker   WorkerConfig   `mapstructure:"worker"`
}

type ServerConfig struct {
	Port      int    `mapstructure:"port"`
	JWTSecret string `mapstructure:"jwt_secret"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type StorageConfig struct {
	Type    string           `mapstructure:"type"`
	Tencent TencentCOSConfig `mapstructure:"tencent"`
}

type TencentCOSConfig struct {
	SecretID  string `mapstructure:"secret_id"`
	SecretKey string `mapstructure:"secret_key"`
	Region    string `mapstructure:"region"`
	Bucket    string `mapstructure:"bucket"`
	CDN       string `mapstructure:"cdn"`
}

type WorkerConfig struct {
	Concurrency  int    `mapstructure:"concurrency"`
	PollInterval string `mapstructure:"poll_interval"`
	MaxRetry     int    `mapstructure:"max_retry"`
}

var C *Config

func Load(path string) error {
	viper.SetConfigFile(path)
	if err := viper.ReadInConfig(); err != nil {
		return err
	}
	C = &Config{}
	return viper.Unmarshal(C)
}
