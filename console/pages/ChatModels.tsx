import React, {useEffect, useState} from 'react';
import {Plus, Edit3, Trash2, X, Bot, Power} from 'lucide-react';
import {
    fetchChatModels,
    createChatModel,
    updateChatModel,
    deleteChatModel,
} from '../services/api';
import {ChatModel, CHAT_PROVIDERS} from '../types';

const STATUS_MAP: Record<number, { label: string; color: string }> = {
    1: {label: '已启用', color: 'bg-green-100 text-green-700'},
    0: {label: '已禁用', color: 'bg-gray-100 text-gray-700'},
};

// 新建/编辑模型弹窗
const ChatModelModal: React.FC<{
    isOpen: boolean;
    model?: ChatModel | null;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}> = ({isOpen, model, onClose, onSave}) => {
    const [form, setForm] = useState({
        code: '',
        name: '',
        provider: 'openai',
        description: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (model) {
            setForm({
                code: model.code,
                name: model.name,
                provider: model.provider,
                description: model.description,
            });
        } else {
            setForm({
                code: '',
                name: '',
                provider: 'openai',
                description: '',
            });
        }
    }, [model, isOpen]);

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
                    <h3 className="text-lg font-bold text-gray-900">{model ? '编辑模型' : '新建模型'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">模型标识</label>
                        <input
                            type="text"
                            value={form.code}
                            onChange={e => setForm({...form, code: e.target.value})}
                            disabled={!!model}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                            placeholder="如: gpt-4o, claude-3-opus"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({...form, name: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="如: GPT-4o, Claude 3 Opus"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">提供商</label>
                        <select
                            value={form.provider}
                            onChange={e => setForm({...form, provider: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {CHAT_PROVIDERS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({...form, description: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                            placeholder="模型描述信息"
                        />
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

const ChatModels: React.FC = () => {
    const [models, setModels] = useState<ChatModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<ChatModel | null>(null);

    const loadModels = async () => {
        setLoading(true);
        try {
            const data = await fetchChatModels();
            setModels(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    const handleCreate = () => {
        setEditingModel(null);
        setModalOpen(true);
    };

    const handleEdit = (model: ChatModel) => {
        setEditingModel(model);
        setModalOpen(true);
    };

    const handleSave = async (data: any) => {
        if (editingModel) {
            await updateChatModel(editingModel.code, data);
        } else {
            await createChatModel(data);
        }
        loadModels();
    };

    const handleDelete = async (code: string) => {
        if (confirm('确定删除该模型?')) {
            await deleteChatModel(code);
            loadModels();
        }
    };

    const handleToggleStatus = async (model: ChatModel) => {
        const newStatus = model.status === 1 ? 0 : 1;
        await updateChatModel(model.code, {status: newStatus});
        loadModels();
    };

    const getProviderLabel = (provider: string) => {
        return CHAT_PROVIDERS.find(p => p.value === provider)?.label || provider;
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
                        <Bot className="text-indigo-600" size={24}/>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">语言模型管理</h1>
                        <p className="text-sm text-gray-500">管理 Chat 模型定义</p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={20}/>
                    添加模型
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模型标识</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">提供商</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">描述</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {models.map(model => (
                        <tr key={model.code} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-mono text-sm text-gray-900">{model.code}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{model.name}</td>
                            <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                        {getProviderLabel(model.provider)}
                                    </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{model.description}</td>
                            <td className="px-6 py-4">
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[model.status]?.color}`}>
                                        {STATUS_MAP[model.status]?.label}
                                    </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggleStatus(model)}
                                        className={`p-1.5 rounded-lg transition-colors ${model.status === 1 ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                        title={model.status === 1 ? '禁用' : '启用'}
                                    >
                                        <Power size={16}/>
                                    </button>
                                    <button
                                        onClick={() => handleEdit(model)}
                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="编辑"
                                    >
                                        <Edit3 size={16}/>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(model.code)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="删除"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {models.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                暂无模型数据
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            <ChatModelModal
                isOpen={modalOpen}
                model={editingModel}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
};

export default ChatModels;
