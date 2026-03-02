from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), default='')  # 密码哈希
    avatar = db.Column(db.String(200), default='')
    created_at = db.Column(db.DateTime, server_default=func.now())

    def set_password(self, password):
        """设置密码"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """验证密码"""
        if not self.password_hash:
            # 如果没有设置密码，使用默认密码 helix
            return password == 'helix'
        return check_password_hash(self.password_hash, password)

    # 关系
    assets = db.relationship('Asset', backref='user', lazy=True)
    photos = db.relationship('Photo', backref='user', lazy=True)
    messages = db.relationship('Message', backref='user', lazy=True)
    events = db.relationship('Event', foreign_keys='Event.user_id', backref='user', lazy=True)

class Asset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(20), nullable=False, default='现金')
    amount = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())
    updated_at = db.Column(db.DateTime, server_default=func.now(), onupdate=func.now())

    # 资产分类 - 统一从 utils 导入

class Photo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    caption = db.Column(db.Text)
    created_at = db.Column(db.DateTime, server_default=func.now())

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_time = db.Column(db.DateTime, nullable=False)  # 开始时间
    end_time = db.Column(db.DateTime, nullable=False)    # 结束时间
    shared = db.Column(db.Boolean, default=False)
    invited_user = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, server_default=func.now())

    # 重复日程相关字段
    is_recurring = db.Column(db.Boolean, default=False)  # 是否重复
    recurrence_type = db.Column(db.String(20))  # 重复类型: 'daily', 'weekly', 'weekdays', 'monthly'
    recurrence_data = db.Column(db.Text)  # JSON格式的重复数据，如星期几、间隔等
    recurrence_end = db.Column(db.Date)  # 重复结束日期，为空表示无限重复
    parent_event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=True)  # 父事件ID

    # 关系
    invited_user_obj = db.relationship('User', foreign_keys=[invited_user])
    parent_event = db.relationship('Event', remote_side=[id], foreign_keys=[parent_event_id])
    child_events = db.relationship('Event', foreign_keys=[parent_event_id], backref=db.backref('parent', remote_side=[id]))

    # 定义重复类型
    RECURRENCE_TYPES = {
        'daily': '每天',
        'weekdays': '工作日',
        'weekly': '每周',
        'biweekly': '每两周',
        'monthly': '每月'
    }

class AssetHistory(db.Model):
    """资产历史记录表 - 用于绘制折线图"""
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, unique=True)  # 日期
    total_assets = db.Column(db.Float, default=0)  # 当日总资产
    created_at = db.Column(db.DateTime, server_default=func.now())

class AssetCategoryHistory(db.Model):
    """资产分类历史记录表 - 用于绘制分类折线图"""
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)  # 日期
    category = db.Column(db.String(20), nullable=False)  # 资产分类
    amount = db.Column(db.Float, default=0)  # 当日该分类总金额
    created_at = db.Column(db.DateTime, server_default=func.now())

    # 复合唯一约束：每个日期每个分类只有一条记录
    __table_args__ = (db.UniqueConstraint('date', 'category', name='_date_category_uc'),)

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text)  # 文字消息内容
    image_filename = db.Column(db.String(200))  # 图片文件名
    message_type = db.Column(db.String(20), default='text')  # 'text' 或 'image'
    is_read = db.Column(db.Boolean, default=False)  # 是否已读
    created_at = db.Column(db.DateTime, server_default=func.now())

    # 关系
    sender = db.relationship('User', foreign_keys=[sender_id])
    receiver = db.relationship('User', foreign_keys=[receiver_id])
    reactions = db.relationship('ChatReaction', backref='message', lazy=True, cascade='all, delete-orphan')


class ChatReaction(db.Model):
    """聊天消息表情反应"""
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('chat_message.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    emoji = db.Column(db.String(50), nullable=False)  # 表情标识符
    created_at = db.Column(db.DateTime, server_default=func.now())

    # 关系
    user = db.relationship('User', foreign_keys=[user_id])

    # 每个用户对每条消息只能添加一个相同的表情
    __table_args__ = (db.UniqueConstraint('message_id', 'user_id', 'emoji', name='_message_user_emoji_uc'),)

# 德扑相关模型
class PokerGame(db.Model):
    """德扑游戏记录"""
    __tablename__ = 'poker_games'
    id = db.Column(db.Integer, primary_key=True)
    game_type = db.Column(db.String(50), default='cash_game')  # 'cash_game', 'tournament'
    small_blind = db.Column(db.Integer, default=10)
    big_blind = db.Column(db.Integer, default=20)
    buy_in = db.Column(db.Integer, default=1000)
    max_players = db.Column(db.Integer, default=8)
    ai_difficulty = db.Column(db.String(20), default='medium')  # 'easy', 'medium', 'hard'
    status = db.Column(db.String(20), default='waiting')  # 'waiting', 'active', 'finished'
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finished_at = db.Column(db.DateTime)

    # 关系
    creator = db.relationship('User', foreign_keys=[created_by])
    players = db.relationship('PokerPlayer', backref='game', lazy=True, cascade='all, delete-orphan')
    hands = db.relationship('PokerHand', backref='game', lazy=True, cascade='all, delete-orphan')

class PokerPlayer(db.Model):
    """德扑游戏玩家"""
    __tablename__ = 'poker_players'
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('poker_games.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # 真人玩家
    ai_type = db.Column(db.String(50))  # AI类型
    ai_name = db.Column(db.String(50))  # AI名称
    position = db.Column(db.Integer)  # 座位位置 (0-7)
    chips = db.Column(db.Integer, default=1000)  # 当前筹码
    is_active = db.Column(db.Boolean, default=True)  # 是否仍在游戏中
    is_ai = db.Column(db.Boolean, default=False)  # 是否为AI
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 关系
    user = db.relationship('User', foreign_keys=[user_id])
    actions = db.relationship('PokerAction', backref='player', lazy=True, cascade='all, delete-orphan')

class PokerHand(db.Model):
    """德扑手牌记录"""
    __tablename__ = 'poker_hands'
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('poker_games.id'), nullable=False)
    hand_number = db.Column(db.Integer, default=1)  # 手牌序号
    community_cards = db.Column(db.Text)  # JSON存储公共牌
    pot_size = db.Column(db.Integer, default=0)  # 底池大小
    winner_id = db.Column(db.Integer, db.ForeignKey('poker_players.id'))  # 获胜者
    hand_result = db.Column(db.String(100))  # 'royal_flush', 'full_house', etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 关系
    winner = db.relationship('PokerPlayer', foreign_keys=[winner_id])
    actions = db.relationship('PokerAction', backref='hand', lazy=True, cascade='all, delete-orphan')

class PokerAction(db.Model):
    """德扑玩家操作记录"""
    __tablename__ = 'poker_actions'
    id = db.Column(db.Integer, primary_key=True)
    hand_id = db.Column(db.Integer, db.ForeignKey('poker_hands.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('poker_players.id'), nullable=False)
    action_type = db.Column(db.String(20), nullable=False)  # 'fold', 'call', 'raise', 'check'
    amount = db.Column(db.Integer, default=0)  # 操作金额
    betting_round = db.Column(db.String(20), nullable=False)  # 'preflop', 'flop', 'turn', 'river'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class PokerConfig(db.Model):
    """德扑配置"""
    __tablename__ = 'poker_configs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    default_ai_difficulty = db.Column(db.String(20), default='medium')
    default_small_blind = db.Column(db.Integer, default=10)
    default_big_blind = db.Column(db.Integer, default=20)
    default_buy_in = db.Column(db.Integer, default=1000)
    auto_ai_players = db.Column(db.Boolean, default=True)  # 自动填充AI玩家
    ai_player_count = db.Column(db.Integer, default=6)  # AI玩家数量
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (db.UniqueConstraint('user_id', name='_user_config_uc'),)


# 旅行计划相关模型
class TravelPlan(db.Model):
    """旅行计划主表"""
    __tablename__ = 'travel_plans'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)  # 计划标题
    description = db.Column(db.Text)  # 描述
    destination = db.Column(db.String(200))  # 目的地
    start_date = db.Column(db.Date, nullable=False)  # 开始日期
    end_date = db.Column(db.Date, nullable=False)  # 结束日期
    cover_image = db.Column(db.String(500))  # 封面图片
    budget = db.Column(db.Float, default=0)  # 预算
    status = db.Column(db.String(20), default='planning')  # planning, ongoing, completed
    shared = db.Column(db.Boolean, default=False)  # 是否共享
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    user = db.relationship('User', foreign_keys=[user_id])
    itineraries = db.relationship('TravelItinerary', backref='plan', lazy=True, cascade='all, delete-orphan')


class TravelItinerary(db.Model):
    """行程项目 - 每个景点/活动"""
    __tablename__ = 'travel_itineraries'
    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('travel_plans.id'), nullable=False)
    day_number = db.Column(db.Integer, nullable=False)  # 第几天
    order_index = db.Column(db.Integer, default=0)  # 当天内的顺序
    title = db.Column(db.String(200), nullable=False)  # 地点名称
    description = db.Column(db.Text)  # 描述/AI建议的活动
    location_name = db.Column(db.String(200))  # 地点名称
    location_address = db.Column(db.String(500))  # 详细地址
    latitude = db.Column(db.Float)  # 纬度
    longitude = db.Column(db.Float)  # 经度
    poi_id = db.Column(db.String(100))  # 高德POI ID
    start_time = db.Column(db.Time)  # 开始时间
    end_time = db.Column(db.Time)  # 结束时间
    duration_minutes = db.Column(db.Integer)  # 预计停留时长（分钟）
    category = db.Column(db.String(50))  # 类型: attraction, food, transport, shopping, rest
    cost = db.Column(db.Float, default=0)  # 预计费用
    notes = db.Column(db.Text)  # 备注
    images = db.Column(db.Text)  # JSON格式的图片列表
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 用户体验记录字段
    review = db.Column(db.Text)  # 真实感受/评价
    rating = db.Column(db.Integer)  # 评分 1-5
    actual_cost = db.Column(db.Float)  # 实际花费
    photos = db.Column(db.Text)  # JSON格式的用户上传照片列表
    visited = db.Column(db.Boolean, default=False)  # 是否已打卡
    visited_at = db.Column(db.DateTime)  # 打卡时间
    
    # 通勤信息（到达此地点的交通）
    transport_mode = db.Column(db.String(20))  # 交通方式: driving/walking/transit
    transport_duration = db.Column(db.Integer)  # 通勤时长（分钟）
    transport_distance = db.Column(db.Integer)  # 通勤距离（米）
    transport_cost = db.Column(db.Float)  # 交通费用
    transport_info = db.Column(db.Text)  # 交通详情（JSON）

    # 交通类型专用字段（用于高铁/飞机/大巴等需要起终点的交通）
    from_location_name = db.Column(db.String(200))  # 出发地名称
    from_location_address = db.Column(db.String(500))  # 出发地详细地址
    from_latitude = db.Column(db.Float)  # 出发地纬度
    from_longitude = db.Column(db.Float)  # 出发地经度
    departure_datetime = db.Column(db.DateTime)  # 出发时间
    arrival_datetime = db.Column(db.DateTime)  # 到达时间

    # 酒店跨天字段
    check_in_day = db.Column(db.Integer)    # 入住日 (day_number)
    check_out_day = db.Column(db.Integer)   # 退房日 (day_number)

    # 类型常量
    CATEGORIES = {
        'attraction': '景点',
        'food': '餐饮',
        'transport': '交通',
        'hotel': '酒店',
    }


# 学习测验相关模型
class LearningQuestion(db.Model):
    """学习测验题目"""
    __tablename__ = 'learning_questions'
    id = db.Column(db.Integer, primary_key=True)
    question_text = db.Column(db.Text, nullable=False)
    option_a = db.Column(db.Text, nullable=False)
    option_b = db.Column(db.Text, nullable=False)
    option_c = db.Column(db.Text, nullable=False)
    option_d = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False)  # A/B/C/D
    explanation = db.Column(db.Text)
    category = db.Column(db.String(50))  # databases, api_design, security, etc.
    difficulty = db.Column(db.String(10))  # easy, medium, hard
    batch_date = db.Column(db.Date, nullable=False)  # 生成日期
    batch_index = db.Column(db.Integer)  # 当天批次序号
    question_hash = db.Column(db.String(64), unique=True, nullable=False)  # SHA-256去重
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    answers = db.relationship('LearningAnswer', backref='question', lazy=True, cascade='all, delete-orphan')


class LearningAnswer(db.Model):
    """用户答题记录"""
    __tablename__ = 'learning_answers'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('learning_questions.id'), nullable=False)
    selected_answer = db.Column(db.String(1), nullable=False)  # A/B/C/D
    is_correct = db.Column(db.Boolean, nullable=False)
    time_spent = db.Column(db.Integer)  # 答题耗时（秒）
    answered_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (db.UniqueConstraint('user_id', 'question_id', name='_user_question_uc'),)