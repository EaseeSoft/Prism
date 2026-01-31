package worker

const (
	TypeTaskSubmit = "task:submit"
	TypeTaskPoll   = "task:poll"
	TypeTaskUpload = "task:upload"
	TypeTaskNotify = "task:notify"
)

type TaskSubmitPayload struct {
	TaskID uint `json:"task_id"`
}

type TaskPollPayload struct {
	TaskID    uint `json:"task_id"`
	PollCount int  `json:"poll_count"`
}

type TaskUploadPayload struct {
	TaskID    uint     `json:"task_id"`
	OriginURL string   `json:"origin_url"`
	URLs      []string `json:"urls"`
}

type TaskNotifyPayload struct {
	TaskID uint `json:"task_id"`
}
