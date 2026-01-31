import React, { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, Edit3, Trash2, Shield, ChevronDown, ChevronRight, Key, Cpu, X, Power } from 'lucide-react';
import {
    fetchChannels,
    createChannel,
    updateChannel,
    deleteChannel,
    fetchChannelAccounts,
    createChannelAccount,
    updateChannelAccount,
    deleteChannelAccount,
    fetchChannelCapabilities,
    createChannelCapability,
    updateChannelCapability,
    deleteChannelCapability
} from '../services/api';
import {Channel, ChannelAccount, ChannelCapability} from '../types';

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: '已启用', color: 'bg-green-100 text-green-700' },
  0: { label: '已禁用', color: 'bg-gray-100 text-gray-700' },
};

const RESULT_MODES = [
  { value: 'sync', label: '同步' },
  { value: 'poll', label: '轮询' },
  { value: 'callback', label: '回调' },
];

// 新建/编辑渠道弹窗
const ChannelModal: React.FC<{
  isOpen: boolean;
  channel?: Channel | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}> = ({ isOpen, channel, onClose, onSave }) => {
  const [form, setForm] = useState({ type: '', name: '', base_url: '', config: '{}' });
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    if (channel) {
      setForm({
        type: channel.type,
        name: channel.name,
        base_url: channel.baseUrl,
        config: JSON.stringify(channel.config || {}, null, 2)
      });
    } else {
      setForm({ type: '', name: '', base_url: '', config: '{}' });
    }
    setJsonError('');
  }, [channel, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(form.config);
      setJsonError('');
    } catch {
      setJsonError('JSON 格式错误');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        type: form.type,
        name: form.name,
        base_url: form.base_url,
        config: JSON.parse(form.config)
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">{channel ? '编辑渠道' : '新建渠道'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">渠道标识</label>
            <input
              type="text"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              disabled={!!channel}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
              placeholder="如: duomi, openai"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">渠道名称</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="如: 多米API"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">基础 URL</label>
            <input
              type="text"
              value={form.base_url}
              onChange={e => setForm({ ...form, base_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="如: https://duomiapi.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">渠道配置 (JSON)</label>
            <textarea
              value={form.config}
              onChange={e => setForm({ ...form, config: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${jsonError ? 'border-red-300' : 'border-gray-200'}`}
              placeholder='{"timeout": 30, "retry": 3}'
              rows={3}
            />
            {jsonError && <p className="text-xs text-red-500 mt-1">{jsonError}</p>}
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 新建/编辑账号弹窗
const AccountModal: React.FC<{
  isOpen: boolean;
  channelId: string;
  account?: ChannelAccount | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}> = ({ isOpen, channelId, account, onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', api_key: '', weight: 10, config: '{}' });
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name,
          api_key: account.api_key,
        weight: account.weight,
        config: JSON.stringify(account.config || {}, null, 2)
      });
    } else {
      setForm({ name: '', api_key: '', weight: 10, config: '{}' });
    }
    setJsonError('');
  }, [account, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(form.config);
      setJsonError('');
    } catch {
      setJsonError('JSON 格式错误');
      return;
    }
    setLoading(true);
    try {
      const data: any = {
        channel_id: Number(channelId),
        name: form.name,
        weight: form.weight,
        config: JSON.parse(form.config)
      };
      if (form.api_key) data.api_key = form.api_key;
      await onSave(data);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">{account ? '编辑账号' : '新建账号'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号名称</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="如: 主账号"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
                type="text"
              value={form.api_key}
              onChange={e => setForm({ ...form, api_key: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="输入 API Key"
                required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">权重</label>
            <input
              type="number"
              value={form.weight}
              onChange={e => setForm({ ...form, weight: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min={1}
              max={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号配置 (JSON)</label>
            <textarea
              value={form.config}
              onChange={e => setForm({ ...form, config: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${jsonError ? 'border-red-300' : 'border-gray-200'}`}
              placeholder='{"extra_headers": {}, "rate_limit": 100}'
              rows={3}
            />
            {jsonError && <p className="text-xs text-red-500 mt-1">{jsonError}</p>}
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 渠道行组件
const ChannelRow: React.FC<{
  channel: Channel;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  accounts: ChannelAccount[];
    capabilities: ChannelCapability[];
  onAddAccount: () => void;
  onEditAccount: (acc: ChannelAccount) => void;
  onDeleteAccount: (id: string) => void;
  onToggleAccountStatus: (acc: ChannelAccount) => void;
    onAddCapability: () => void;
    onEditCapability: (c: ChannelCapability) => void;
    onDeleteCapability: (id: string) => void;
    onToggleCapabilityStatus: (c: ChannelCapability) => void;
}> = ({
  channel, expanded, onToggle, onEdit, onDelete, onToggleStatus,
          accounts, capabilities, onAddAccount, onEditAccount, onDeleteAccount, onToggleAccountStatus,
          onAddCapability, onEditCapability, onDeleteCapability, onToggleCapabilityStatus
}) => {
  const status = STATUS_MAP[channel.status] || STATUS_MAP[0];

  const getResultModeLabel = (mode: string) => {
    return RESULT_MODES.find(m => m.value === mode)?.label || mode;
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors group border-b border-gray-100">
        <td className="px-6 py-4">
          <button onClick={onToggle} className="p-1 hover:bg-gray-100 rounded">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase text-xs">
              {channel.type.substring(0, 2)}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">{channel.name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Shield size={10} />
                {channel.type}
              </div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
            {status.label}
          </span>
        </td>
        <td className="px-6 py-4 text-center">
          <span className="text-sm font-semibold text-gray-700">{channel.accountsCount}</span>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onToggleStatus} className={`p-2 rounded-lg ${channel.status === 1 ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`} title={channel.status === 1 ? '禁用' : '启用'}>
              <Power size={16} />
            </button>
            <button onClick={onEdit} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="编辑">
              <Edit3 size={16} />
            </button>
            <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="删除">
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-gray-50/50 px-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* 账号列表 */}
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Key size={14} /> 账号列表
                  </h4>
                  <button onClick={onAddAccount} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <Plus size={14} /> 添加
                  </button>
                </div>
                {accounts.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">暂无账号</p>
                ) : (
                  <div className="space-y-2">
                    {accounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group/acc">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{acc.name}</div>
                          <div className="text-xs text-gray-500">权重: {acc.weight} | 任务: {acc.currentTasks}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/acc:opacity-100">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${acc.status === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {acc.status === 1 ? '启用' : '禁用'}
                          </span>
                          <button onClick={() => onToggleAccountStatus(acc)} className="p-1 hover:bg-gray-200 rounded"><Power size={12} /></button>
                          <button onClick={() => onEditAccount(acc)} className="p-1 hover:bg-gray-200 rounded"><Edit3 size={12} /></button>
                          <button onClick={() => onDeleteAccount(acc.id)} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                {/* 能力配置列表 */}
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Cpu size={14}/> 能力配置
                  </h4>
                    <button onClick={onAddCapability}
                            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <Plus size={14} /> 添加
                  </button>
                </div>
                  {capabilities.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">暂无能力配置</p>
                ) : (
                  <div className="space-y-2">
                      {capabilities.map(c => (
                          <div key={c.id}
                               className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group/cap">
                        <div>
                            <div
                                className="text-sm font-medium text-gray-900">{c.name || c.model || c.capabilityCode}</div>
                          <div className="text-xs text-gray-500">
                              {c.capabilityCode} | {getResultModeLabel(c.resultMode)} | ¥{c.price}
                          </div>
                        </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover/cap:opacity-100">
                          <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.status === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.status === 1 ? '启用' : '禁用'}
                          </span>
                                  <button onClick={() => onToggleCapabilityStatus(c)}
                                          className="p-1 hover:bg-gray-200 rounded"><Power size={12}/></button>
                                  <button onClick={() => onEditCapability(c)} className="p-1 hover:bg-gray-200 rounded">
                                      <Edit3 size={12}/></button>
                                  <button onClick={() => onDeleteCapability(c.id)}
                                          className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={12}/>
                                  </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const Channels: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [accounts, setAccounts] = useState<Record<string, ChannelAccount[]>>({});
    const [capabilities, setCapabilities] = useState<Record<string, ChannelCapability[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [channelModal, setChannelModal] = useState<{ open: boolean; channel: Channel | null }>({ open: false, channel: null });
  const [accountModal, setAccountModal] = useState<{ open: boolean; channelId: string; account: ChannelAccount | null }>({ open: false, channelId: '', account: null });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const channelsData = await fetchChannels();
      setChannels(channelsData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadChannelDetails = async (channelId: string) => {
      const [accountsData, capabilitiesData] = await Promise.all([
      fetchChannelAccounts(channelId),
          fetchChannelCapabilities(channelId),
    ]);
    setAccounts(prev => ({ ...prev, [channelId]: accountsData }));
      setCapabilities(prev => ({...prev, [channelId]: capabilitiesData}));
  };

  const toggleExpand = async (channelId: string) => {
    const newExpanded = new Set(expandedChannels);
    if (newExpanded.has(channelId)) {
      newExpanded.delete(channelId);
    } else {
      newExpanded.add(channelId);
      if (!accounts[channelId]) {
        await loadChannelDetails(channelId);
      }
    }
    setExpandedChannels(newExpanded);
  };

  const handleSaveChannel = async (data: any) => {
    if (channelModal.channel) {
      await updateChannel(channelModal.channel.id, data);
    } else {
      await createChannel(data);
    }
    await loadData();
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('确定删除此渠道？')) return;
    await deleteChannel(id);
    await loadData();
  };

  const handleToggleChannelStatus = async (channel: Channel) => {
    await updateChannel(channel.id, { status: channel.status === 1 ? 0 : 1 });
    await loadData();
  };

  const handleSaveAccount = async (data: any) => {
    const channelId = accountModal.channelId;
    if (accountModal.account) {
      await updateChannelAccount(accountModal.account.id, data);
    } else {
      await createChannelAccount(data);
    }
    await loadChannelDetails(channelId);
    await loadData();
  };

  const handleDeleteAccount = async (channelId: string, accountId: string) => {
    if (!confirm('确定删除此账号？')) return;
    await deleteChannelAccount(accountId);
    await loadChannelDetails(channelId);
    await loadData();
  };

  const handleToggleAccountStatus = async (channelId: string, account: ChannelAccount) => {
    await updateChannelAccount(account.id, { status: account.status === 1 ? 0 : 1 });
    await loadChannelDetails(channelId);
  };

    const handleDeleteCapability = async (channelId: string, capabilityId: string) => {
        if (!confirm('确定删除此能力配置？')) return;
        await deleteChannelCapability(capabilityId);
    await loadChannelDetails(channelId);
    await loadData();
  };

    const handleToggleCapabilityStatus = async (channelId: string, capability: ChannelCapability) => {
        await updateChannelCapability(capability.id, {status: capability.status === 1 ? 0 : 1});
    await loadChannelDetails(channelId);
  };

  const filteredChannels = channels.filter(ch =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">渠道管理</h1>
          <p className="text-gray-500 mt-1">配置上游服务商、账号池及模型映射</p>
        </div>
        <button
          onClick={() => setChannelModal({ open: true, channel: null })}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <Plus size={18} />
          新建渠道
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索名称或类型..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1"></div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 w-12"></th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">名称 / 类型</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">账号数</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-100">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-12 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-12 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-10 ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredChannels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    暂无渠道数据
                  </td>
                </tr>
              ) : (
                filteredChannels.map(channel => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    expanded={expandedChannels.has(channel.id)}
                    onToggle={() => toggleExpand(channel.id)}
                    onEdit={() => setChannelModal({ open: true, channel })}
                    onDelete={() => handleDeleteChannel(channel.id)}
                    onToggleStatus={() => handleToggleChannelStatus(channel)}
                    accounts={accounts[channel.id] || []}
                    capabilities={capabilities[channel.id] || []}
                    onAddAccount={() => setAccountModal({ open: true, channelId: channel.id, account: null })}
                    onEditAccount={acc => setAccountModal({ open: true, channelId: channel.id, account: acc })}
                    onDeleteAccount={id => handleDeleteAccount(channel.id, id)}
                    onToggleAccountStatus={acc => handleToggleAccountStatus(channel.id, acc)}
                    onAddCapability={() => window.location.hash = '#/capabilities'}
                    onEditCapability={() => window.location.hash = '#/capabilities'}
                    onDeleteCapability={id => handleDeleteCapability(channel.id, id)}
                    onToggleCapabilityStatus={c => handleToggleCapabilityStatus(channel.id, c)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ChannelModal
        isOpen={channelModal.open}
        channel={channelModal.channel}
        onClose={() => setChannelModal({ open: false, channel: null })}
        onSave={handleSaveChannel}
      />
      <AccountModal
        isOpen={accountModal.open}
        channelId={accountModal.channelId}
        account={accountModal.account}
        onClose={() => setAccountModal({ open: false, channelId: '', account: null })}
        onSave={handleSaveAccount}
      />
    </div>
  );
};

export default Channels;
