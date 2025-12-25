"""
初始化德扑数据库表
"""

from models import db, PokerGame, PokerPlayer, PokerHand, PokerAction, PokerConfig

def init_poker_tables():
    """初始化德扑相关的数据库表"""

    # 确保所有表都存在
    db.create_all()

    print("德扑数据库表初始化完成")

if __name__ == '__main__':
    from app import app
    with app.app_context():
        init_poker_tables()