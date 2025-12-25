// User type
export interface User {
  id: number;
  username: string;
  avatar?: string;
}

// Asset types
export interface Asset {
  id: number;
  name: string;
  category: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

// Photo type
export interface Photo {
  id: number;
  filename: string;
  caption?: string;
  created_at: string;
  user_id: number;
}

// Message type (wall)
export interface Message {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  username: string;
}

// Chat message type
export interface ChatReaction {
  emoji: string;
  count: number;
  users: Array<{
    user_id: number;
    username: string;
  }>;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  message_type: 'text' | 'image';
  image_filename?: string;
  created_at: string;
  is_read: boolean;
  username?: string;
  reactions?: ChatReaction[];
}

// Calendar event type
export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  event_date: string;
  start_time: string;
  end_time: string;
  user_id: number;
  shared: boolean;
  is_recurring: boolean;
  recurrence_type?: string;
}

// Poker types
export interface PokerGame {
  id: number;
  status: 'waiting' | 'playing' | 'finished';
  small_blind: number;
  big_blind: number;
  ai_difficulty: string;
  created_at: string;
}

export interface PokerPlayer {
  id: number;
  name: string;
  chips: number;
  bet: number;
  cards: string[];
  is_active: boolean;
  is_dealer: boolean;
  is_ai: boolean;
  position: number;
  current_bet: number;
  hand: string;
}

export interface PokerWinnerInfo {
  winner_position: number;
  winner_name: string;
  pot_won: number;
  player_hands: Record<number, string>;
}

export interface PokerState {
  game_id: number;
  status: string;
  pot: number;
  community_cards: string[];
  current_player: number;
  players: PokerPlayer[];
  available_actions: string[];
  min_raise: number;
  current_bet: number;
  // Extended fields for full game state
  my_position?: number | null;
  public_cards?: string;
  legal_actions?: number[];
  action_names?: string[];
  is_hand_over?: boolean;
  is_game_over?: boolean;
  round?: string;
  hand_number?: number;
  dealer_position?: number;
  sb_position?: number;
  bb_position?: number;
  small_blind?: number;
  big_blind?: number;
  last_action?: { player: number; action: number; action_name: string } | null;
  pending_ai_action?: boolean;
  winner_info?: PokerWinnerInfo | null;
  max_raise?: number;
  call_amount?: number;
  error?: string;
  no_action?: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export interface AuthCheckResponse {
  success: boolean;
  authenticated: boolean;
  user?: User;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

export interface UsersResponse {
  success: boolean;
  users: User[];
}

export interface AssetsResponse {
  success: boolean;
  assets: Asset[];
}

export interface PhotosResponse {
  success: boolean;
  photos: Photo[];
}

export interface MessagesResponse {
  success: boolean;
  messages: Message[];
}

export interface EventsResponse {
  success: boolean;
  events: CalendarEvent[];
}

export interface ChatMessagesResponse {
  success: boolean;
  messages: ChatMessage[];
}

export interface PokerGamesResponse {
  success: boolean;
  games: PokerGame[];
}

export interface ChartDataResponse {
  pie: {
    labels: string[];
    data: number[];
  };
  line: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
      borderWidth: number;
      fill: boolean;
      tension: number;
    }>;
  };
  chart_type: string;
  date_range: {
    start: string;
    end: string;
  };
}

export interface CreateResponse {
  success: boolean;
  id?: number;
  error?: string;
}

export interface SuccessResponse {
  success: boolean;
  error?: string;
}
