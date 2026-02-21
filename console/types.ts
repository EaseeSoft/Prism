
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
  channelPriorities?: ChannelPriorityItem[];
}

// 渠道优先级配置项
export interface ChannelPriorityItem {
  capabilityCode: string;
  channelId: number;
  priority: number;
}

// 能力及其可用渠道
export interface CapabilityWithChannels {
  code: string;
  name: string;
  type: string;
  description: string;
  channels: ChannelOption[];
}

// 渠道选项
export interface ChannelOption {
  channelId: number;
  channelType: string;
  channelName: string;
  model: string;
  price: number;
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

// ========== Chat 模型相关 ==========

export interface ChatModel {
  id: number;
  code: string;
  name: string;
  provider: string;
  description: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatModelChannel {
  id: number;
  modelCode: string;
  channelId: number;
  vendorModel: string;
  priority: number;
  priceMode: 'token' | 'request';
  inputPrice: number;
  outputPrice: number;
  requestPath: string;
  timeout: number;
  extraHeaders: Record<string, string>;
  extraConfig: Record<string, any>;
  status: number;
  createdAt: string;
  updatedAt: string;
  chatModel?: ChatModel;
  channel?: Channel;
}

export interface Conversation {
  id: number;
  userId: number;
  tokenId: number;
  title: string;
  model: string;
  systemPrompt: string;
  totalTokens: number;
  messageCount: number;
  totalCost: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: 'system' | 'user' | 'assistant';
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  cost: number;
  createdAt: string;
}

// Provider 类型
export const CHAT_PROVIDERS = [
  {value: 'openai', label: 'OpenAI'},
  {value: 'anthropic', label: 'Anthropic (Claude)'},
  {value: 'google', label: 'Google (Gemini)'},
  {value: 'deepseek', label: 'DeepSeek'},
  {value: 'qwen', label: '通义千问'},
  {value: 'moonshot', label: 'Moonshot'},
];

// 计价模式
export const PRICE_MODES = [
  {value: 'token', label: '按 Token 计费'},
  {value: 'request', label: '按次计费'},
];
