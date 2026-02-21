import React, { useEffect, useState } from 'react';
import {
    Key,
    Plus,
    Copy,
    Trash2,
    CheckCircle2,
    AlertCircle,
    X,
    Wallet,
    PlusCircle,
    Edit2,
    ChevronUp,
    ChevronDown
} from 'lucide-react';
import {
    fetchTokens,
    createToken,
    deleteToken,
    rechargeToken,
    getToken,
    updateToken,
    fetchAllCapabilityChannels
} from '../services/api';
import {ApiToken, ChannelPriorityItem, CapabilityWithChannels, ChannelOption} from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';

const Tokens: React.FC = () => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
    const [newTokenBalance, setNewTokenBalance] = useState<string>('');
  const [newTokenKey, setNewTokenKey] = useState('');
  const [isCreating, setIsCreating] = useState(false);

    // 充值相关状态
    const [showRechargeModal, setShowRechargeModal] = useState(false);
    const [rechargeTokenId, setRechargeTokenId] = useState<string>('');
    const [rechargeTokenName, setRechargeTokenName] = useState<string>('');
    const [rechargeAmount, setRechargeAmount] = useState<string>('');
    const [isRecharging, setIsRecharging] = useState(false);

    // 编辑相关状态
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTokenId, setEditTokenId] = useState<string>('');
    const [editTokenName, setEditTokenName] = useState<string>('');
    const [editChannelPriorities, setEditChannelPriorities] = useState<ChannelPriorityItem[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [capabilityChannels, setCapabilityChannels] = useState<CapabilityWithChannels[]>([]);
    const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(false);

    // 创建时的渠道配置
    const [createChannelPriorities, setCreateChannelPriorities] = useState<ChannelPriorityItem[]>([]);
    const [showChannelConfig, setShowChannelConfig] = useState(false);

  const loadTokens = () => {
    setIsLoading(true);
    fetchTokens()
      .then(data => setTokens(data))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleCopy = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async () => {
    if (!newTokenName.trim()) return;
    setIsCreating(true);
    try {
        const balance = parseFloat(newTokenBalance) || 0;
        const result = await createToken(newTokenName, balance, createChannelPriorities.length > 0 ? createChannelPriorities : undefined);
      setNewTokenKey(result.key);
      loadTokens();
    } catch (err: any) {
      alert(err.message || '创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除令牌 "${name}" 吗? 此操作不可恢复。`)) return;
    try {
      await deleteToken(id);
      loadTokens();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

    const openRechargeModal = (token: ApiToken) => {
        setRechargeTokenId(token.id);
        setRechargeTokenName(token.name);
        setRechargeAmount('');
        setShowRechargeModal(true);
    };

    const handleRecharge = async () => {
        const amount = parseFloat(rechargeAmount);
        if (!amount || amount <= 0) {
            alert('请输入有效的充值金额');
            return;
        }
        setIsRecharging(true);
        try {
            await rechargeToken(rechargeTokenId, amount);
            loadTokens();
            setShowRechargeModal(false);
        } catch (err: any) {
            alert(err.message || '充值失败');
        } finally {
            setIsRecharging(false);
        }
    };

    // 打开编辑弹窗
    const openEditModal = async (token: ApiToken) => {
        setEditTokenId(token.id);
        setEditTokenName(token.name);
        setEditChannelPriorities(token.channelPriorities || []);
        setShowEditModal(true);

        // 加载能力渠道列表
        setIsLoadingCapabilities(true);
        try {
            const caps = await fetchAllCapabilityChannels();
            setCapabilityChannels(caps);
        } catch (err: any) {
            console.error('加载能力渠道列表失败:', err);
        } finally {
            setIsLoadingCapabilities(false);
        }
    };

    // 保存编辑
    const handleSaveEdit = async () => {
        setIsEditing(true);
        try {
            await updateToken(editTokenId, {
                name: editTokenName,
                channelPriorities: editChannelPriorities,
            });
            loadTokens();
            setShowEditModal(false);
        } catch (err: any) {
            alert(err.message || '保存失败');
        } finally {
            setIsEditing(false);
        }
    };

    // 获取某能力的已配置渠道
    const getCapabilityPriorities = (capabilityCode: string) => {
        return editChannelPriorities
            .filter(p => p.capabilityCode === capabilityCode)
            .sort((a, b) => a.priority - b.priority);
    };

    // 添加渠道到能力
    const addChannelToCapability = (capabilityCode: string, channelId: number) => {
        const existing = editChannelPriorities.filter(p => p.capabilityCode === capabilityCode);
        const maxPriority = existing.length > 0 ? Math.max(...existing.map(p => p.priority)) : 0;
        setEditChannelPriorities([
            ...editChannelPriorities,
            {capabilityCode, channelId, priority: maxPriority + 1}
        ]);
    };

    // 移除渠道
    const removeChannelFromCapability = (capabilityCode: string, channelId: number) => {
        const newPriorities = editChannelPriorities.filter(
            p => !(p.capabilityCode === capabilityCode && p.channelId === channelId)
        );
        // 重新排序优先级
        const capPriorities = newPriorities
            .filter(p => p.capabilityCode === capabilityCode)
            .sort((a, b) => a.priority - b.priority)
            .map((p, idx) => ({...p, priority: idx + 1}));
        const otherPriorities = newPriorities.filter(p => p.capabilityCode !== capabilityCode);
        setEditChannelPriorities([...otherPriorities, ...capPriorities]);
    };

    // 上移渠道
    const moveChannelUp = (capabilityCode: string, channelId: number) => {
        const capPriorities = editChannelPriorities
            .filter(p => p.capabilityCode === capabilityCode)
            .sort((a, b) => a.priority - b.priority);
        const idx = capPriorities.findIndex(p => p.channelId === channelId);
        if (idx <= 0) return;

        // 交换优先级
        const temp = capPriorities[idx].priority;
        capPriorities[idx].priority = capPriorities[idx - 1].priority;
        capPriorities[idx - 1].priority = temp;

        const otherPriorities = editChannelPriorities.filter(p => p.capabilityCode !== capabilityCode);
        setEditChannelPriorities([...otherPriorities, ...capPriorities]);
    };

    // 下移渠道
    const moveChannelDown = (capabilityCode: string, channelId: number) => {
        const capPriorities = editChannelPriorities
            .filter(p => p.capabilityCode === capabilityCode)
            .sort((a, b) => a.priority - b.priority);
        const idx = capPriorities.findIndex(p => p.channelId === channelId);
        if (idx < 0 || idx >= capPriorities.length - 1) return;

        // 交换优先级
        const temp = capPriorities[idx].priority;
        capPriorities[idx].priority = capPriorities[idx + 1].priority;
        capPriorities[idx + 1].priority = temp;

        const otherPriorities = editChannelPriorities.filter(p => p.capabilityCode !== capabilityCode);
        setEditChannelPriorities([...otherPriorities, ...capPriorities]);
    };

    // 获取渠道名称
    const getChannelName = (capabilityCode: string, channelId: number): string => {
        const cap = capabilityChannels.find(c => c.code === capabilityCode);
        if (!cap) return `渠道 ${channelId}`;
        const ch = cap.channels.find(c => c.channelId === channelId);
        return ch ? `${ch.channelName}${ch.model ? ` (${ch.model})` : ''}` : `渠道 ${channelId}`;
    };

    // 获取可添加的渠道选项
    const getAvailableChannels = (capabilityCode: string): ChannelOption[] => {
        const cap = capabilityChannels.find(c => c.code === capabilityCode);
        if (!cap) return [];
        const usedChannelIds = editChannelPriorities
            .filter(p => p.capabilityCode === capabilityCode)
            .map(p => p.channelId);
        return cap.channels.filter(ch => !usedChannelIds.includes(ch.channelId));
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setNewTokenName('');
        setNewTokenBalance('');
        setNewTokenKey('');
        setCreateChannelPriorities([]);
        setShowChannelConfig(false);
    };

    // 渠道配置编辑器组件
    const ChannelConfigEditor: React.FC<{
        priorities: ChannelPriorityItem[];
        setPriorities: (p: ChannelPriorityItem[]) => void;
        capabilities: CapabilityWithChannels[];
        loading: boolean;
    }> = ({priorities, setPriorities, capabilities, loading}) => {
        const getPriorities = (code: string) => priorities.filter(p => p.capabilityCode === code).sort((a, b) => a.priority - b.priority);

        const addChannel = (code: string, channelId: number) => {
            const existing = priorities.filter(p => p.capabilityCode === code);
            const maxP = existing.length > 0 ? Math.max(...existing.map(p => p.priority)) : 0;
            setPriorities([...priorities, {capabilityCode: code, channelId, priority: maxP + 1}]);
        };

        const removeChannel = (code: string, channelId: number) => {
            const newP = priorities.filter(p => !(p.capabilityCode === code && p.channelId === channelId));
            const capP = newP.filter(p => p.capabilityCode === code).sort((a, b) => a.priority - b.priority).map((p, i) => ({
                ...p,
                priority: i + 1
            }));
            const otherP = newP.filter(p => p.capabilityCode !== code);
            setPriorities([...otherP, ...capP]);
        };

        const moveUp = (code: string, channelId: number) => {
            const capP = priorities.filter(p => p.capabilityCode === code).sort((a, b) => a.priority - b.priority);
            const idx = capP.findIndex(p => p.channelId === channelId);
            if (idx <= 0) return;
            const temp = capP[idx].priority;
            capP[idx] = {...capP[idx], priority: capP[idx - 1].priority};
            capP[idx - 1] = {...capP[idx - 1], priority: temp};
            const otherP = priorities.filter(p => p.capabilityCode !== code);
            setPriorities([...otherP, ...capP]);
        };

        const moveDown = (code: string, channelId: number) => {
            const capP = priorities.filter(p => p.capabilityCode === code).sort((a, b) => a.priority - b.priority);
            const idx = capP.findIndex(p => p.channelId === channelId);
            if (idx < 0 || idx >= capP.length - 1) return;
            const temp = capP[idx].priority;
            capP[idx] = {...capP[idx], priority: capP[idx + 1].priority};
            capP[idx + 1] = {...capP[idx + 1], priority: temp};
            const otherP = priorities.filter(p => p.capabilityCode !== code);
            setPriorities([...otherP, ...capP]);
        };

        const getName = (code: string, channelId: number): string => {
            const cap = capabilities.find(c => c.code === code);
            if (!cap) return `渠道 ${channelId}`;
            const ch = cap.channels.find(c => c.channelId === channelId);
            return ch ? `${ch.channelName}${ch.model ? ` (${ch.model})` : ''}` : `渠道 ${channelId}`;
        };

        const getAvailable = (code: string): ChannelOption[] => {
            const cap = capabilities.find(c => c.code === code);
            if (!cap) return [];
            const used = priorities.filter(p => p.capabilityCode === code).map(p => p.channelId);
            return cap.channels.filter(ch => !used.includes(ch.channelId));
        };

        if (loading) {
            return <div className="text-sm text-gray-500 py-4 text-center">加载中...</div>;
        }

        if (capabilities.length === 0) {
            return <div className="text-sm text-gray-500 py-4 text-center">暂无可用能力</div>;
        }

        return (
            <div className="space-y-4 max-h-80 overflow-y-auto">
                {capabilities.map(cap => (
                    <div key={cap.code} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{cap.name}</span>
                            <span className="text-xs text-gray-400">{cap.code}</span>
                        </div>
                        <div className="space-y-2">
                            {getPriorities(cap.code).map((p, idx) => (
                                <div key={p.channelId}
                                     className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                    <span className="text-sm text-gray-500 w-6">{idx + 1}.</span>
                                    <span className="flex-1 text-sm">{getName(cap.code, p.channelId)}</span>
                                    <button onClick={() => moveUp(cap.code, p.channelId)} disabled={idx === 0}
                                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                                        <ChevronUp size={14}/>
                                    </button>
                                    <button onClick={() => moveDown(cap.code, p.channelId)}
                                            disabled={idx === getPriorities(cap.code).length - 1}
                                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                                        <ChevronDown size={14}/>
                                    </button>
                                    <button onClick={() => removeChannel(cap.code, p.channelId)}
                                            className="p-1 hover:bg-red-100 text-red-500 rounded">
                                        <X size={14}/>
                                    </button>
                                </div>
                            ))}
                            {getAvailable(cap.code).length > 0 && (
                                <select
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value=""
                                    onChange={e => {
                                        if (e.target.value) addChannel(cap.code, Number(e.target.value));
                                    }}
                                >
                                    <option value="">+ 添加渠道</option>
                                    {getAvailable(cap.code).map(ch => (
                                        <option key={ch.channelId} value={ch.channelId}>
                                            {ch.channelName}{ch.model ? ` (${ch.model})` : ''} - ¥{ch.price}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API 令牌管理</h1>
          <p className="text-gray-500 mt-1">创建和管理用于调用 Prism API 的密钥</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <Plus size={18} />
          创建新令牌
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 animate-pulse h-32"></div>
          ))
        ) : tokens.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
            <Key className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">暂无令牌，点击上方按钮创建</p>
          </div>
        ) : tokens.map(token => (
          <div key={token.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-6 group">
            <div className="p-4 bg-gray-50 rounded-2xl text-indigo-600">
              <Key size={24} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-gray-900 truncate">{token.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[token.status]}`}>
                  {STATUS_LABELS[token.status]}
                </span>
                  {token.channelPriorities && token.channelPriorities.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          已配置渠道
                      </span>
                  )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
                <code>{token.key}</code>
                <button
                  onClick={() => handleCopy(token.id, token.key)}
                  className={`p-1 rounded hover:bg-gray-100 transition-colors ${copiedId === token.id ? 'text-green-500' : 'text-gray-400'}`}
                >
                  {copiedId === token.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

              <div className="flex items-center gap-6">
                  <div className="text-center">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase mb-1">
                          <Wallet size={12}/>
                          <span>可用余额</span>
                      </div>
                      <p className="text-lg font-bold text-green-600">¥{token.balance.toFixed(4)}</p>
              </div>
                  <div className="text-center">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">已使用</div>
                      <p className="text-lg font-bold text-gray-600">¥{token.totalUsed.toFixed(4)}</p>
              </div>
            </div>

            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => openEditModal(token)}
                    className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg"
                    title="编辑"
                >
                    <Edit2 size={18}/>
                </button>
                <button
                  onClick={() => openRechargeModal(token)}
                  className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg"
                  title="充值"
              >
                  <PlusCircle size={18}/>
              </button>
                <button
                onClick={() => handleDelete(token.id, token.name)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                title="删除"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex gap-4 items-start">
        <AlertCircle className="text-amber-500 mt-1 flex-shrink-0" />
        <div>
          <h4 className="font-bold text-amber-900">安全提示</h4>
          <p className="text-sm text-amber-700 mt-1">
            API 令牌是您访问 Prism 服务的唯一凭证。请不要在前端代码中硬编码令牌，也不要在公开场合分享您的密钥。
          </p>
        </div>
      </div>

        {/* 创建令牌弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">创建新令牌</h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {newTokenKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm text-green-700 mb-2">令牌创建成功!</p>
                  <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-green-200">
                    <code className="flex-1 text-sm font-mono break-all">{newTokenKey}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newTokenKey);
                        alert('已复制到剪贴板');
                      }}
                      className="p-2 hover:bg-green-100 rounded-lg text-green-600"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                >
                  完成
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">令牌名称</label>
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={e => setNewTokenName(e.target.value)}
                    placeholder="如: 生产环境、测试项目"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">初始余额 (元)</label>
                      <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newTokenBalance}
                          onChange={e => setNewTokenBalance(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                  {/* 渠道配置区域 */}
                  <div className="border-t pt-4">
                      <button
                          type="button"
                          onClick={async () => {
                              if (!showChannelConfig && capabilityChannels.length === 0) {
                                  setIsLoadingCapabilities(true);
                                  try {
                                      const caps = await fetchAllCapabilityChannels();
                                      setCapabilityChannels(caps);
                                  } catch (err) {
                                      console.error('加载能力渠道列表失败:', err);
                                  } finally {
                                      setIsLoadingCapabilities(false);
                                  }
                              }
                              setShowChannelConfig(!showChannelConfig);
                          }}
                          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                      >
                          {showChannelConfig ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                          {showChannelConfig ? '收起渠道配置' : '配置渠道优先级 (可选)'}
                      </button>
                      {showChannelConfig && (
                          <div className="mt-3">
                              <p className="text-xs text-gray-500 mb-2">为每个能力配置渠道调用顺序，调用时将按优先级选择可用渠道</p>
                              <ChannelConfigEditor
                                  priorities={createChannelPriorities}
                                  setPriorities={setCreateChannelPriorities}
                                  capabilities={capabilityChannels}
                                  loading={isLoadingCapabilities}
                              />
                          </div>
                      )}
                  </div>

                <button
                  onClick={handleCreate}
                  disabled={isCreating || !newTokenName.trim()}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Plus size={18} />
                      创建令牌
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

        {/* 充值弹窗 */}
        {showRechargeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">充值余额</h3>
                        <button onClick={() => setShowRechargeModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg">
                            <X size={20} className="text-gray-400"/>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-xl">
                            <p className="text-sm text-gray-500">为令牌充值</p>
                            <p className="text-lg font-bold text-gray-900 mt-1">{rechargeTokenName}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">充值金额 (元)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={rechargeAmount}
                                onChange={e => setRechargeAmount(e.target.value)}
                                placeholder="请输入充值金额"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={handleRecharge}
                            disabled={isRecharging || !rechargeAmount || parseFloat(rechargeAmount) <= 0}
                            className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isRecharging ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <PlusCircle size={18}/>
                                    确认充值
                                </>
                            )}
                        </button>
                    </div>
          </div>
        </div>
      )}

        {/* 编辑令牌弹窗 */}
        {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">编辑令牌</h3>
                        <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                            <X size={20} className="text-gray-400"/>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">令牌名称</label>
                            <input
                                type="text"
                                value={editTokenName}
                                onChange={e => setEditTokenName(e.target.value)}
                                placeholder="令牌名称"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-medium text-gray-900 mb-2">渠道优先级配置</h4>
                            <p className="text-xs text-gray-500 mb-3">为每个能力配置渠道调用顺序，调用时将按优先级选择可用渠道</p>
                            <ChannelConfigEditor
                                priorities={editChannelPriorities}
                                setPriorities={setEditChannelPriorities}
                                capabilities={capabilityChannels}
                                loading={isLoadingCapabilities}
                            />
                        </div>

                        <button
                            onClick={handleSaveEdit}
                            disabled={isEditing || !editTokenName.trim()}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isEditing ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <CheckCircle2 size={18}/>
                                    保存
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Tokens;
