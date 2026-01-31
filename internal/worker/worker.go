package worker

import (
	"github.com/hibiken/asynq"
)

func RegisterHandlers(mux *asynq.ServeMux) {
	mux.HandleFunc(TypeTaskSubmit, HandleTaskSubmit)
	mux.HandleFunc(TypeTaskPoll, HandleTaskPoll)
	mux.HandleFunc(TypeTaskUpload, HandleTaskUpload)
	mux.HandleFunc(TypeTaskNotify, HandleTaskNotify)
	mux.HandleFunc(TypeTaskTimeoutCheck, HandleTaskTimeoutCheck)
}
