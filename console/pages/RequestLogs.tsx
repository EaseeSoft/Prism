import React, { useEffect, useState } from 'react';
import { Search, Clock, ChevronRight, X, Code, RefreshCw, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { fetchRequestLogs, fetchCapabilities, fetchChannels, RequestLogListParams } from '../services/api';
import { ChannelRequestLog, Capability, Channel } from '../types';

const REQUEST_TYPE_MAP: Record<string, { label: string; color: string }> = {
  submit: { label: '提交', color: 'bg-blue-100 text-blue-700' },
  poll: { label: '轮询', color: 'bg-purple-100 text-purple-700' },
  callback: { label: '回调', color: 'bg-orange-100 text-orange-700' },
};

const RequestLogs: React.FC = () => {
  const [logs, setLogs] = useState<ChannelRequestLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ChannelRequestLog | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

  // 过滤条件
  const [filters, setFilters] = useState<RequestLogListParams>({});
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    Promise.all([
      fetchCapabilities().then(setCapabilities).catch(() => {}),
      fetchChannels().then(setChannels).catch(() => {}),
    ]);
  }, []);

  const loadLogs = async (params?: RequestLogListParams) => {
    setIsLoading(true);
    try {
      const resp = await fetchRequestLogs({ page, page_size: pageSize, ...filters, ...params });
      setLogs(resp.items);
      setTotal(resp.total);
    } catch (e) {
      console.error('Failed to load request logs', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const openDetails = (log: ChannelRequestLog) => {
    setSelectedLog(log);
    setIsDrawerOpen(true);
  };

  const handleSearch = () => {
    setPage(1);
    loadLogs({ task_no: keyword });
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatJson = (str: string) => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">渠道请求日志</h1>
          <p className="text-gray-500 mt-1">查看所有与第三方渠道的 HTTP 交互记录</p>
        </div>
        <button
          onClick={() => loadLogs()}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索任务编号..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filters.channel_id || ''}
            onChange={e => { setFilters({ ...filters, channel_id: e.target.value ? Number(e.target.value) : undefined }); setPage(1); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">所有渠道</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
          <select
            value={filters.capability_code || ''}
            onChange={e => { setFilters({ ...filters, capability_code: e.target.value || undefined }); setPage(1); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">所有能力</option>
            {capabilities.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <select
            value={filters.request_type || ''}
            onChange={e => { setFilters({ ...filters, request_type: e.target.value || undefined }); setPage(1); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">所有类型</option>
            <option value="submit">提交</option>
            <option value="poll">轮询</option>
            <option value="callback">回调</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">任务编号 / 时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">渠道 / 能力</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">类型</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">状态码</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">耗时</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">暂无数据</td>
                </tr>
              ) : logs.map(log => {
                const typeInfo = REQUEST_TYPE_MAP[log.request_type] || { label: log.request_type, color: 'bg-gray-100 text-gray-700' };
                const isSuccess = log.status_code >= 200 && log.status_code < 300;
                const hasError = !!log.error_message;
                return (
                  <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors cursor-pointer group" onClick={() => openDetails(log)}>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-indigo-600 font-mono">{log.task_no}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{log.request_at}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{log.channel_name || '-'}</div>
                      <div className="text-[10px] text-gray-400">{log.capability_name || log.capability_code}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {hasError ? (
                          <AlertCircle size={14} className="text-red-500" />
                        ) : isSuccess ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : (
                          <AlertCircle size={14} className="text-yellow-500" />
                        )}
                        <span className={`text-sm font-mono ${hasError ? 'text-red-600' : isSuccess ? 'text-green-600' : 'text-yellow-600'}`}>
                          {log.status_code || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-xs text-gray-400 flex items-center justify-end gap-1">
                        <Clock size={10} />
                        {log.duration_ms}ms
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Drawer */}
      {isDrawerOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}>
          <div className="w-full max-w-3xl bg-white shadow-2xl h-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">请求详情</h2>
                <p className="text-xs text-indigo-500 font-mono mt-1">{selectedLog.task_no}</p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">请求类型</label>
                  <p className="text-sm font-bold text-gray-900">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${REQUEST_TYPE_MAP[selectedLog.request_type]?.color || 'bg-gray-100'}`}>
                      {REQUEST_TYPE_MAP[selectedLog.request_type]?.label || selectedLog.request_type}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">HTTP 方法</label>
                  <p className="text-sm font-bold text-gray-900">{selectedLog.method}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">渠道</label>
                  <p className="text-sm font-bold text-gray-900">{selectedLog.channel_name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">能力</label>
                  <p className="text-sm font-bold text-gray-900">{selectedLog.capability_name || selectedLog.capability_code}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">状态码</label>
                  <p className={`text-sm font-bold ${selectedLog.status_code >= 200 && selectedLog.status_code < 300 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedLog.status_code || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">耗时</label>
                  <p className="text-sm font-bold text-gray-900">{selectedLog.duration_ms}ms</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">请求时间</label>
                  <p className="text-sm text-gray-700">{selectedLog.request_at}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">请求 URL</label>
                  <p className="text-sm text-gray-700 font-mono break-all">{selectedLog.url}</p>
                </div>
                {selectedLog.error_message && (
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">错误信息</label>
                    <p className="text-sm text-red-600">{selectedLog.error_message}</p>
                  </div>
                )}
              </div>

              {selectedLog.request_headers && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <Code size={14} />
                    请求头
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 text-gray-700 font-mono text-sm leading-relaxed whitespace-pre-wrap border border-gray-200 overflow-x-auto max-h-40 overflow-y-auto">
                    {formatJson(selectedLog.request_headers)}
                  </div>
                </div>
              )}

              {selectedLog.request_body && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <Code size={14} />
                    请求体
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 text-gray-700 font-mono text-sm leading-relaxed whitespace-pre-wrap border border-gray-200 overflow-x-auto max-h-64 overflow-y-auto">
                    {formatJson(selectedLog.request_body)}
                  </div>
                </div>
              )}

              {selectedLog.response_body && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <Code size={14} />
                    响应体
                  </div>
                  <div className="bg-gray-900 rounded-2xl p-4 text-green-300 font-mono text-sm leading-relaxed whitespace-pre-wrap border border-gray-800 overflow-x-auto max-h-96 overflow-y-auto">
                    {formatJson(selectedLog.response_body)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestLogs;
