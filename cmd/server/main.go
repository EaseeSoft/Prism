package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/hibiken/asynq"
	"github.com/majingzhen/prism/internal/api"
	"github.com/majingzhen/prism/internal/model"
	"github.com/majingzhen/prism/internal/worker"
	"github.com/majingzhen/prism/pkg/cache"
	"github.com/majingzhen/prism/pkg/config"
	"github.com/majingzhen/prism/pkg/database"
	"github.com/majingzhen/prism/pkg/logger"
	"github.com/majingzhen/prism/pkg/queue"
	"github.com/majingzhen/prism/pkg/storage"
)

func main() {
	// 获取可执行文件所在目录
	execPath, err := os.Executable()
	if err != nil {
		log.Fatalf("failed to get executable path: %v", err)
	}
	// 解析符号链接，获取真实路径
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		log.Fatalf("failed to eval symlinks: %v", err)
	}
	execDir := filepath.Dir(execPath)

	// 获取当前工作目录
	cwd, _ := os.Getwd()

	// 按优先级查找配置文件
	configPaths := []string{
		filepath.Join(cwd, "configs", "config.yaml"),     // 当前工作目录
		filepath.Join(execDir, "configs", "config.yaml"), // 可执行文件目录
		"configs/config.yaml",                            // 相对路径
	}

	var configPath string
	for _, p := range configPaths {
		if _, err := os.Stat(p); err == nil {
			configPath = p
			break
		}
	}

	if configPath == "" {
		log.Fatalf("config file not found, searched paths:\n  - %s",
			filepath.Join(cwd, "configs", "config.yaml")+"\n  - "+
				filepath.Join(execDir, "configs", "config.yaml"))
	}

	log.Printf("loading config from: %s", configPath)

	if err := config.Load(configPath); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// 初始化日志
	if err := logger.Init(); err != nil {
		log.Fatalf("failed to init logger: %v", err)
	}

	// 连接数据库
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	model.SetDB(db)

	// 自动迁移
	if err := model.AutoMigrate(); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// 初始化缓存
	if err := cache.Init(); err != nil {
		log.Fatalf("failed to init cache: %v", err)
	}
	defer cache.Close()

	// 初始化队列客户端
	if err := queue.InitClient(); err != nil {
		log.Fatalf("failed to init queue client: %v", err)
	}
	defer queue.Close()

	// 初始化存储 (可选)
	if config.C.Storage.Type != "" {
		if err := storage.Init(); err != nil {
			log.Fatalf("failed to init storage: %v", err)
		}
		logger.Info("storage initialized: " + config.C.Storage.Type)
	}

	// 启动 Worker (后台)
	go startWorker()

	// 启动 Scheduler (后台)
	go startScheduler()

	// 设置路由
	r := api.SetupRouter()

	// 启动 HTTP 服务
	addr := fmt.Sprintf(":%d", config.C.Server.Port)
	logger.Info("server starting on " + addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func startWorker() {
	srv := queue.NewServer()
	mux := asynq.NewServeMux()
	worker.RegisterHandlers(mux)

	logger.Info("worker starting...")
	if err := srv.Run(mux); err != nil {
		log.Fatalf("failed to start worker: %v", err)
	}
}

func startScheduler() {
	cfg := config.C.Redis
	scheduler := asynq.NewScheduler(
		asynq.RedisClientOpt{
			Addr:     cfg.Addr,
			Password: cfg.Password,
			DB:       cfg.DB,
		},
		nil,
	)

	// 每 5 分钟检查一次超时任务
	_, err := scheduler.Register("*/5 * * * *", worker.NewTimeoutCheckTask())
	if err != nil {
		log.Fatalf("failed to register timeout check task: %v", err)
	}

	logger.Info("scheduler starting...")
	if err := scheduler.Run(); err != nil {
		log.Fatalf("failed to start scheduler: %v", err)
	}
}
