import React, { useEffect, useState } from 'react';
import { Search, Clock, DollarSign, ChevronRight, X, Code, RefreshCw, ChevronLeft } from 'lucide-react';
import { fetchTaskLogs, fetchTaskDetail, fetchCapabilities, TaskListParams } from '../services/api';
import {TaskLog, TaskDetail, Capability, UserRole} from '../types';

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

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'bg-gray-100 text-gray-700' },
  processing: { label: '处理中', color: 'bg-blue-100 text-blue-700' },
  success: { label: '成功', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
  cancelled: { label: '已取消', color: 'bg-yellow-100 text-yellow-700' },
};

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);

  // 过滤条件
  const [filters, setFilters] = useState<TaskListParams>({});
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    fetchCapabilities().then(setCapabilities).catch(() => {});
  }, []);

  const loadLogs = async (params?: TaskListParams) => {
    setIsLoading(true);
    try {
      const resp = await fetchTaskLogs({ page, page_size: pageSize, ...filters, ...params });
      setLogs(resp.items);
      setTotal(resp.total);
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const openDetails = async (task: TaskLog) => {
    setIsDrawerOpen(true);
    setLoadingDetail(true);
    try {
      const detail = await fetchTaskDetail(task.task_no);
      setSelectedTask(detail);
    } catch (e) {
      console.error('Failed to load task detail', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadLogs({ keyword });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">调用日志</h1>
          <p className="text-gray-500 mt-1">查看所有任务的调用记录和状态</p>
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
              placeholder="搜索任务ID..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filters.capability || ''}
            onChange={e => { setFilters({ ...filters, capability: e.target.value || undefined }); setPage(1); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">所有能力</option>
            {capabilities.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <select
            value={filters.status || ''}
            onChange={e => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">所有状态</option>
            <option value="pending">等待中</option>
            <option value="processing">处理中</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">任务ID / 时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">能力 / 渠道</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">状态</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">进度</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">费用</th>
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
                const statusInfo = STATUS_MAP[log.status] || { label: log.status, color: 'bg-gray-100 text-gray-700' };
                return (
                  <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors cursor-pointer group" onClick={() => openDetails(log)}>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-indigo-600 font-mono">{log.task_no}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{log.created_at}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{log.capability_name || log.capability}</div>
                      <div className="text-[10px] text-gray-400">{log.channel}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-600">{log.progress}%</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-xs text-gray-400 flex items-center justify-end gap-1">
                        <DollarSign size={10} />
                        ¥{log.cost.toFixed(4)}
                          {log.refunded && (
                              <span
                                  className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 text-[10px] font-bold">已退回</span>
                          )}
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

      {/* Task Details Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}>
          <div className="w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">任务详情</h2>
                {selectedTask && (
                  <p className="text-xs text-indigo-500 font-mono mt-1">{selectedTask.task_no}</p>
                )}
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-32 bg-gray-100 rounded-2xl"></div>
                  <div className="h-48 bg-gray-100 rounded-2xl"></div>
                </div>
              ) : selectedTask ? (
                <>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">能力</label>
                      <p className="text-sm font-bold text-gray-900">{selectedTask.capability_name || selectedTask.capability}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">渠道</label>
                      <p className="text-sm font-bold text-gray-900">{selectedTask.channel || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">状态</label>
                      <p className="text-sm font-bold text-gray-900">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_MAP[selectedTask.status]?.color || 'bg-gray-100'}`}>
                          {STATUS_MAP[selectedTask.status]?.label || selectedTask.status}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">费用</label>
                        <p className="text-sm font-bold text-green-600">
                            ¥{selectedTask.cost.toFixed(4)}
                            {selectedTask.refunded && (
                                <span
                                    className="ml-2 px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 text-[10px] font-bold align-middle">已退回</span>
                            )}
                        </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">创建时间</label>
                      <p className="text-sm text-gray-700">{selectedTask.created_at}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">完成时间</label>
                      <p className="text-sm text-gray-700">{selectedTask.completed_at || '-'}</p>
                    </div>
                    {selectedTask.vendor_task_id && (
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">供应商任务ID</label>
                        <p className="text-sm text-gray-700 font-mono">{selectedTask.vendor_task_id}</p>
                      </div>
                    )}
                    {selectedTask.error && (
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">错误信息</label>
                        <p className="text-sm text-red-600">{selectedTask.error}</p>
                      </div>
                    )}
                  </div>

                  {selectedTask.result && Object.keys(selectedTask.result).length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <Code size={14} />
                        结果
                      </div>
                      <div className="bg-gray-900 rounded-2xl p-4 text-green-300 font-mono text-sm leading-relaxed whitespace-pre-wrap border border-gray-800 overflow-x-auto">
                        {JSON.stringify(selectedTask.result, null, 2)}
                      </div>
                    </div>
                  )}

                  {selectedTask.raw_params && Object.keys(selectedTask.raw_params).length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <Code size={14} />
                        请求参数
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 text-gray-700 font-mono text-sm leading-relaxed whitespace-pre-wrap border border-gray-200 overflow-x-auto">
                        {JSON.stringify(selectedTask.raw_params, null, 2)}
                      </div>
                    </div>
                  )}

                    {selectedTask.vendor_response && Object.keys(selectedTask.vendor_response).length > 0 && isAdmin() && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <Code size={14} />
                        供应商响应
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 text-gray-700 font-mono text-sm leading-relaxed whitespace-pre-wrap border border-gray-200 overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(selectedTask.vendor_response, null, 2)}
                      </div>
                    </div>
                  )}
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

export default Logs;
