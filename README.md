<p align="center">
  <img src="console/assets/logo.png" width="120" alt="Prism Logo" />
</p>

<h1 align="center">Prism - 棱镜</h1>

Prism (棱镜) 是一个轻量级 AI Gateway 平台，提供统一的多渠道 AI 服务接入、智能路由、任务管理和计费能力。通过标准化的 API 接口，将 Midjourney、Runway、Sora 等不同 AI 服务商的能力统一封装，让调用方无需关心底层差异。

## 功能特性

- **统一 API** - 标准化接口封装文生图、图生视频、文生视频等 AI 能力，一套接口对接所有渠道
- **多渠道路由** - 支持多个 AI 服务商同时接入，自动路由和负载均衡
- **异步任务引擎** - 支持同步、轮询、回调三种结果获取模式，覆盖各类上游 API 的交互方式
- **计费管理** - 内置 Token 和用户余额体系，按调用计费
- **管理后台** - 可视化管理渠道、能力、用户、日志，数据一目了然
- **前端嵌入** - 前端构建产物嵌入 Go 二进制，单文件部署

## 技术栈

### 后端

| 技术 | 说明 |
|------|------|
| Go | 核心语言 |
| Gin | Web 框架 |
| GORM | ORM |
| MySQL | 数据存储 |
| Redis | 缓存 & 消息队列 |
| Asynq | 异步任务处理 |
| JWT | 接口认证 |
| Zap | 结构化日志 |
| Viper | 配置管理 |

### 前端

| 技术 | 说明 |
|------|------|
| React 19 | UI 框架 |
| TypeScript | 开发语言 |
| Vite | 构建工具 |
| Tailwind CSS 4 | 样式方案 |
| Recharts | 数据图表 |
| React Router | 路由管理 |

## 项目结构

```
Prism/
├── cmd/server/          # 服务启动入口
├── internal/
│   ├── api/             # 路由 & 中间件 & 接口处理
│   ├── model/           # 数据库模型
│   ├── service/         # 业务逻辑层
│   ├── provider/        # AI 渠道提供商适配
│   └── worker/          # 异步任务 (提交/轮询/回调/上传)
├── pkg/                 # 通用工具包 (数据库/缓存/队列/日志/认证/存储)
├── configs/             # 配置文件
├── console/             # React 前端应用
└── build.bat            # 构建脚本
```

## 快速开始

### 环境要求

- Go 1.25+
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### 配置

复制示例配置并修改：

```bash
cp configs/config.example.yaml configs/config.yaml
```

编辑 `configs/config.yaml`，填写数据库和 Redis 连接信息：

```yaml
server:
  port: 23523
  jwt_secret: "your-secret-key-change-in-production"

database:
  host: 127.0.0.1
  port: 3306
  user: root
  password: your_password
  dbname: prism

redis:
  addr: 127.0.0.1:6379
  password: ""
  db: 0
```

### 编译

运行构建脚本，前端和后端会一起编译，产出 Linux AMD64 二进制文件：

```bash
build.bat
```

构建完成后 `dist/` 目录结构：

```
dist/
├── prism                        # 可执行文件 (Linux AMD64)
└── configs/
    └── config.example.yaml      # 示例配置
```

### 部署

将 `dist/` 目录中的文件上传到服务器，配置后直接运行：

```bash
# 1. 复制示例配置
cp configs/config.example.yaml configs/config.yaml

# 2. 编辑配置
vim configs/config.yaml

# 3. 启动服务
chmod +x prism
./prism
```

服务默认监听 `23523` 端口，访问 `http://your-server:23523` 即可打开管理后台。

## API 概览

### 外部调用接口 (Token 认证)

```
POST   /v1/capabilities/:capability   # 调用 AI 能力
GET    /v1/tasks/:task_no              # 查询任务状态
POST   /v1/tasks/:task_no/cancel       # 取消任务
GET    /v1/channels                    # 获取可用渠道
GET    /v1/capabilities                # 获取可用能力
```

### 兼容接口

```
POST   /v1/images/generations          # 文生图
POST   /v1/videos/generations          # 文生视频
```

### 管理接口 (JWT 认证)

```
# 认证
POST   /api/auth/register              # 注册
POST   /api/auth/login                 # 登录

# 仪表盘
GET    /api/dashboard/stats            # 统计数据

# 管理 (Admin)
/api/admin/channels                    # 渠道管理
/api/admin/capabilities                # 能力管理
/api/admin/users                       # 用户管理
/api/admin/channel-accounts            # 渠道账号管理
/api/admin/channel-capabilities        # 渠道能力配置
/api/admin/request-logs                # 请求日志
```

## License

MIT

## Star History

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=EaseeSoft/Prism&type=date&legend=top-left)](https://www.star-history.com/#EaseeSoft/Prism&type=date&legend=top-left)
