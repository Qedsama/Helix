from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    avatar = db.Column(db.String(200), default='')
    created_at = db.Column(db.DateTime, server_default=func.now())

    # 关系
    assets = db.relationship('Asset', backref='user', lazy=True)
    photos = db.relationship('Photo', backref='user', lazy=True)
    messages = db.relationship('Message', backref='user', lazy=True)
    events = db.relationship('Event', foreign_keys='Event.user_id', backref='user', lazy=True)

class Asset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 保留原有类型字段
    category = db.Column(db.String(20), nullable=False, default='现金')  # 新增分类字段
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