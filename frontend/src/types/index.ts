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
  message?: string;
}

// Travel types - 旅行计划相关类型
export interface TravelPlan {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  destination?: string;
  start_date: string;
  end_date: string;
  cover_image?: string;
  budget?: number;
  status: 'planning' | 'ongoing' | 'completed';
  shared: boolean;
  created_at: string;
  days_count: number;
  itinerary_count?: number;
  hotel_count?: number;
  transport_count?: number;
}

export interface TravelItinerary {
  id: number;
  plan_id?: number;
  day_number: number;
  order_index: number;
  title: string;
  description?: string;
  location_name?: string;
  location_address?: string;
  latitude?: number;
  longitude?: number;
  poi_id?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  category: 'attraction' | 'food' | 'transport' | 'hotel' | string;
  cost?: number;
  notes?: string;
  // 用户体验记录字段
  review?: string;
  rating?: number;
  actual_cost?: number;
  photos?: string[];
  visited?: boolean;
  visited_at?: string;
  // 通勤信息
  transport_mode?: 'driving' | 'walking' | 'transit';
  transport_duration?: number;
  transport_distance?: number;
  transport_cost?: number;
  transport_info?: {
    driving?: {
      duration: number;
      distance: number;
      tolls: number;
      taxi_cost?: number;
      polyline?: string;
    };
    transit?: Array<{
      duration: number;
      distance: number;
      walking_distance: number;
      cost: number;
      segments: Array<{
        type: 'bus' | 'railway' | 'walk';
        name?: string;
        departure_stop?: string;
        arrival_stop?: string;
        via_num?: number;
        distance?: number;
        duration?: number;
        polyline?: string;
      }>;
    }>;
  };
  // 交通类型专用字段（起终点）
  from_location_name?: string;
  from_location_address?: string;
  from_latitude?: number;
  from_longitude?: number;
  departure_datetime?: string;
  arrival_datetime?: string;
  // 酒店跨天字段
  check_in_day?: number;
  check_out_day?: number;
  // 酒店注入标记（后端生成）
  is_hotel_injection?: boolean;
  injected_day?: number;
}

export interface TravelPlanDetail extends TravelPlan {
  itinerary_by_day: Record<number, TravelItinerary[]>;
}

export interface AmapPoi {
  id: string;
  name: string;
  address?: string;
  type?: string;
  typecode?: string;
  longitude?: number;
  latitude?: number;
  tel?: string;
  rating?: string;
  distance?: string;
  photos?: string[];
}

export interface TravelPlansResponse {
  success: boolean;
  plans: TravelPlan[];
}

export interface TravelPlanDetailResponse {
  success: boolean;
  plan: TravelPlanDetail;
}

export interface AmapSearchResponse {
  success: boolean;
  pois: AmapPoi[];
  error?: string;
}

// City grouping types
export interface CityGroup {
  cityName: string;
  cityKey: string;
  centerLng: number;
  centerLat: number;
  items: TravelItinerary[];
}

// AI Travel Planning types
export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIGeneratedPlan {
  ready_to_generate?: boolean;
  plan?: {
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
    budget?: number;
    description?: string;
    itinerary?: Array<{
      day_number: number;
      items: Array<{
        order_index: number;
        title: string;
        category: string;
        start_time?: string;
        end_time?: string;
        location_name?: string;
        location_address?: string;
        duration_minutes?: number;
        cost?: number;
        description?: string;
        from_location_name?: string;
        departure_datetime?: string;
        arrival_datetime?: string;
      }>;
    }>;
  };
}

export interface AIChatResponse {
  success: boolean;
  message: string;
  tool_calls?: Array<{
    tool_name: string;
    arguments: Record<string, unknown>;
    result: { success: boolean; message?: string; error?: string; plan_id?: number; item_id?: number; [key: string]: unknown };
  }>;
  error?: string;
}

// Learning types - 学习测验相关类型
export interface LearningQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  category: string;
  difficulty: string;
  answered: boolean;
  selected_answer?: string;
  is_correct?: boolean;
  correct_answer?: string;
  explanation?: string;
}

export interface LearningQuestionsResponse {
  success: boolean;
  date: string;
  questions: LearningQuestion[];
  total: number;
  answered: number;
  daily_limit: number;
}

export interface LearningAnswerResponse {
  success: boolean;
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  error?: string;
}

export interface LearningGenerateResponse {
  success: boolean;
  generated: number;
  today_count: number;
  daily_limit: number;
  questions: LearningQuestion[];
  error?: string;
}

export interface LearningCategoryStat {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface LearningTrendItem {
  date: string;
  answered: number;
  correct: number;
  accuracy: number;
}

export interface LearningStatsResponse {
  success: boolean;
  total_answered: number;
  total_correct: number;
  accuracy: number;
  streak: number;
  today: {
    total: number;
    answered: number;
    correct: number;
  };
  categories: LearningCategoryStat[];
  trend: LearningTrendItem[];
}
