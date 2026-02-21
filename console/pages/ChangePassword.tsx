import React, {useState} from 'react';
import {Lock, Eye, EyeOff, Check} from 'lucide-react';
import {changePassword} from '../services/api';

const ChangePassword: React.FC = () => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (newPassword.length < 6) {
            setError('新密码长度不能少于6位');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('两次输入的新密码不一致');
            return;
        }

        if (oldPassword === newPassword) {
            setError('新密码不能与旧密码相同');
            return;
        }

        setIsSubmitting(true);
        try {
            await changePassword(oldPassword, newPassword);
            setSuccess(true);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">修改密码</h1>
                <p className="text-gray-500 mt-1">修改您的登录密码以保障账户安全</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-lg">
                <div className="p-6">
                    {success && (
                        <div
                            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <Check size={16} className="text-green-600"/>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-green-700">密码修改成功</div>
                                <div className="text-xs text-green-600">请使用新密码重新登录</div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <div className="text-sm text-red-600">{error}</div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock size={18}/>
                                </div>
                                <input
                                    type={showOld ? 'text' : 'password'}
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="请输入当前密码"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowOld(!showOld)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showOld ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock size={18}/>
                                </div>
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="请输入新密码（至少6位）"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showNew ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock size={18}/>
                                </div>
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="请再次输入新密码"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirm ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <Lock size={18}/>
                                    确认修改
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                        <div className="text-xs text-gray-500 space-y-1">
                            <p>密码要求:</p>
                            <ul className="list-disc list-inside">
                                <li>长度至少6位字符</li>
                                <li>建议包含字母和数字</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
