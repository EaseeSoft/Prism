package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var L *zap.Logger

func Init() error {
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(os.Stdout),
		zapcore.InfoLevel,
	)

	L = zap.New(core, zap.AddCaller())
	return nil
}

func Info(msg string, fields ...zap.Field) {
	L.Info(msg, fields...)
}

func Error(msg string, fields ...zap.Field) {
	L.Error(msg, fields...)
}

func Debug(msg string, fields ...zap.Field) {
	L.Debug(msg, fields...)
}

func Warn(msg string, fields ...zap.Field) {
	L.Warn(msg, fields...)
}
