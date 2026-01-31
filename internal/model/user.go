package model

type UserRole string

const (
	UserRoleAdmin UserRole = "admin"
	UserRoleUser  UserRole = "user"
)

type User struct {
	BaseModel
	Username string   `gorm:"type:varchar(50);uniqueIndex;not null;comment:用户名" json:"username"`
	Password string   `gorm:"type:varchar(100);not null;comment:密码(加密)" json:"-"`
	Role     UserRole `gorm:"type:varchar(10);default:'user';comment:角色(admin/user)" json:"role"`
	Balance  float64  `gorm:"type:decimal(10,4);default:0;comment:账户余额" json:"balance"`
	Status   int8     `gorm:"default:1;comment:状态(1启用/0禁用)" json:"status"`
}

func (User) TableName() string {
	return "users"
}
