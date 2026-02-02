import {
    User,
    UserRole,
    Channel,
    ChannelAccount,
    ApiToken,
    LogEntry,
    Capability,
    ChannelCapability
} from '../types';

const API_BASE = '/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('prism_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  });

    if (response.status === 401) {
        localStorage.removeItem('prism_token');
        localStorage.removeItem('prism_user');
        window.location.reload();
        throw new Error('Unauthorized');
    }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data.data;
};

// 认证 API
export const login = async (username: string, password: string): Promise<{ user: User; token: string }> => {
  const data = await request<{ token: string; user: { id: number; username: string; role: string; balance: number } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  localStorage.setItem('prism_token', data.token);

  return {
    user: {
      id: String(data.user.id),
      username: data.user.username,
      role: data.user.role as UserRole,
      balance: data.user.balance,
      createdAt: new Date().toISOString().split('T')[0],
    },
    token: data.token,
  };
};

export const register = async (username: string, password: string): Promise<{ user: User }> => {
  const data = await request<{ id: number; username: string; role: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  return {
    user: {
      id: String(data.id),
      username: data.username,
      role: data.role as UserRole,
      balance: 0,
      createdAt: new Date().toISOString().split('T')[0],
    },
  };
};

export const logout = async () => {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  localStorage.removeItem('prism_token');
  localStorage.removeItem('prism_user');
};

export const getCurrentUser = async (): Promise<User> => {
  const data = await request<{ id: number; username: string; role: string; balance: number }>('/user/me');
  return {
    id: String(data.id),
    username: data.username,
    role: data.role as UserRole,
    balance: data.balance,
    createdAt: new Date().toISOString().split('T')[0],
  };
};

// Token 管理 API
export const fetchTokens = async (): Promise<ApiToken[]> => {
  const data = await request<any[]>('/tokens');
  return data.map(t => ({
    id: String(t.id),
    name: t.name,
    key: t.key,
      balance: t.balance,
      totalUsed: t.total_used,
    status: t.status === 1 ? 'active' : 'expired',
  }));
};

export const createToken = async (name: string, balance: number): Promise<{
    id: string;
    key: string;
    balance: number
}> => {
    const data = await request<{ id: number; name: string; key: string; balance: number }>('/tokens', {
    method: 'POST',
        body: JSON.stringify({name, balance}),
  });
  return {
    id: String(data.id),
    key: data.key,
      balance: data.balance,
  };
};

export const deleteToken = async (id: string): Promise<void> => {
  await request(`/tokens/${id}`, { method: 'DELETE' });
};

export const rechargeToken = async (id: string, amount: number): Promise<{ id: string; balance: number }> => {
  const data = await request<{ id: number; balance: number }>(`/tokens/${id}/recharge`, {
    method: 'POST',
    body: JSON.stringify({amount}),
  });
  return {
    id: String(data.id),
    balance: data.balance,
  };
};

// 管理员 API - 用户管理
export const fetchUsers = async (): Promise<User[]> => {
  const data = await request<any[]>('/admin/users');
  return data.map(u => ({
    id: String(u.id),
    username: u.username,
    role: u.role as UserRole,
    balance: u.balance,
    createdAt: new Date(u.created_at).toISOString().split('T')[0],
  }));
};

export const updateUserRole = async (id: string, role: UserRole): Promise<void> => {
  await request(`/admin/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
};

export const updateUserStatus = async (id: string, status: number): Promise<void> => {
  await request(`/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

export const rechargeUser = async (id: string, amount: number): Promise<void> => {
    await request(`/admin/users/${id}/recharge`, {
        method: 'POST',
        body: JSON.stringify({amount}),
    });
};

// 管理员 API - 渠道管理
export const fetchChannels = async (): Promise<Channel[]> => {
  const data = await request<any[]>('/admin/channels');
  return data.map(ch => ({
    id: String(ch.id),
    type: ch.type,
    name: ch.name,
    baseUrl: ch.base_url,
    config: ch.config || {},
    status: ch.status,
    accountsCount: ch.accounts_count || 0,
    modelsCount: ch.models_count || 0,
    createdAt: ch.created_at,
    updatedAt: ch.updated_at,
  }));
};

export const getChannel = async (id: string): Promise<Channel> => {
  const ch = await request<any>(`/admin/channels/${id}`);
  return {
    id: String(ch.id),
    type: ch.type,
    name: ch.name,
    baseUrl: ch.base_url,
    config: ch.config || {},
    status: ch.status,
    accountsCount: ch.accounts_count || 0,
    createdAt: ch.created_at,
    updatedAt: ch.updated_at,
  };
};

export const createChannel = async (data: {
  type: string;
  name: string;
  base_url: string;
  config?: Record<string, any>;
}): Promise<Channel> => {
  const ch = await request<any>('/admin/channels', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return {
    id: String(ch.id),
    type: ch.type,
    name: ch.name,
    baseUrl: ch.base_url,
    config: {},
    status: ch.status,
    accountsCount: 0,
    modelsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const updateChannel = async (id: string, data: {
  name?: string;
  base_url?: string;
  config?: Record<string, any>;
  status?: number;
}): Promise<void> => {
  await request(`/admin/channels/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteChannel = async (id: string): Promise<void> => {
  await request(`/admin/channels/${id}`, { method: 'DELETE' });
};

// 管理员 API - 渠道账号管理
export const fetchChannelAccounts = async (channelId?: string): Promise<ChannelAccount[]> => {
  const url = channelId ? `/admin/channel-accounts?channel_id=${channelId}` : '/admin/channel-accounts';
  const data = await request<any[]>(url);
  return data.map(acc => ({
    id: String(acc.id),
    channelId: String(acc.channel_id),
    name: acc.name,
    apiKey: acc.api_key,
    config: acc.config || {},
    weight: acc.weight,
    status: acc.status,
    currentTasks: acc.current_tasks || 0,
    createdAt: acc.created_at,
    updatedAt: acc.updated_at,
  }));
};

export const getChannelAccount = async (id: string): Promise<ChannelAccount> => {
  const acc = await request<any>(`/admin/channel-accounts/${id}`);
  return {
    id: String(acc.id),
    channelId: String(acc.channel_id),
    name: acc.name,
    apiKey: acc.api_key,
    config: acc.config || {},
    weight: acc.weight,
    status: acc.status,
    currentTasks: acc.current_tasks || 0,
    createdAt: acc.created_at,
    updatedAt: acc.updated_at,
  };
};

export const createChannelAccount = async (data: {
  channel_id: number;
  name: string;
  api_key: string;
  config?: Record<string, any>;
  weight?: number;
}): Promise<ChannelAccount> => {
  const acc = await request<any>('/admin/channel-accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return {
    id: String(acc.id),
    channelId: String(acc.channel_id),
    name: acc.name,
    apiKey: '',
    config: {},
    weight: acc.weight,
    status: acc.status,
    currentTasks: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const updateChannelAccount = async (id: string, data: {
  name?: string;
  api_key?: string;
  config?: Record<string, any>;
  weight?: number;
  status?: number;
}): Promise<void> => {
  await request(`/admin/channel-accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteChannelAccount = async (id: string): Promise<void> => {
  await request(`/admin/channel-accounts/${id}`, { method: 'DELETE' });
};

// 仪表盘 API
import { DashboardStats, TaskLog, TaskDetail } from '../types';

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    return await request<DashboardStats>('/dashboard/stats');
};

// 任务日志 API
export interface TaskListParams {
  page?: number;
  page_size?: number;
  status?: string;
  capability?: string;
  start_date?: string;
  end_date?: string;
  keyword?: string;
}

export interface TaskListResponse {
  items: TaskLog[];
  total: number;
  page: number;
  page_size: number;
}

export const fetchTaskLogs = async (params?: TaskListParams): Promise<TaskListResponse> => {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.page_size) query.append('page_size', String(params.page_size));
  if (params?.status) query.append('status', params.status);
  if (params?.capability) query.append('capability', params.capability);
  if (params?.start_date) query.append('start_date', params.start_date);
  if (params?.end_date) query.append('end_date', params.end_date);
  if (params?.keyword) query.append('keyword', params.keyword);

    const url = query.toString() ? `/tasks?${query}` : '/tasks';
  return await request<TaskListResponse>(url);
};

export const fetchTaskDetail = async (taskNo: string): Promise<TaskDetail> => {
    return await request<TaskDetail>(`/tasks/${taskNo}`);
};

// 兼容旧的 fetchLogs（已废弃，使用 fetchTaskLogs 替代）
export const fetchLogs = async (): Promise<any[]> => {
  const resp = await fetchTaskLogs({ page: 1, page_size: 20 });
  return resp.items;
};

// 管理员 API - 能力管理
export const fetchCapabilities = async (): Promise<Capability[]> => {
  const data = await request<any[]>('/admin/capabilities');
  return data.map(c => ({
    code: c.code,
    name: c.name,
    type: c.type || 'image',
    description: c.description || '',
    standardParams: c.standard_params || {},
    standardResponse: c.standard_response || {},
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
};

export const getCapability = async (code: string): Promise<Capability> => {
  const c = await request<any>(`/admin/capabilities/${code}`);
  return {
    code: c.code,
    name: c.name,
    type: c.type || 'image',
    description: c.description || '',
    standardParams: c.standard_params || {},
    standardResponse: c.standard_response || {},
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
};

export const createCapability = async (data: {
  code: string;
  name: string;
  type?: 'image' | 'video' | 'chat' | 'other';
  description?: string;
  standard_params?: Record<string, any>;
  standard_response?: Record<string, any>;
}): Promise<Capability> => {
  const c = await request<any>('/admin/capabilities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return {
    code: c.code,
    name: c.name,
    type: c.type || data.type || 'image',
    description: c.description || '',
    standardParams: c.standard_params || {},
    standardResponse: c.standard_response || {},
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
};

export const updateCapability = async (code: string, data: {
  name?: string;
  type?: 'image' | 'video' | 'chat' | 'other';
  description?: string;
  standard_params?: Record<string, any>;
  standard_response?: Record<string, any>;
  status?: number;
}): Promise<void> => {
  await request(`/admin/capabilities/${code}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteCapability = async (code: string): Promise<void> => {
  await request(`/admin/capabilities/${code}`, { method: 'DELETE' });
};

// 管理员 API - 渠道能力配置管理
export const fetchChannelCapabilities = async (channelId?: string, capabilityCode?: string): Promise<ChannelCapability[]> => {
  const params = new URLSearchParams();
  if (channelId) params.append('channel_id', channelId);
  if (capabilityCode) params.append('capability_code', capabilityCode);
  const url = params.toString() ? `/admin/channel-capabilities?${params}` : '/admin/channel-capabilities';

  const data = await request<any[]>(url);
  return data.map(cc => ({
    id: String(cc.id),
    channelId: String(cc.channel_id),
    capabilityCode: cc.capability_code,
    model: cc.model || '',
    name: cc.name || '',
    price: cc.price || 0,
    priceUnit: cc.price_unit || 'request',
    resultMode: cc.result_mode || 'poll',
    requestPath: cc.request_path || '',
    requestMethod: cc.request_method || 'POST',
    contentType: cc.content_type || 'application/json',
    pollPath: cc.poll_path || '',
    pollMethod: cc.poll_method || 'GET',
    pollInterval: cc.poll_interval || 5,
    pollMaxAttempts: cc.poll_max_attempts || 60,
    pollParamMapping: cc.poll_param_mapping || {},
    pollResponseMapping: cc.poll_response_mapping || {},
    authLocation: cc.auth_location || 'header',
    authKey: cc.auth_key || 'Authorization',
    authValuePrefix: cc.auth_value_prefix ?? '',
    paramMapping: cc.param_mapping || {},
    responseMapping: cc.response_mapping || {},
    callbackMapping: cc.callback_mapping || {},
    extraConfig: cc.extra_config || {},
    status: cc.status,
    createdAt: cc.created_at,
    updatedAt: cc.updated_at,
    channel: cc.channel,
    capability: cc.capability,
  }));
};

export const getChannelCapability = async (id: string): Promise<ChannelCapability> => {
  const cc = await request<any>(`/admin/channel-capabilities/${id}`);
  return {
    id: String(cc.id),
    channelId: String(cc.channel_id),
    capabilityCode: cc.capability_code,
    model: cc.model || '',
    name: cc.name || '',
    price: cc.price || 0,
    priceUnit: cc.price_unit || 'request',
    resultMode: cc.result_mode || 'poll',
    requestPath: cc.request_path || '',
    requestMethod: cc.request_method || 'POST',
    contentType: cc.content_type || 'application/json',
    pollPath: cc.poll_path || '',
    pollMethod: cc.poll_method || 'GET',
    pollInterval: cc.poll_interval || 5,
    pollMaxAttempts: cc.poll_max_attempts || 60,
    pollParamMapping: cc.poll_param_mapping || {},
    pollResponseMapping: cc.poll_response_mapping || {},
    authLocation: cc.auth_location || 'header',
    authKey: cc.auth_key || 'Authorization',
    authValuePrefix: cc.auth_value_prefix ?? '',
    paramMapping: cc.param_mapping || {},
    responseMapping: cc.response_mapping || {},
    callbackMapping: cc.callback_mapping || {},
    extraConfig: cc.extra_config || {},
    status: cc.status,
    createdAt: cc.created_at,
    updatedAt: cc.updated_at,
    channel: cc.channel,
    capability: cc.capability,
  };
};

export const createChannelCapability = async (data: {
  channel_id: number;
  capability_code: string;
  model?: string;
  name?: string;
  price?: number;
  price_unit?: string;
  result_mode?: string;
  request_path?: string;
  request_method?: string;
  content_type?: string;
  poll_path?: string;
  poll_interval?: number;
  poll_max_attempts?: number;
  param_mapping?: Record<string, any>;
  response_mapping?: Record<string, any>;
  callback_mapping?: Record<string, any>;
  extra_config?: Record<string, any>;
}): Promise<ChannelCapability> => {
  const cc = await request<any>('/admin/channel-capabilities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return {
    id: String(cc.id),
    channelId: String(cc.channel_id),
    capabilityCode: cc.capability_code,
    model: cc.model || '',
    name: cc.name || '',
    price: cc.price || 0,
    priceUnit: cc.price_unit || 'request',
    resultMode: cc.result_mode || 'poll',
    requestPath: cc.request_path || '',
    requestMethod: cc.request_method || 'POST',
    contentType: cc.content_type || 'application/json',
    pollPath: cc.poll_path || '',
    pollMethod: cc.poll_method || 'GET',
    pollInterval: cc.poll_interval || 5,
    pollMaxAttempts: cc.poll_max_attempts || 60,
    pollParamMapping: cc.poll_param_mapping || {},
    pollResponseMapping: cc.poll_response_mapping || {},
    authLocation: cc.auth_location || 'header',
    authKey: cc.auth_key || 'Authorization',
    authValuePrefix: cc.auth_value_prefix ?? '',
    paramMapping: cc.param_mapping || {},
    responseMapping: cc.response_mapping || {},
    callbackMapping: cc.callback_mapping || {},
    extraConfig: cc.extra_config || {},
    status: cc.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const updateChannelCapability = async (id: string, data: Record<string, any>): Promise<void> => {
  await request(`/admin/channel-capabilities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteChannelCapability = async (id: string): Promise<void> => {
  await request(`/admin/channel-capabilities/${id}`, { method: 'DELETE' });
};

// 管理员 API - 渠道请求日志
import { ChannelRequestLog } from '../types';

export interface RequestLogListParams {
  page?: number;
  page_size?: number;
  channel_id?: number;
  capability_code?: string;
  request_type?: string;
  task_no?: string;
  start_date?: string;
  end_date?: string;
}

export interface RequestLogListResponse {
  items: ChannelRequestLog[];
  total: number;
  page: number;
  page_size: number;
}

export const fetchRequestLogs = async (params?: RequestLogListParams): Promise<RequestLogListResponse> => {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.page_size) query.append('page_size', String(params.page_size));
  if (params?.channel_id) query.append('channel_id', String(params.channel_id));
  if (params?.capability_code) query.append('capability_code', params.capability_code);
  if (params?.request_type) query.append('request_type', params.request_type);
  if (params?.task_no) query.append('task_no', params.task_no);
  if (params?.start_date) query.append('start_date', params.start_date);
  if (params?.end_date) query.append('end_date', params.end_date);

  const url = query.toString() ? `/admin/request-logs?${query}` : '/admin/request-logs';
  return await request<RequestLogListResponse>(url);
};

export const fetchRequestLogDetail = async (id: number): Promise<ChannelRequestLog> => {
  return await request<ChannelRequestLog>(`/admin/request-logs/${id}`);
};

// 能力价格列表（用户可见）
export interface CapabilityPrice {
  code: string;
  name: string;
  type: string;
  description: string;
  prices: {
    channel: string;
    model: string;
    price: number;
    price_unit: string;
  }[];
}

export const fetchCapabilityPrices = async (): Promise<CapabilityPrice[]> => {
  return await request<CapabilityPrice[]>('/capability-prices');
};
