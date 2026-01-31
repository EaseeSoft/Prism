package middleware

import (
	"bytes"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/pkg/logger"
	"go.uber.org/zap"
)

type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// 读取请求体
		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// 包装 ResponseWriter 以捕获响应
		rw := &responseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBuffer(nil),
		}
		c.Writer = rw

		// 处理请求
		c.Next()

		// 记录日志
		latency := time.Since(start)
		status := c.Writer.Status()

		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", status),
			zap.Duration("latency", latency),
			zap.String("ip", c.ClientIP()),
		}

		// 非 GET 请求记录请求体
		if c.Request.Method != "GET" && len(requestBody) > 0 && len(requestBody) < 4096 {
			fields = append(fields, zap.String("request", string(requestBody)))
		}

		// 错误响应记录响应体
		if status >= 400 && rw.body.Len() < 1024 {
			fields = append(fields, zap.String("response", rw.body.String()))
		}

		if status >= 500 {
			logger.Error("request error", fields...)
		} else if status >= 400 {
			logger.Warn("request warning", fields...)
		} else {
			logger.Info("request completed", fields...)
		}
	}
}
