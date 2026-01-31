package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/majingzhen/prism/pkg/errors"
)

type response struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func successResponse(c *gin.Context, data any) {
	c.JSON(http.StatusOK, response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func errorResponse(c *gin.Context, httpCode int, code int, message string) {
	c.JSON(httpCode, response{
		Code:    code,
		Message: message,
	})
}

func errorWithErr(c *gin.Context, httpCode int, err *errors.Error) {
	c.JSON(httpCode, response{
		Code:    err.Code,
		Message: err.Message,
	})
}

func badRequest(c *gin.Context, err *errors.Error) {
	errorWithErr(c, http.StatusBadRequest, err)
}

func notFound(c *gin.Context, err *errors.Error) {
	errorWithErr(c, http.StatusNotFound, err)
}

func forbidden(c *gin.Context, err *errors.Error) {
	errorWithErr(c, http.StatusForbidden, err)
}

func internalError(c *gin.Context, err *errors.Error) {
	errorWithErr(c, http.StatusInternalServerError, err)
}
