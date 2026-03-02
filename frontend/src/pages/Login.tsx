import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi, getImageUrl } from '../services/api';
import type { User } from '../types';

const gradients = [
  'from-pink-400 to-rose-500',
  'from-amber-400 to-orange-500',
];

const Login: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await authApi.getUsers();
        if (response.data.success) {
          setUsers(response.data.users);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setPassword('');
    setError('');
  };

  const handleBack = () => {
    setSelectedUser(null);
    setPassword('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setError('');
    setLoading(true);

    const result = await login(selectedUser.username, password);

    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || '登录失败，请重试');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-200 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200 rounded-full opacity-30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-200 rounded-full opacity-20 blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-lg mx-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4">
              H
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Helix</h1>
            <p className="text-gray-500 mt-2">
              {selectedUser ? '输入密码登录' : '选择你的身份'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          {selectedUser ? (
            /* Password Input Form */
            <form onSubmit={handleLogin}>
              {/* Selected User Display */}
              <div className="flex flex-col items-center mb-6">
                <div
                  className={`w-24 h-24 rounded-full bg-gradient-to-br ${gradients[0]} flex items-center justify-center shadow-lg mb-3 overflow-hidden`}
                >
                  {selectedUser.avatar ? (
                    <img src={getImageUrl(selectedUser.avatar)} alt={selectedUser.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-3xl font-bold">{selectedUser.username[0]?.toUpperCase()}</span>
                  )}
                </div>
                <p className="text-xl font-semibold text-gray-800">{selectedUser.username}</p>
              </div>

              {/* Password Input */}
              <div className="mb-6">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-center text-lg"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      登录中...
                    </span>
                  ) : (
                    '登录'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* User Selection */
            <div className="grid grid-cols-2 gap-6">
              {users.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="group relative p-6 rounded-2xl transition-all duration-300 bg-white hover:shadow-xl hover:scale-105 hover:-translate-y-1 border border-gray-100"
                >
                  {/* Avatar */}
                  <div
                    className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${gradients[index % gradients.length]} flex items-center justify-center shadow-lg mb-4 group-hover:shadow-xl transition-shadow overflow-hidden`}
                  >
                    {user.avatar ? (
                      <img src={getImageUrl(user.avatar)} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-2xl font-bold">{user.username[0]?.toUpperCase()}</span>
                    )}
                  </div>

                  {/* Name */}
                  <p className="text-lg font-semibold text-gray-800 text-center">
                    {user.username}
                  </p>

                  {/* Hover effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 to-white/0 group-hover:from-amber-500/5 group-hover:to-orange-500/5 transition-all duration-300" />
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <p className="mt-10 text-center text-sm text-gray-400">
            Couples' Private Space
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
