package queue

import (
	"github.com/hibiken/asynq"
	"github.com/majingzhen/prism/pkg/config"
)

var Client *asynq.Client

func InitClient() error {
	cfg := config.C.Redis
	Client = asynq.NewClient(asynq.RedisClientOpt{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	return nil
}

func NewServer() *asynq.Server {
	cfg := config.C.Redis
	workerCfg := config.C.Worker

	return asynq.NewServer(
		asynq.RedisClientOpt{
			Addr:     cfg.Addr,
			Password: cfg.Password,
			DB:       cfg.DB,
		},
		asynq.Config{
			Concurrency: workerCfg.Concurrency,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
		},
	)
}

func Close() error {
	if Client != nil {
		return Client.Close()
	}
	return nil
}
