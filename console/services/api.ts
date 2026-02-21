import {
    User,
    UserRole,
    Channel,
    ChannelAccount,
    ApiToken,
    LogEntry,
    Capability,
    ChannelCapability,
    ChannelPriorityItem,
    CapabilityWithChannels,
    ChatModel,
    ChatModelChannel,
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

// 修改密码
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    await request('/user/password', {
        method: 'PUT',
        body: JSON.stringify({old_password: oldPassword, new_password: newPassword}),
    });
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
      channelPriorities: (t.channel_priorities || []).map((p: any) => ({
          capabilityCode: p.capability_code,
          channelId: p.channel_id,
          priority: p.priority,
      })),
  }));
};

export const getToken = async (id: string): Promise<ApiToken> => {
    const t = await request<any>(`/tokens/${id}`);
    return {
        id: String(t.id),
        name: t.name,
        key: t.key,
        balance: t.balance,
        totalUsed: t.total_used,
        status: t.status === 1 ? 'active' : 'expired',
        channelPriorities: (t.channel_priorities || []).map((p: any) => ({
            capabilityCode: p.capability_code,
            channelId: p.channel_id,
            priority: p.priority,
        })),
    };
};

export const createToken = async (
    name: string,
    balance: number,
    channelPriorities?: ChannelPriorityItem[]
): Promise<{ id: string; key: string; balance: number }> => {
    const body: any = {name, balance};
    if (channelPriorities && channelPriorities.length > 0) {
        body.channel_priorities = channelPriorities.map(p => ({
            capability_code: p.capabilityCode,
            channel_id: p.channelId,
            priority: p.priority,
        }));
    }
    const data = await request<{ id: number; name: string; key: string; balance: number }>('/tokens', {
    method: 'POST',
        body: JSON.stringify(body),
  });
  return {
    id: String(data.id),
    key: data.key,
      balance: data.balance,
  };
};

export const updateToken = async (
    id: string,
    data: { name?: string; channelPriorities?: ChannelPriorityItem[] }
): Promise<void> => {
    const body: any = {};
    if (data.name) {
        body.name = data.name;
    }
    if (data.channelPriorities !== undefined) {
        body.channel_priorities = data.channelPriorities.map(p => ({
            capability_code: p.capabilityCode,
            channel_id: p.channelId,
            priority: p.priority,
        }));
    }
    await request(`/tokens/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
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
    type?: string;
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
      type: c.type || 'image',
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
    type?: string;
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

// 重试请求
export const retryRequestLog = async (id: number): Promise<ChannelRequestLog> => {
    return await request<ChannelRequestLog>(`/admin/request-logs/${id}/retry`, {
        method: 'POST',
    });
};

// 用户级 API - 获取能力及可用渠道列表
export const fetchCapabilityChannels = async (): Promise<CapabilityWithChannels[]> => {
    const data = await request<any[]>('/capability-channels');
    return data.map(c => ({
        code: c.code,
        name: c.name,
        type: c.type,
        description: c.description,
        channels: (c.channels || []).map((ch: any) => ({
            channelId: ch.channel_id,
            channelType: ch.channel_type,
            channelName: ch.channel_name,
            model: ch.model,
            price: ch.price,
        })),
    }));
};

// 用户级 API - 获取 Chat 模型及可用渠道列表
export const fetchChatModelChannelsForToken = async (): Promise<CapabilityWithChannels[]> => {
    const data = await request<any[]>('/chat-model-channels');
    return data.map(c => ({
        code: c.code,
        name: c.name,
        type: c.type,
        description: c.description,
        channels: (c.channels || []).map((ch: any) => ({
            channelId: ch.channel_id,
      channelType: ch.channel_type,
            channelName: ch.channel_name,
            model: ch.model,
            price: ch.price,
    })),
  }));
};

// 用户级 API - 获取所有能力和 Chat 模型的渠道列表（合并）
export const fetchAllCapabilityChannels = async (): Promise<CapabilityWithChannels[]> => {
    const [capabilities, chatModels] = await Promise.all([
        fetchCapabilityChannels(),
        fetchChatModelChannelsForToken(),
    ]);
    return [...capabilities, ...chatModels];
};

// ========== Chat 模型管理 ==========

export const fetchChatModels = async (): Promise<ChatModel[]> => {
    const data = await request<any[]>('/admin/chat-models');
    return data.map(m => ({
        id: m.id,
        code: m.code,
        name: m.name,
        provider: m.provider,
        description: m.description,
        status: m.status,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
    }));
};

export const getChatModel = async (code: string): Promise<ChatModel> => {
    const m = await request<any>(`/admin/chat-models/${code}`);
    return {
        id: m.id,
        code: m.code,
        name: m.name,
        provider: m.provider,
        description: m.description,
        status: m.status,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
    };
};

export const createChatModel = async (data: {
    code: string;
    name: string;
    provider: string;
    description?: string;
}): Promise<ChatModel> => {
    const m = await request<any>('/admin/chat-models', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return {
        id: m.id,
        code: m.code,
        name: m.name,
        provider: m.provider,
        description: m.description,
        status: m.status,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
    };
};

export const updateChatModel = async (code: string, data: {
    name?: string;
    provider?: string;
    description?: string;
    status?: number;
}): Promise<void> => {
    await request(`/admin/chat-models/${code}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const deleteChatModel = async (code: string): Promise<void> => {
    await request(`/admin/chat-models/${code}`, {method: 'DELETE'});
};

// ========== Chat 模型渠道映射 ==========

export const fetchChatModelChannels = async (
    modelCode?: string,
    channelId?: number
): Promise<ChatModelChannel[]> => {
    const params = new URLSearchParams();
    if (modelCode) params.append('model_code', modelCode);
    if (channelId) params.append('channel_id', channelId.toString());
    const query = params.toString();
    const data = await request<any[]>(`/admin/chat-model-channels${query ? '?' + query : ''}`);
    return data.map(mc => ({
        id: mc.id,
        modelCode: mc.model_code,
        channelId: mc.channel_id,
        vendorModel: mc.vendor_model,
        priority: mc.priority,
        priceMode: mc.price_mode,
        inputPrice: mc.input_price,
        outputPrice: mc.output_price,
        requestPath: mc.request_path,
        timeout: mc.timeout,
        extraHeaders: mc.extra_headers || {},
        extraConfig: mc.extra_config || {},
        status: mc.status,
        createdAt: mc.created_at,
        updatedAt: mc.updated_at,
        chatModel: mc.chat_model ? {
            id: mc.chat_model.id,
            code: mc.chat_model.code,
            name: mc.chat_model.name,
            provider: mc.chat_model.provider,
            description: mc.chat_model.description,
            status: mc.chat_model.status,
            createdAt: mc.chat_model.created_at,
            updatedAt: mc.chat_model.updated_at,
        } : undefined,
        channel: mc.channel,
    }));
};

export const getChatModelChannel = async (id: number): Promise<ChatModelChannel> => {
    const mc = await request<any>(`/admin/chat-model-channels/${id}`);
    return {
        id: mc.id,
        modelCode: mc.model_code,
        channelId: mc.channel_id,
        vendorModel: mc.vendor_model,
        priority: mc.priority,
        priceMode: mc.price_mode,
        inputPrice: mc.input_price,
        outputPrice: mc.output_price,
        requestPath: mc.request_path,
        timeout: mc.timeout,
        extraHeaders: mc.extra_headers || {},
        extraConfig: mc.extra_config || {},
        status: mc.status,
        createdAt: mc.created_at,
        updatedAt: mc.updated_at,
        chatModel: mc.chat_model ? {
            id: mc.chat_model.id,
            code: mc.chat_model.code,
            name: mc.chat_model.name,
            provider: mc.chat_model.provider,
            description: mc.chat_model.description,
            status: mc.chat_model.status,
            createdAt: mc.chat_model.created_at,
            updatedAt: mc.chat_model.updated_at,
        } : undefined,
        channel: mc.channel,
    };
};

export const createChatModelChannel = async (data: {
    model_code: string;
    channel_id: number;
    vendor_model: string;
    priority?: number;
    price_mode?: string;
    input_price?: number;
    output_price?: number;
    request_path?: string;
    timeout?: number;
}): Promise<ChatModelChannel> => {
    const mc = await request<any>('/admin/chat-model-channels', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return {
        id: mc.id,
        modelCode: mc.model_code,
        channelId: mc.channel_id,
        vendorModel: mc.vendor_model,
        priority: mc.priority,
        priceMode: mc.price_mode,
        inputPrice: mc.input_price,
        outputPrice: mc.output_price,
        requestPath: mc.request_path,
        timeout: mc.timeout,
        extraHeaders: mc.extra_headers || {},
        extraConfig: mc.extra_config || {},
        status: mc.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

export const updateChatModelChannel = async (
    id: number,
    data: {
        vendor_model?: string;
        priority?: number;
        price_mode?: string;
        input_price?: number;
        output_price?: number;
        request_path?: string;
        timeout?: number;
        status?: number;
    }
): Promise<void> => {
    await request(`/admin/chat-model-channels/${id}`, {
    method: 'PUT',
        body: JSON.stringify(data),
  });
};

export const deleteChatModelChannel = async (id: number): Promise<void> => {
    await request(`/admin/chat-model-channels/${id}`, {method: 'DELETE'});
};

// ========== 对话记录 ==========

import {Conversation, ChatMessage} from '../types';

export interface ConversationListParams {
    page?: number;
    page_size?: number;
    model?: string;
    keyword?: string;
    token_id?: number;
    start_date?: string;
    end_date?: string;
}

export interface ConversationListResponse {
    items: Conversation[];
    total: number;
    page: number;
    page_size: number;
}

export const fetchConversations = async (params?: ConversationListParams): Promise<ConversationListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.page_size) query.append('page_size', String(params.page_size));
    if (params?.model) query.append('model', params.model);
    if (params?.keyword) query.append('keyword', params.keyword);
    if (params?.token_id) query.append('token_id', String(params.token_id));
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);

    const url = query.toString() ? `/conversations?${query}` : '/conversations';
    const data = await request<any>(url);
    return {
        items: data.items.map((c: any) => ({
            id: c.id,
            userId: c.user_id,
            tokenId: c.token_id,
            title: c.title,
            model: c.model,
            systemPrompt: c.system_prompt,
            totalTokens: c.total_tokens,
            messageCount: c.message_count,
            totalCost: c.total_cost,
            status: c.status,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
        })),
        total: data.total,
        page: data.page,
        page_size: data.page_size,
    };
};

export interface ConversationMessagesResponse {
    items: ChatMessage[];
    total: number;
    page: number;
    page_size: number;
    conversation: Conversation;
}

export const fetchConversationMessages = async (
    conversationId: number,
    page?: number,
    pageSize?: number
): Promise<ConversationMessagesResponse> => {
    const query = new URLSearchParams();
    if (page) query.append('page', String(page));
    if (pageSize) query.append('page_size', String(pageSize));

    const url = query.toString()
        ? `/conversations/${conversationId}/messages?${query}`
        : `/conversations/${conversationId}/messages`;

    const data = await request<any>(url);
    return {
        items: data.items.map((m: any) => ({
            id: m.id,
            conversationId: m.conversation_id,
            role: m.role,
            content: m.content,
            inputTokens: m.input_tokens,
            outputTokens: m.output_tokens,
            model: m.model,
            latencyMs: m.latency_ms,
            cost: m.cost,
            createdAt: m.created_at,
        })),
        total: data.total,
        page: data.page,
        page_size: data.page_size,
        conversation: {
            id: data.conversation.id,
            userId: data.conversation.user_id,
            tokenId: data.conversation.token_id,
            title: data.conversation.title,
            model: data.conversation.model,
            systemPrompt: data.conversation.system_prompt,
            totalTokens: data.conversation.total_tokens,
            messageCount: data.conversation.message_count,
            totalCost: 0,
            status: data.conversation.status,
            createdAt: data.conversation.created_at,
            updatedAt: data.conversation.updated_at,
        },
    };
};
