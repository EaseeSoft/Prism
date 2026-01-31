
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  balance: number;
  avatar?: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  type: string;
  name: string;
  baseUrl: string;
  config: Record<string, any>;
  status: number;
  accountsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelAccount {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  config: Record<string, any>;
  weight: number;
  status: number;
  currentTasks: number;
  createdAt: string;
  updatedAt: string;
}

// 能力定义
export interface Capability {
  code: string;
  name: string;
    type: 'image' | 'video' | 'chat' | 'other';
  description: string;
  standardParams: Record<string, any>;
  standardResponse: Record<string, any>;
  status: number;
  createdAt: string;
  updatedAt: string;
}

// 渠道能力配置
export interface ChannelCapability {
  id: string;
  channelId: string;
  capabilityCode: string;
  model: string;
  name: string;
  price: number;
  priceUnit: string;
  resultMode: 'sync' | 'poll' | 'callback';
  requestPath: string;
  requestMethod: string;
  contentType: string;
    // 认证配置
    authLocation: 'header' | 'body' | 'query';
    authKey: string;
    authValuePrefix: string;
    // 轮询配置
  pollPath: string;
    pollMethod: string;
  pollInterval: number;
  pollMaxAttempts: number;
    pollParamMapping: Record<string, any>;
    pollResponseMapping: Record<string, any>;
    // 映射配置
  paramMapping: Record<string, any>;
  responseMapping: Record<string, any>;
  callbackMapping: Record<string, any>;
  extraConfig: Record<string, any>;
  status: number;
  createdAt: string;
  updatedAt: string;
  channel?: Channel;
  capability?: Capability;
}

export interface ApiToken {
  id: string;
  name: string;
  key: string;
    balance: number;
    totalUsed: number;
  status: 'active' | 'expired';
}

export interface TaskLog {
  id: string;
  task_no: string;
  capability: string;
  capability_name: string;
  channel: string;
  status: string;
  progress: number;
  cost: number;
    refunded: boolean;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface TaskDetail extends TaskLog {
  raw_params?: Record<string, any>;
  vendor_response?: Record<string, any>;
  result?: Record<string, any>;
  vendor_task_id?: string;
  started_at?: string;
}

export interface DashboardStats {
  today: {
    total_requests: number;
    total_cost: number;
    success_count: number;
    failed_count: number;
    error_rate: number;
    request_trend: number;
    cost_trend: number;
  };
  weekly_trend: Array<{
    date: string;
    requests: number;
    cost: number;
    errors: number;
  }>;
  capability_dist: Array<{
    capability: string;
    count: number;
  }>;
}

// 兼容旧的 LogEntry 接口
export interface LogEntry {
  id: string;
  traceId: string;
  model: string;
  prompt: string;
  response: string;
  status: number;
  latency: number;
  cost: number;
  timestamp: string;
  userId: string;
}

// 渠道请求日志
export interface ChannelRequestLog {
  id: number;
  task_id: number;
  task_no: string;
  channel_id: number;
  account_id: number;
  capability_code: string;
  request_type: 'submit' | 'poll' | 'callback';
  method: string;
  url: string;
  request_headers: string;
  request_body: string;
  status_code: number;
  response_body: string;
  duration_ms: number;
  error_message: string;
  request_at: string;
  created_at: string;
  channel_name?: string;
  channel_type?: string;
  capability_name?: string;
}
