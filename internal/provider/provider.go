package provider

import "context"

type ResultMode string

const (
	ResultModePoll     ResultMode = "poll"
	ResultModeCallback ResultMode = "callback"
	ResultModeSync     ResultMode = "sync"
)

type TaskStatus string

const (
	StatusPending    TaskStatus = "PENDING"
	StatusSubmitted  TaskStatus = "SUBMITTED"
	StatusProcessing TaskStatus = "PROCESSING"
	StatusSuccess    TaskStatus = "SUCCESS"
	StatusFail       TaskStatus = "FAIL"
)

type SubmitRequest struct {
	TaskNo      string
	Params      map[string]any
	CallbackURL string
}

type SubmitResult struct {
	ProviderTaskID string
	Status         TaskStatus
	Progress       int
	URLs           []string
}

type ProgressResult struct {
	Status   TaskStatus
	Progress int
	URLs     []string
	Error    string
}

type Provider interface {
	Submit(ctx context.Context, req SubmitRequest) (SubmitResult, error)
	GetProgress(ctx context.Context, providerTaskID string) (ProgressResult, error)
	ParseCallback(ctx context.Context, body []byte) (ProgressResult, string, error)
}
