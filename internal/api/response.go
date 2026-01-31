package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/pkg/errors"
)

type Response struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func Error(c *gin.Context, httpCode int, code int, message string) {
	c.JSON(httpCode, Response{
		Code:    code,
		Message: message,
	})
}

func ErrorWithErr(c *gin.Context, httpCode int, err *errors.Error) {
	c.JSON(httpCode, Response{
		Code:    err.Code,
		Message: err.Message,
	})
}

func BadRequest(c *gin.Context, err *errors.Error) {
	ErrorWithErr(c, http.StatusBadRequest, err)
}

func Unauthorized(c *gin.Context, err *errors.Error) {
	ErrorWithErr(c, http.StatusUnauthorized, err)
}

func Forbidden(c *gin.Context, err *errors.Error) {
	ErrorWithErr(c, http.StatusForbidden, err)
}

func NotFound(c *gin.Context, err *errors.Error) {
	ErrorWithErr(c, http.StatusNotFound, err)
}

func InternalError(c *gin.Context, err *errors.Error) {
	ErrorWithErr(c, http.StatusInternalServerError, err)
}
