import React, { useEffect, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, Activity, AlertCircle, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { fetchDashboardStats } from '../services/api';
import { DashboardStats } from '../types';

const COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to load dashboard stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">系统概览</h1>
            <p className="text-gray-500 mt-1">实时监控及用量统计数据</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { today, weekly_trend, capability_dist } = stats;
    const formatShortDate = (date: Date) => {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    };
    const weeklyTrend = (weekly_trend || []).map((item, index) => {
        const fallbackDate = formatShortDate(new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000));
        const requests = Number(item.requests);
        const errors = Number(item.errors);
        const cost = Number(item.cost);
        return {
            ...item,
            date: item.date || fallbackDate,
            requests: Number.isFinite(requests) ? requests : 0,
            errors: Number.isFinite(errors) ? errors : 0,
            cost: Number.isFinite(cost) ? cost : 0,
        };
    });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系统概览</h1>
          <p className="text-gray-500 mt-1">实时监控及用量统计数据</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">今日请求数</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{today.total_requests.toLocaleString()}</h3>
            <div className={`flex items-center mt-2 text-xs font-medium ${today.request_trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {today.request_trend >= 0 ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
              较昨日 {today.request_trend >= 0 ? '+' : ''}{today.request_trend.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl"><TrendingUp className="text-indigo-600" /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">成功数</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{today.success_count.toLocaleString()}</h3>
            <div className="flex items-center mt-2 text-xs font-medium text-green-600">
              <Activity size={14} className="mr-1" />
              成功率 {today.total_requests > 0 ? ((today.success_count / today.total_requests) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-xl"><Activity className="text-green-600" /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">今日消耗</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">¥{today.total_cost.toFixed(2)}</h3>
            <div className={`flex items-center mt-2 text-xs font-medium ${today.cost_trend >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {today.cost_trend >= 0 ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
              较昨日 {today.cost_trend >= 0 ? '+' : ''}{today.cost_trend.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl"><DollarSign className="text-amber-600" /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">错误率</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{today.error_rate.toFixed(2)}%</h3>
            <div className="flex items-center mt-2 text-xs font-medium text-gray-500">
              <AlertCircle size={14} className="mr-1" />
              失败 {today.failed_count} 次
            </div>
          </div>
          <div className="p-3 bg-red-50 rounded-xl"><AlertCircle className="text-red-600" /></div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-gray-900">7天请求趋势</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                <span className="text-sm text-gray-500">请求数</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400"></span>
                <span className="text-sm text-gray-500">错误数</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrend}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{fill: '#94a3b8', fontSize: 12}}
                        dy={10}
                        tickMargin={8}
                        interval={0}
                    />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  formatter={(value: number | string, name: string) => {
                      const numeric = typeof value === 'number' ? value : Number(value);
                      return [Number.isFinite(numeric) ? numeric.toLocaleString() : '0', name];
                  }}
                  labelFormatter={(label: string) => `日期: ${label}`}
                />
                <Area name="请求数" type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRequests)" />
                <Area name="错误数" type="monotone" dataKey="errors" stroke="#f87171" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-8">能力调用分布</h3>
            {(!capability_dist || capability_dist.length === 0) ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              暂无数据
            </div>
          ) : (
            <>
              <div className="h-[220px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={capability_dist}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="capability"
                    >
                      {capability_dist.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value + ' 次', '调用数']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {capability_dist.slice(0, 4).map((item, index) => (
                  <div key={item.capability} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-xs text-gray-500 font-medium truncate">{item.capability}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
