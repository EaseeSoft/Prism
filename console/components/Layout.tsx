
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ChevronRight, User as UserIcon } from 'lucide-react';
import { ROUTES } from '../constants';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  if (!user) return <>{children}</>;

  const filteredRoutes = ROUTES.filter(route => 
    route.roles.includes(user.role)
  );

  const getBreadcrumbName = () => {
    const path = window.location.hash.split('/').pop();
    const route = ROUTES.find(r => r.path.includes(path || 'dashboard'));
    return route ? route.name : '控制台';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out z-30`}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/assert/logo.png" alt="Prism" className="w-8 h-8" />
              {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-gray-800">棱镜</span>}
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto no-scrollbar">
          {filteredRoutes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}
              `}
            >
              <span className="flex-shrink-0">{route.icon}</span>
              {isSidebarOpen && <span className="font-medium">{route.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-20">
          <div className="flex items-center text-sm text-gray-500">
            <span className="hover:text-indigo-600 cursor-pointer">管理后台</span>
            <ChevronRight size={14} className="mx-2" />
            <span className="font-medium text-gray-900">
              {getBreadcrumbName()}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase font-semibold">账户余额</div>
              <div className="text-sm font-bold text-indigo-600">¥{user.balance.toFixed(2)}</div>
            </div>
            
            <div className="h-8 w-px bg-gray-200"></div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold text-gray-900 leading-tight">{user.username}</span>
                <span className="text-xs text-gray-500">{user.role === UserRole.ADMIN ? '管理员' : '普通用户'}</span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="登出"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
