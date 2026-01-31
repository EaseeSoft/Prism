import React, { useEffect, useState } from 'react';
import {Users as UsersIcon, Search, Calendar, Shield, Plus} from 'lucide-react';
import {fetchUsers, updateUserRole, rechargeUser} from '../services/api';
import { User, UserRole } from '../types';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
    const [rechargeTarget, setRechargeTarget] = useState<User | null>(null);
    const [rechargeAmount, setRechargeAmount] = useState('');
    const [isRecharging, setIsRecharging] = useState(false);

  const loadUsers = () => {
    setIsLoading(true);
    fetchUsers()
      .then(data => setUsers(data))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (user: User) => {
    const newRole = user.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN;
    if (!confirm(`确定要将 ${user.username} 的角色改为 ${newRole === UserRole.ADMIN ? '管理员' : '普通用户'} 吗?`)) {
      return;
    }
    try {
      await updateUserRole(user.id, newRole);
      loadUsers();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

    const handleRecharge = async () => {
        if (!rechargeTarget) return;
        const amount = Number(rechargeAmount);
        if (!amount || amount <= 0) {
            alert('请输入有效的充值金额');
            return;
        }
        setIsRecharging(true);
        try {
            await rechargeUser(rechargeTarget.id, amount);
            setRechargeTarget(null);
            setRechargeAmount('');
            loadUsers();
        } catch (err: any) {
            alert(err.message || '充值失败');
        } finally {
            setIsRecharging(false);
        }
    };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-500 mt-1">管理系统注册用户、角色分配及账户余额</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="搜索用户名..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-4">
            <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">
              共 {users.length} 位用户
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">用户信息</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">角色权限</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">当前余额</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">注册日期</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">管理操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-indigo-600">
                        <UsersIcon size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{user.username}</div>
                        <div className="text-[10px] text-gray-400 font-mono">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${user.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      <Shield size={10} />
                      {user.role === UserRole.ADMIN ? '管理员' : '普通用户'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-900">{user.balance}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-gray-300" />
                      {user.createdAt}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                          className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-bold text-gray-600 rounded-lg hover:border-emerald-600 hover:text-emerald-600 transition-colors flex items-center gap-1.5"
                          onClick={() => {
                              setRechargeTarget(user);
                              setRechargeAmount('');
                          }}
                      >
                          <Plus size={12}/>
                          充值
                      </button>
                        <button
                        className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-bold text-gray-600 rounded-lg hover:border-indigo-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                        onClick={() => handleRoleChange(user)}
                      >
                        <Shield size={12} />
                        {user.role === UserRole.ADMIN ? '设为普通用户' : '设为管理员'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

        {rechargeTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-xl w-96 p-6 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">用户充值</h3>
                    <p className="text-sm text-gray-500">
                        为用户 <span className="font-bold text-gray-900">{rechargeTarget.username}</span> 充值额度
                    </p>
                    <p className="text-sm text-gray-500">
                        当前余额: <span className="font-bold text-gray-900">{rechargeTarget.balance}</span>
                    </p>
                    <input
                        type="number"
                        min="1"
                        placeholder="请输入充值金额"
                        value={rechargeAmount}
                        onChange={e => setRechargeAmount(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            onClick={() => setRechargeTarget(null)}
                            disabled={isRecharging}
                        >
                            取消
                        </button>
                        <button
                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            onClick={handleRecharge}
                            disabled={isRecharging}
                        >
                            {isRecharging ? '充值中...' : '确认充值'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Users;
