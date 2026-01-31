package errors

import "fmt"

type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *Error) Error() string {
	return fmt.Sprintf("[%d] %s", e.Code, e.Message)
}

func New(code int, message string) *Error {
	return &Error{Code: code, Message: message}
}

// 客户端错误 4xxxx
var (
	ErrInvalidToken      = New(40001, "invalid or disabled token")
	ErrInsufficientQuota = New(40002, "insufficient quota")
	ErrInvalidParams     = New(40003, "invalid params")
	ErrTaskNotFound      = New(40004, "task not found")
	ErrNoPermission      = New(40005, "no permission to access this task")
	ErrModelNotFound     = New(40006, "model not found")
)

// 服务端错误 5xxxx
var (
	ErrNoAvailableChannel = New(50001, "no available channel")
	ErrProviderError      = New(50002, "provider error")
	ErrUploadFailed       = New(50003, "upload failed")
	ErrInternalError      = New(50099, "internal error")
)

func WithMessage(err *Error, msg string) *Error {
	return &Error{
		Code:    err.Code,
		Message: msg,
	}
}
