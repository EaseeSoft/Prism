package api

import (
	"io"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"
	consolefs "github.com/majingzhen/prism/console"
	"github.com/majingzhen/prism/internal/api/middleware"
	v1 "github.com/majingzhen/prism/internal/api/v1"
)

func SetupRouter() *gin.Engine {
	r := gin.New()

	// 全局中间件
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.RequestLogger())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		Success(c, gin.H{"status": "ok"})
	})

	// 认证接口 (无需登录)
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", v1.Register)
		auth.POST("/login", v1.Login)
		auth.POST("/logout", v1.Logout)
	}

	// 控制台 API (需要 JWT 认证)
	console := r.Group("/api")
	console.Use(middleware.JWTAuth())
	{
		console.GET("/user/me", v1.GetCurrentUser)
		console.GET("/tokens", v1.ListMyTokens)
		console.POST("/tokens", v1.CreateToken)
		console.POST("/tokens/:id/recharge", v1.RechargeToken)
		console.DELETE("/tokens/:id", v1.DeleteToken)

		// 仪表盘（根据角色展示不同数据）
		console.GET("/dashboard/stats", v1.DashboardStats)
		console.GET("/tasks", v1.ListTasks)
		console.GET("/tasks/:task_no", v1.GetTaskDetail)
	}

	// 管理员专用 API
	admin := r.Group("/api/admin")
	admin.Use(middleware.JWTAuth())
	admin.Use(middleware.AdminOnly())
	{
		// 用户管理
		admin.GET("/users", v1.ListUsers)
		admin.PUT("/users/:id/role", v1.UpdateUserRole)
		admin.PUT("/users/:id/status", v1.UpdateUserStatus)
		admin.POST("/users/:id/recharge", v1.RechargeUser)

		// 渠道管理
		admin.GET("/channels", v1.ListChannels)
		admin.GET("/channels/:id", v1.GetChannel)
		admin.POST("/channels", v1.CreateChannel)
		admin.PUT("/channels/:id", v1.UpdateChannel)
		admin.DELETE("/channels/:id", v1.DeleteChannel)

		// 渠道账号管理
		admin.GET("/channel-accounts", v1.ListChannelAccounts)
		admin.GET("/channel-accounts/:id", v1.GetChannelAccount)
		admin.POST("/channel-accounts", v1.CreateChannelAccount)
		admin.PUT("/channel-accounts/:id", v1.UpdateChannelAccount)
		admin.DELETE("/channel-accounts/:id", v1.DeleteChannelAccount)

		// 能力管理
		admin.GET("/capabilities", v1.ListCapabilities)
		admin.GET("/capabilities/:code", v1.GetCapability)
		admin.POST("/capabilities", v1.CreateCapability)
		admin.PUT("/capabilities/:code", v1.UpdateCapability)
		admin.DELETE("/capabilities/:code", v1.DeleteCapability)

		// 渠道能力配置管理
		admin.GET("/channel-capabilities", v1.ListChannelCapabilities)
		admin.GET("/channel-capabilities/:id", v1.GetChannelCapability)
		admin.POST("/channel-capabilities", v1.CreateChannelCapability)
		admin.PUT("/channel-capabilities/:id", v1.UpdateChannelCapability)
		admin.DELETE("/channel-capabilities/:id", v1.DeleteChannelCapability)

		// 渠道请求日志
		admin.GET("/request-logs", v1.ListRequestLogs)
		admin.GET("/request-logs/:id", v1.GetRequestLog)
	}

	// v1 API (Token 鉴权，用于 AI 调用)
	apiV1 := r.Group("/v1")
	apiV1.Use(middleware.Auth())
	{
		// 查询接口
		apiV1.GET("/channels", v1.ListAvailableChannels)
		apiV1.GET("/capabilities", v1.ListAvailableCapabilities)

		// 统一能力接口
		apiV1.POST("/capabilities/:capability", v1.InvokeCapability)

		// 任务管理
		apiV1.GET("/tasks/:task_no", v1.GetTaskByNo)
		apiV1.POST("/tasks/:task_no/cancel", v1.CancelTask)

		// 兼容旧接口
		apiV1.POST("/images/generations", v1.CreateImageGeneration)
		apiV1.POST("/videos/generations", v1.CreateVideoGeneration)
	}

	// 内部接口 (上游回调)
	internal := r.Group("/internal")
	{
		internal.POST("/callback/:channel_type", v1.HandleCapabilityCallback)
	}

	// 嵌入的前端静态文件
	distFS, _ := fs.Sub(consolefs.DistFS, "dist")
	fileServer := http.FileServer(http.FS(distFS))

	// 静态资源
	r.GET("/assets/*filepath", gin.WrapH(fileServer))

	// SPA 路由: 所有未匹配的路由返回 index.html
	r.NoRoute(func(c *gin.Context) {
		// API 路由返回 404
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if len(c.Request.URL.Path) >= 3 && c.Request.URL.Path[:3] == "/v1" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		// 其他路由返回 index.html (SPA)
		indexFile, err := distFS.Open("index.html")
		if err != nil {
			c.String(http.StatusNotFound, "Console not found")
			return
		}
		defer indexFile.Close()

		stat, _ := indexFile.Stat()
		http.ServeContent(c.Writer, c.Request, "index.html", stat.ModTime(), indexFile.(io.ReadSeeker))
	})

	return r
}
