import { create } from 'zustand';
import { authApi, setAuthToken } from '../services/api';
import type { User } from '../types';

const TOKEN_KEY = 'helix_auth_token';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username: string) => {
    try {
      const response = await authApi.login(username);
      if (response.data.success) {
        // Save token
        if (response.data.token) {
          localStorage.setItem(TOKEN_KEY, response.data.token);
          setAuthToken(response.data.token);
        }
        set({
          user: response.data.user,
          isAuthenticated: true,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      set({ user: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      // Restore token from localStorage
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
      }

      const response = await authApi.checkAuth();
      if (response.data.authenticated) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshUser: async () => {
    try {
      const response = await authApi.getUser();
      if (response.data.success) {
        set({ user: response.data.user });
      }
    } catch {
      // Silently fail
    }
  },
}));
