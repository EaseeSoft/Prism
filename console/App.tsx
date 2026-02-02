import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import Capabilities from './pages/Capabilities';
import Users from './pages/Users';
import Tokens from './pages/Tokens';
import Logs from './pages/Logs';
import RequestLogs from './pages/RequestLogs';
import ApiDocs from './pages/ApiDocs';
import CapabilityPrices from './pages/CapabilityPrices';
import { User, UserRole } from './types';
import { login, register, logout, getCurrentUser } from './services/api';
import {LogIn, UserPlus, ArrowLeft} from 'lucide-react';
import logo from '@/assets/logo.png';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
    const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('prism_token');
    if (token) {
      getCurrentUser()
        .then(user => {
          setUser(user);
          localStorage.setItem('prism_user', JSON.stringify(user));
        })
        .catch(() => {
          localStorage.removeItem('prism_token');
          localStorage.removeItem('prism_user');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);
    try {
      const { user } = await login(username, password);
      setUser(user);
      localStorage.setItem('prism_user', JSON.stringify(user));
        setShowAuthForm(false);
        setUsername('');
        setPassword('');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsAuthenticating(true);
    try {
      await register(username, password);
      setAuthMode('login');
      setError('');
      setSuccessMsg('注册成功，请登录');
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

    const handleShowLogin = () => {
        setShowAuthForm(true);
        setAuthMode('login');
        setError('');
        setSuccessMsg('');
    };

    const handleBackToHome = () => {
        setShowAuthForm(false);
        setError('');
        setSuccessMsg('');
        setUsername('');
        setPassword('');
    };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

    // 未登录：显示首页或登录表单
  if (!user) {
      if (!showAuthForm) {
          return <Home onLogin={handleShowLogin}/>;
      }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <button
                onClick={handleBackToHome}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm"
            >
                <ArrowLeft size={16}/>
                返回首页
            </button>

          <div className="flex flex-col items-center mb-8">
              <img src={logo} alt="Prism" className="w-16 h-16 mb-4"/>
              <h1 className="text-2xl font-bold text-gray-900">棱镜</h1>
            <p className="text-gray-500 mt-2">
              {authMode === 'login' ? '请登录您的账户' : '创建新账户'}
            </p>
          </div>

          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
              {successMsg}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="请输入用户名"
                required
                minLength={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="请输入密码"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : authMode === 'login' ? (
                <>
                  <LogIn size={18} />
                  登录
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  注册
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setError('');
                setSuccessMsg('');
              }}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              {authMode === 'login' ? '没有账户? 点击注册' : '已有账户? 点击登录'}
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
              棱镜 v1.0.0
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === UserRole.ADMIN;

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {isAdmin && (
            <>
              <Route path="/channels" element={<Channels />} />
              <Route path="/capabilities" element={<Capabilities />} />
              <Route path="/users" element={<Users />} />
              <Route path="/request-logs" element={<RequestLogs />} />
            </>
          )}

          <Route path="/tokens" element={<Tokens />} />
            <Route path="/api-docs" element={<ApiDocs/>}/>
          <Route path="/logs" element={<Logs />} />
          <Route path="/capability-prices" element={<CapabilityPrices />} />

          <Route path="*" element={<div className="text-center py-20 text-gray-400 font-medium italic">页面正在开发中</div>} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
