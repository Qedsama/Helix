import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type {
  LoginResponse,
  AuthCheckResponse,
  UsersResponse,
  AssetsResponse,
  PhotosResponse,
  MessagesResponse,
  EventsResponse,
  ChatMessagesResponse,
  PokerGamesResponse,
  ChartDataResponse,
  CreateResponse,
  SuccessResponse,
  PokerState,
  User,
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const getImageUrl = (filename: string): string => {
  if (!filename) return '';
  if (filename.startsWith('http') || filename.startsWith('data:')) return filename;
  if (filename.startsWith('/static/')) return `${API_BASE_URL}${filename}`;
  return `${API_BASE_URL}/static/uploads/${filename}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (username: string): Promise<AxiosResponse<LoginResponse>> =>
    api.post('/api/login', { username }),
  logout: (): Promise<AxiosResponse<SuccessResponse>> =>
    api.get('/api/logout'),
  checkAuth: (): Promise<AxiosResponse<AuthCheckResponse>> =>
    api.get('/api/check-auth'),
  getUsers: (): Promise<AxiosResponse<UsersResponse>> =>
    api.get('/api/users'),
  getUser: (): Promise<AxiosResponse<{ success: boolean; user: User }>> =>
    api.get('/api/user'),
};

// Assets API
export const assetApi = {
  getAll: (): Promise<AxiosResponse<AssetsResponse>> =>
    api.get('/api/assets'),
  create: (data: { name: string; category: string; amount: number }): Promise<AxiosResponse<CreateResponse>> =>
    api.post('/api/assets', data),
  update: (id: number, data: { name: string; category: string; amount: number }): Promise<AxiosResponse<SuccessResponse>> =>
    api.put(`/api/assets/${id}`, data),
  delete: (id: number): Promise<AxiosResponse<SuccessResponse>> =>
    api.delete(`/api/assets/${id}`),
  getChartData: (params?: { start_date?: string; end_date?: string; type?: string; pie_type?: string }): Promise<AxiosResponse<ChartDataResponse>> =>
    api.get('/api/assets/chart-data', { params }),
};

// Photos API
export const photoApi = {
  getAll: (): Promise<AxiosResponse<PhotosResponse>> =>
    api.get('/api/photos'),
  upload: (formData: FormData): Promise<AxiosResponse<CreateResponse>> =>
    api.post('/api/photos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number): Promise<AxiosResponse<SuccessResponse>> =>
    api.delete(`/api/photos/${id}`),
};

// Messages API (wall)
export const messageApi = {
  getAll: (): Promise<AxiosResponse<MessagesResponse>> =>
    api.get('/api/messages'),
  create: (content: string): Promise<AxiosResponse<CreateResponse>> =>
    api.post('/api/messages', { content }),
  delete: (id: number): Promise<AxiosResponse<SuccessResponse>> =>
    api.delete(`/api/messages/${id}`),
};

// Calendar API
export const calendarApi = {
  getEvents: (year?: number, month?: number): Promise<AxiosResponse<EventsResponse>> =>
    api.get('/api/events', { params: { year, month } }),
  createEvent: (data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    shared: boolean;
  }): Promise<AxiosResponse<CreateResponse>> =>
    api.post('/api/events', data),
  updateEvent: (id: number, data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    shared: boolean;
  }): Promise<AxiosResponse<SuccessResponse>> =>
    api.put(`/api/events/${id}`, data),
  deleteEvent: (id: number): Promise<AxiosResponse<SuccessResponse>> =>
    api.delete(`/api/events/${id}`),
};

// Chat API
export const chatApi = {
  getMessages: (before?: number): Promise<AxiosResponse<ChatMessagesResponse>> =>
    api.get('/api/chat/messages', { params: { before } }),
  send: (content: string): Promise<AxiosResponse<CreateResponse>> =>
    api.post('/api/chat/send', { content }),
  uploadImage: (formData: FormData): Promise<AxiosResponse<CreateResponse>> =>
    api.post('/chat/upload_image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getUnreadCount: (): Promise<AxiosResponse<{ count: number }>> =>
    api.get('/chat/unread_count'),
  addReaction: (messageId: number, emoji: string): Promise<AxiosResponse<{ success: boolean; action: 'added' | 'removed' }>> =>
    api.post('/api/chat/reaction', { message_id: messageId, emoji }),
  removeReaction: (messageId: number, emoji: string): Promise<AxiosResponse<SuccessResponse>> =>
    api.delete(`/api/chat/reaction/${messageId}/${encodeURIComponent(emoji)}`),
};

// Poker API
export const pokerApi = {
  createGame: (data: {
    ai_difficulty: string;
    small_blind: number;
    big_blind: number;
    buy_in: number;
    ai_player_count: number;
    second_user_id?: number;
  }): Promise<AxiosResponse<{ success: boolean; game_id: number }>> =>
    api.post('/poker/create', data),
  getGameState: (gameId: number): Promise<AxiosResponse<PokerState>> =>
    api.get(`/poker/game/${gameId}/state`),
  makeAction: (gameId: number, action: number, amount?: number): Promise<AxiosResponse<{ success: boolean; game_state: PokerState }>> =>
    api.post(`/poker/game/${gameId}/action`, { action, amount }),
  aiAction: (gameId: number): Promise<AxiosResponse<{ success: boolean; game_state: PokerState }>> =>
    api.post(`/poker/game/${gameId}/ai_step`),
  newHand: (gameId: number): Promise<AxiosResponse<{ success: boolean; game_state: PokerState }>> =>
    api.post(`/poker/game/${gameId}/new_hand`),
  getRecentGames: (): Promise<AxiosResponse<PokerGamesResponse>> =>
    api.get('/poker/recent'),
  getConfig: (): Promise<AxiosResponse<{ success: boolean; config: Record<string, unknown> }>> =>
    api.get('/poker/config'),
};

// Dashboard API
export const dashboardApi = {
  getData: (): Promise<AxiosResponse<{ success: boolean; data: unknown }>> =>
    api.get('/api/dashboard'),
};

// File validation helpers
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif'];
export const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: '只支持 PNG, JPEG, GIF 格式的图片' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '文件过大，最大支持 16MB' };
  }
  return { valid: true };
};

export default api;
