
import React from 'react';
import {
    LayoutDashboard,
    Layers,
    Users,
    Key,
    FileText,
    Zap,
    Book,
    Activity
} from 'lucide-react';

export const ROUTES = [
  { path: '/dashboard', name: '仪表盘', icon: <LayoutDashboard size={20} />, roles: ['admin', 'user'] },
  { path: '/channels', name: '渠道管理', icon: <Layers size={20} />, roles: ['admin'] },
  { path: '/capabilities', name: '能力配置', icon: <Zap size={20} />, roles: ['admin'] },
  { path: '/users', name: '用户管理', icon: <Users size={20} />, roles: ['admin'] },
  { path: '/tokens', name: '令牌管理', icon: <Key size={20} />, roles: ['user', 'admin'] },
    {path: '/api-docs', name: 'API 文档', icon: <Book size={20}/>, roles: ['user', 'admin']},
  { path: '/logs', name: '调用日志', icon: <FileText size={20} />, roles: ['user', 'admin'] },
  { path: '/request-logs', name: '请求日志', icon: <Activity size={20} />, roles: ['admin'] },
];

export const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  cooldown: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
};

export const STATUS_LABELS = {
  active: '已启用',
  inactive: '已禁用',
  cooldown: '冷却中',
  expired: '已过期',
};
