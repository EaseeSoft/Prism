import React, {useEffect, useState} from 'react';
import {
    Search,
    DollarSign,
    ChevronRight,
    X,
    RefreshCw,
    ChevronLeft,
    MessageSquare,
    User,
    Bot,
    Clock,
    Hash
} from 'lucide-react';
import {fetchConversations, fetchConversationMessages, ConversationListParams, fetchChatModels} from '../services/api';
import {Conversation, ChatMessage, ChatModel, UserRole} from '../types';

const isAdmin = () => {
    try {
        const userStr = localStorage.getItem('prism_user');
        if (!userStr) return false;
        const user = JSON.parse(userStr);
        return user.role === UserRole.ADMIN;
    } catch {
        return false;
    }
};

const formatTime = (t: string) => {
    const d = new Date(t);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const ChatLogs: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [isLoading, setIsLoading] = useState(true);
    const [models, setModels] = useState<ChatModel[]>([]);

    // 抽屉状态
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // 筛选
    const [filters, setFilters] = useState<ConversationListParams>({});
    const [keyword, setKeyword] = useState('');

    useEffect(() => {
        if (isAdmin()) {
            fetchChatModels().then(setModels).catch(() => {
            });
        }
    }, []);

    const loadConversations = async (params?: ConversationListParams) => {
        setIsLoading(true);
        try {
            const resp = await fetchConversations({page, page_size: pageSize, ...filters, ...params});
            setConversations(resp.items);
            setTotal(resp.total);
        } catch (e) {
            console.error('Failed to load conversations', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadConversations();
    }, [page, filters]);

    const openDetails = async (conv: Conversation) => {
        setIsDrawerOpen(true);
        setSelectedConversation(conv);
        setLoadingMessages(true);
        try {
            const resp = await fetchConversationMessages(conv.id, 1, 200);
            setMessages(resp.items);
        } catch (e) {
            console.error('Failed to load messages', e);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        loadConversations({keyword});
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">对话记录</h1>
                    <p className="text-gray-500 mt-1">查看所有 Chat 对话历史和费用明细</p>
                </div>
                <button
                    onClick={() => loadConversations()}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/>
                    刷新
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                        <input
                            type="text"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="搜索对话标题..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    {isAdmin() && models.length > 0 && (
                        <select
                            value={filters.model ?? ''}
                            onChange={e => {
                                setFilters({...filters, model: e.target.value});
                                setPage(1);
                            }}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">所有模型</option>
                            {models.map(m => (
                                <option key={m.code} value={m.code}>{m.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                        <tr className="border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">对话标题</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">模型</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">消息数</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Token
                                用量
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">费用</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">创建时间</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">操作</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            Array.from({length: 8}).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={7} className="px-6 py-4">
                                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                                    </td>
                                </tr>
                            ))
                        ) : conversations.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">暂无对话记录</td>
                            </tr>
                        ) : conversations.map(conv => (
                            <tr key={conv.id} className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                                onClick={() => openDetails(conv)}>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]"
                                         title={conv.title}>
                                        {conv.title}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                    <span
                        className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      {conv.model}
                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-sm text-gray-600">{conv.messageCount}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-sm text-gray-600">{conv.totalTokens.toLocaleString()}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="text-xs text-gray-400 flex items-center justify-end gap-1">
                                        <DollarSign size={10}/>
                                        {conv.totalCost.toFixed(4)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-[10px] text-gray-400">{formatTime(conv.createdAt)}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <ChevronRight size={16}
                                                  className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all"/>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            共 {total} 条记录，第 {page}/{totalPages} 页
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16}/>
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isDrawerOpen && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
                     onClick={() => setIsDrawerOpen(false)}>
                    <div className="w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col"
                         onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">对话详情</h2>
                                {selectedConversation && (
                                    <p className="text-xs text-gray-500 mt-1 truncate max-w-[400px]">{selectedConversation.title}</p>
                                )}
                            </div>
                            <button onClick={() => setIsDrawerOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X size={24}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {loadingMessages ? (
                                <div className="p-6 space-y-4 animate-pulse">
                                    <div className="h-32 bg-gray-100 rounded-2xl"></div>
                                    <div className="h-48 bg-gray-100 rounded-2xl"></div>
                                </div>
                            ) : selectedConversation ? (
                                <>
                                    <div className="p-6 bg-gray-50 border-b border-gray-100">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label
                                                    className="text-[10px] font-bold text-gray-400 uppercase">模型</label>
                                                <p className="text-sm font-bold text-gray-900">{selectedConversation.model}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label
                                                    className="text-[10px] font-bold text-gray-400 uppercase">消息数</label>
                                                <p className="text-sm font-bold text-gray-900">{selectedConversation.messageCount}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Token
                                                    用量</label>
                                                <p className="text-sm font-bold text-gray-900">{selectedConversation.totalTokens.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label
                                                    className="text-[10px] font-bold text-gray-400 uppercase">总费用</label>
                                                <p className="text-sm font-bold text-green-600">{selectedConversation.totalCost.toFixed(4)}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label
                                                    className="text-[10px] font-bold text-gray-400 uppercase">创建时间</label>
                                                <p className="text-sm text-gray-700">{formatTime(selectedConversation.createdAt)}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label
                                                    className="text-[10px] font-bold text-gray-400 uppercase">更新时间</label>
                                                <p className="text-sm text-gray-700">{formatTime(selectedConversation.updatedAt)}</p>
                                            </div>
                                            {selectedConversation.systemPrompt && (
                                                <div className="col-span-2 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">System
                                                        Prompt</label>
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200 max-h-32 overflow-y-auto">
                                                        {selectedConversation.systemPrompt}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        <div
                                            className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                            <MessageSquare size={14}/>
                                            消息列表
                                        </div>
                                        <div className="space-y-4">
                                            {messages.map(msg => (
                                                <div
                                                    key={msg.id}
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div
                                                        className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                                                        <div
                                                            className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                            {msg.role === 'user' ? (
                                                                <User size={12} className="text-indigo-500"/>
                                                            ) : msg.role === 'assistant' ? (
                                                                <Bot size={12} className="text-green-500"/>
                                                            ) : (
                                                                <Hash size={12} className="text-gray-400"/>
                                                            )}
                                                            <span
                                                                className="text-[10px] font-bold text-gray-400 uppercase">
                                {msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统'}
                              </span>
                                                            <span
                                                                className="text-[10px] text-gray-300">{formatTime(msg.createdAt)}</span>
                                                        </div>
                                                        <div
                                                            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                                                msg.role === 'user'
                                                                    ? 'bg-indigo-500 text-white rounded-br-sm'
                                                                    : msg.role === 'assistant'
                                                                        ? 'bg-gray-100 text-gray-800 rounded-bl-sm'
                                                                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                            }`}
                                                        >
                                                            <div
                                                                className="whitespace-pre-wrap break-words">{msg.content}</div>
                                                        </div>
                                                        {msg.role === 'assistant' && (msg.inputTokens > 0 || msg.outputTokens > 0 || msg.cost > 0) && (
                                                            <div
                                                                className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                                                                {(msg.inputTokens > 0 || msg.outputTokens > 0) && (
                                                                    <span className="flex items-center gap-1">
                                    <Hash size={10}/>
                                                                        {msg.inputTokens} / {msg.outputTokens} tokens
                                  </span>
                                                                )}
                                                                {msg.cost > 0 && (
                                                                    <span className="flex items-center gap-1">
                                    <DollarSign size={10}/>
                                                                        {msg.cost.toFixed(6)}
                                  </span>
                                                                )}
                                                                {msg.latencyMs > 0 && (
                                                                    <span className="flex items-center gap-1">
                                    <Clock size={10}/>
                                                                        {msg.latencyMs}ms
                                  </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {messages.length === 0 && (
                                                <div className="text-center text-gray-400 py-8">暂无消息</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-gray-400 py-12">加载失败</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatLogs;
