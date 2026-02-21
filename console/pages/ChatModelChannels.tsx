import React, {useEffect, useState} from 'react';
import {Plus, Edit3, Trash2, X, Link2, Power} from 'lucide-react';
import {
    fetchChatModelChannels,
    createChatModelChannel,
    updateChatModelChannel,
    deleteChatModelChannel,
    fetchChatModels,
    fetchChannels,
} from '../services/api';
import {ChatModelChannel, ChatModel, Channel, PRICE_MODES} from '../types';

const STATUS_MAP: Record<number, { label: string; color: string }> = {
    1: {label: '已启用', color: 'bg-green-100 text-green-700'},
    0: {label: '已禁用', color: 'bg-gray-100 text-gray-700'},
};

// 新建/编辑模型渠道映射弹窗
const ChatModelChannelModal: React.FC<{
    isOpen: boolean;
    channelMapping?: ChatModelChannel | null;
    chatModels: ChatModel[];
    channels: Channel[];
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}> = ({isOpen, channelMapping, chatModels, channels, onClose, onSave}) => {
    const [form, setForm] = useState({
        model_code: '',
        channel_id: 0,
        vendor_model: '',
        priority: 0,
        price_mode: 'token',
        input_price: 0,
        output_price: 0,
        request_path: '/v1/chat/completions',
        timeout: 120,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (channelMapping) {
            setForm({
                model_code: channelMapping.modelCode,
                channel_id: channelMapping.channelId,
                vendor_model: channelMapping.vendorModel,
                priority: channelMapping.priority,
                price_mode: channelMapping.priceMode,
                input_price: channelMapping.inputPrice,
                output_price: channelMapping.outputPrice,
                request_path: channelMapping.requestPath,
                timeout: channelMapping.timeout,
            });
        } else {
            setForm({
                model_code: chatModels[0]?.code || '',
                channel_id: Number(channels[0]?.id) || 0,
                vendor_model: '',
                priority: 0,
                price_mode: 'token',
                input_price: 0,
                output_price: 0,
                request_path: '/v1/chat/completions',
                timeout: 120,
            });
        }
    }, [channelMapping, isOpen, chatModels, channels]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(form);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">{channelMapping ? '编辑渠道映射' : '新建渠道映射'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                            <select
                                value={form.model_code}
                                onChange={e => setForm({...form, model_code: e.target.value})}
                                disabled={!!channelMapping}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                required
                            >
                                {chatModels.map(m => (
                                    <option key={m.code} value={m.code}>{m.name} ({m.code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">渠道</label>
                            <select
                                value={form.channel_id}
                                onChange={e => setForm({...form, channel_id: Number(e.target.value)})}
                                disabled={!!channelMapping}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                required
                            >
                                {channels.map(ch => (
                                    <option key={ch.id} value={ch.id}>{ch.name} ({ch.type})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">供应商模型名</label>
                        <input
                            type="text"
                            value={form.vendor_model}
                            onChange={e => setForm({...form, vendor_model: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="如: gpt-4o-2024-08-06"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                            <input
                                type="number"
                                value={form.priority}
                                onChange={e => setForm({...form, priority: Number(e.target.value)})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">数值越大优先级越高</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">计价模式</label>
                            <select
                                value={form.price_mode}
                                onChange={e => setForm({...form, price_mode: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {PRICE_MODES.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">输入价格 (￥/1M
                                tokens)</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={form.input_price}
                                onChange={e => setForm({...form, input_price: Number(e.target.value)})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">输出价格 (￥/1M
                                tokens)</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={form.output_price}
                                onChange={e => setForm({...form, output_price: Number(e.target.value)})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">请求路径</label>
                            <input
                                type="text"
                                value={form.request_path}
                                onChange={e => setForm({...form, request_path: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">超时时间 (秒)</label>
                            <input
                                type="number"
                                value={form.timeout}
                                onChange={e => setForm({...form, timeout: Number(e.target.value)})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">取消
                        </button>
                        <button type="submit" disabled={loading}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {loading ? '保存中...' : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ChatModelChannels: React.FC = () => {
    const [mappings, setMappings] = useState<ChatModelChannel[]>([]);
    const [chatModels, setChatModels] = useState<ChatModel[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMapping, setEditingMapping] = useState<ChatModelChannel | null>(null);
    const [filterModel, setFilterModel] = useState('');
    const [filterChannel, setFilterChannel] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [mappingsData, modelsData, channelsData] = await Promise.all([
                fetchChatModelChannels(filterModel || undefined, filterChannel ? Number(filterChannel) : undefined),
                fetchChatModels(),
                fetchChannels(),
            ]);
            setMappings(mappingsData);
            setChatModels(modelsData);
            setChannels(channelsData);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filterModel, filterChannel]);

    const handleCreate = () => {
        setEditingMapping(null);
        setModalOpen(true);
    };

    const handleEdit = (mapping: ChatModelChannel) => {
        setEditingMapping(mapping);
        setModalOpen(true);
    };

    const handleSave = async (data: any) => {
        if (editingMapping) {
            await updateChatModelChannel(editingMapping.id, data);
        } else {
            await createChatModelChannel(data);
        }
        loadData();
    };

    const handleDelete = async (id: number) => {
        if (confirm('确定删除该渠道映射?')) {
            await deleteChatModelChannel(id);
            loadData();
        }
    };

    const handleToggleStatus = async (mapping: ChatModelChannel) => {
        const newStatus = mapping.status === 1 ? 0 : 1;
        await updateChatModelChannel(mapping.id, {status: newStatus});
        loadData();
    };

    const getPriceModeLabel = (mode: string) => {
        return PRICE_MODES.find(m => m.value === mode)?.label || mode;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                        <Link2 className="text-indigo-600" size={24}/>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">模型渠道映射</h1>
                        <p className="text-sm text-gray-500">配置模型与渠道的映射关系</p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={20}/>
                    添加映射
                </button>
            </div>

            {/* 筛选条件 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">按模型筛选</label>
                        <select
                            value={filterModel}
                            onChange={e => setFilterModel(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">全部模型</option>
                            {chatModels.map(m => (
                                <option key={m.code} value={m.code}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">按渠道筛选</label>
                        <select
                            value={filterChannel}
                            onChange={e => setFilterChannel(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">全部渠道</option>
                            {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>{ch.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">渠道</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">供应商模型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">优先级</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">价格</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {mappings.map(mapping => (
                        <tr key={mapping.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                                <div
                                    className="text-sm font-medium text-gray-900">{mapping.chatModel?.name || mapping.modelCode}</div>
                                <div className="text-xs text-gray-500 font-mono">{mapping.modelCode}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-gray-900">{mapping.channel?.name || '-'}</div>
                                <div className="text-xs text-gray-500">{mapping.channel?.type || '-'}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-gray-600">{mapping.vendorModel}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{mapping.priority}</td>
                            <td className="px-6 py-4">
                                <div className="text-xs text-gray-600">
                                    {mapping.priceMode === 'token' ? (
                                        <>
                                            <div>输入: ${mapping.inputPrice}/1M</div>
                                            <div>输出: ${mapping.outputPrice}/1M</div>
                                        </>
                                    ) : (
                                        <div>${mapping.inputPrice}/次</div>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[mapping.status]?.color}`}>
                                        {STATUS_MAP[mapping.status]?.label}
                                    </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggleStatus(mapping)}
                                        className={`p-1.5 rounded-lg transition-colors ${mapping.status === 1 ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                        title={mapping.status === 1 ? '禁用' : '启用'}
                                    >
                                        <Power size={16}/>
                                    </button>
                                    <button
                                        onClick={() => handleEdit(mapping)}
                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="编辑"
                                    >
                                        <Edit3 size={16}/>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(mapping.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="删除"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {mappings.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                暂无渠道映射数据
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            <ChatModelChannelModal
                isOpen={modalOpen}
                channelMapping={editingMapping}
                chatModels={chatModels}
                channels={channels}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
};

export default ChatModelChannels;
