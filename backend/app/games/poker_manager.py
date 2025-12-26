"""
基于 texasholdem 的德扑游戏管理器 - 8人桌
"""

import random
from datetime import datetime
from typing import Dict, List, Any, Optional
from texasholdem.game.game import TexasHoldEm
from texasholdem.game.action_type import ActionType
from texasholdem.game.hand_phase import HandPhase
from texasholdem.game.player_state import PlayerState
from texasholdem.agents.basic import call_agent, random_agent
from texasholdem.evaluator import evaluate, get_five_card_rank_percentage
from texasholdem.card import Card


def get_db_models():
    from models import db, PokerGame, PokerPlayer, PokerHand, PokerAction, PokerConfig, User
    return db, PokerGame, PokerPlayer, PokerHand, PokerAction, PokerConfig, User


class RuleBasedAI:
    """基于规则和牌力评估的AI"""

    # 翻牌前起手牌分级 (Chen公式简化版)
    PREMIUM_HANDS = {'AA', 'KK', 'QQ', 'AKs', 'AKo'}  # 顶级牌
    STRONG_HANDS = {'JJ', 'TT', 'AQs', 'AQo', 'AJs', 'KQs', '99'}  # 强牌
    PLAYABLE_HANDS = {'88', '77', '66', 'ATs', 'AJo', 'KJs', 'KQo', 'QJs', 'JTs', 'KTs', 'QTs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'}  # 可玩牌

    def __init__(self, difficulty: str = 'medium'):
        self.difficulty = difficulty
        # 难度影响: easy更被动, hard更激进且会诈唬
        self.aggression = {'easy': 0.3, 'medium': 0.5, 'hard': 0.7}.get(difficulty, 0.5)
        self.bluff_frequency = {'easy': 0.1, 'medium': 0.2, 'hard': 0.3}.get(difficulty, 0.2)
        self.call_loose = {'easy': 0.4, 'medium': 0.5, 'hard': 0.3}.get(difficulty, 0.5)  # 跟注宽松度

    def _get_preflop_strength(self, hand: List[str]) -> int:
        """翻牌前手牌强度: 0=弱, 1=可玩, 2=强, 3=顶级"""
        if len(hand) < 2:
            return 0

        # 解析牌面，处理可能的不同格式
        card1, card2 = str(hand[0]), str(hand[1])

        # 提取rank和suit
        r1 = card1[0] if len(card1) >= 2 else card1
        s1 = card1[-1] if len(card1) >= 2 else ''
        r2 = card2[0] if len(card2) >= 2 else card2
        s2 = card2[-1] if len(card2) >= 2 else ''

        is_suited = s1 == s2
        is_pair = r1 == r2

        # 标准化表示 - 大的在前
        ranks = 'AKQJT98765432'
        r1_idx = ranks.find(r1) if r1 in ranks else 99
        r2_idx = ranks.find(r2) if r2 in ranks else 99
        if r1_idx > r2_idx:
            r1, r2 = r2, r1

        if is_pair:
            hand_str = f"{r1}{r2}"
        else:
            hand_str = f"{r1}{r2}{'s' if is_suited else 'o'}"

        # 对子特殊处理
        if is_pair:
            if r1 in 'AK':
                return 3  # AA, KK
            if r1 in 'QJT':
                return 2  # QQ, JJ, TT
            if r1 in '9876':
                return 1  # 中对
            return 1  # 小对子也算可玩

        if hand_str in self.PREMIUM_HANDS:
            return 3
        if hand_str in self.STRONG_HANDS:
            return 2
        if hand_str in self.PLAYABLE_HANDS:
            return 1

        # 同花连张
        if is_suited:
            gap = abs(r1_idx - r2_idx)
            if gap <= 2 and r1_idx < 8:  # 同花连张或隔一张
                return 1
            if r1 == 'A':  # 任何同花A
                return 1

        # 高张
        if r1 in 'AK' and r2_idx < 6:
            return 1

        return 0

    def _get_postflop_strength(self, game: TexasHoldEm, player_id: int) -> float:
        """翻牌后牌力评估，返回0-1的强度值"""
        try:
            hand = game.get_hand(player_id)
            board = game.board
            if not board or len(board) < 3:
                return 0.5

            # 使用evaluator计算牌力百分比
            rank = evaluate(hand, board)
            percentile = get_five_card_rank_percentage(rank)
            return percentile / 100.0
        except:
            return 0.5

    def decide_action(self, game: TexasHoldEm, player_id: int) -> tuple:
        """决定AI动作，返回 (ActionType, amount or None)"""
        moves = game.get_available_moves()
        hand = game.get_hand(player_id)
        hand_str = [str(c) for c in hand]

        can_fold = ActionType.FOLD in moves
        can_check = ActionType.CHECK in moves
        can_call = ActionType.CALL in moves
        can_raise = ActionType.RAISE in moves
        can_allin = ActionType.ALL_IN in moves

        rand = random.random()
        phase = game.hand_phase

        # 计算当前需要跟注的金额（相对于大盲的倍数）
        current_player = game.players[player_id]
        chips = current_player.chips

        # 翻牌前策略
        if phase == HandPhase.PREFLOP:
            strength = self._get_preflop_strength(hand_str)

            if strength == 3:  # 顶级牌 - 积极加注
                if can_raise and moves.raise_range:
                    raise_amt = min(game.big_blind * random.randint(3, 5), moves.raise_range.stop - 1)
                    raise_amt = max(raise_amt, moves.raise_range.start)
                    return ActionType.RAISE, raise_amt
                if can_call:
                    return ActionType.CALL, None
                if can_check:
                    return ActionType.CHECK, None

            elif strength == 2:  # 强牌 - 经常加注
                if can_raise and rand < (0.6 + self.aggression * 0.3) and moves.raise_range:
                    raise_amt = min(game.big_blind * random.randint(2, 4), moves.raise_range.stop - 1)
                    raise_amt = max(raise_amt, moves.raise_range.start)
                    return ActionType.RAISE, raise_amt
                if can_call:
                    return ActionType.CALL, None
                if can_check:
                    return ActionType.CHECK, None

            elif strength == 1:  # 可玩牌 - 主要跟注，偶尔加注
                if can_raise and rand < 0.2 * self.aggression and moves.raise_range:
                    raise_amt = min(game.big_blind * 2, moves.raise_range.stop - 1)
                    raise_amt = max(raise_amt, moves.raise_range.start)
                    return ActionType.RAISE, raise_amt
                if can_check:
                    return ActionType.CHECK, None
                if can_call and rand < (0.7 + self.call_loose * 0.3):
                    return ActionType.CALL, None
                if can_fold:
                    return ActionType.FOLD, None

            else:  # 弱牌 - 但不要总是弃牌
                # 诈唬加注
                if can_raise and rand < self.bluff_frequency and moves.raise_range:
                    raise_amt = min(game.big_blind * 3, moves.raise_range.stop - 1)
                    raise_amt = max(raise_amt, moves.raise_range.start)
                    return ActionType.RAISE, raise_amt
                if can_check:
                    return ActionType.CHECK, None
                # 偶尔用弱牌跟注（尤其是大盲位）
                if can_call and rand < self.call_loose * 0.5:
                    return ActionType.CALL, None
                if can_fold:
                    return ActionType.FOLD, None

        # 翻牌后策略 - 使用实际牌力评估
        else:
            strength = self._get_postflop_strength(game, player_id)
            pot = sum(p.amount for p in game.pots) if game.pots else game.big_blind * 2

            if strength > 0.75:  # 很强的牌 (top 25%)
                if can_allin and rand < 0.15 * self.aggression:
                    return ActionType.ALL_IN, None
                if can_raise and moves.raise_range:
                    bet_size = int(pot * random.uniform(0.6, 1.2))
                    raise_amt = max(moves.raise_range.start, min(bet_size, moves.raise_range.stop - 1))
                    return ActionType.RAISE, raise_amt
                if can_call:
                    return ActionType.CALL, None
                if can_check:
                    return ActionType.CHECK, None

            elif strength > 0.5:  # 中等牌 (top 50%)
                if can_raise and rand < 0.3 * self.aggression and moves.raise_range:
                    bet_size = int(pot * random.uniform(0.3, 0.6))
                    raise_amt = max(moves.raise_range.start, min(bet_size, moves.raise_range.stop - 1))
                    return ActionType.RAISE, raise_amt
                if can_check:
                    return ActionType.CHECK, None
                if can_call and rand < 0.8:
                    return ActionType.CALL, None
                if can_fold and rand > 0.7:
                    return ActionType.FOLD, None
                if can_call:
                    return ActionType.CALL, None

            elif strength > 0.3:  # 较弱但有潜力
                if can_check:
                    return ActionType.CHECK, None
                # 诈唬
                if can_raise and rand < self.bluff_frequency * 0.5 and moves.raise_range:
                    bet_size = int(pot * 0.4)
                    raise_amt = max(moves.raise_range.start, min(bet_size, moves.raise_range.stop - 1))
                    return ActionType.RAISE, raise_amt
                if can_call and rand < 0.5:
                    return ActionType.CALL, None
                if can_fold:
                    return ActionType.FOLD, None

            else:  # 弱牌
                # 偶尔诈唬
                if can_raise and rand < self.bluff_frequency and moves.raise_range:
                    bet_size = int(pot * 0.5)
                    raise_amt = max(moves.raise_range.start, min(bet_size, moves.raise_range.stop - 1))
                    return ActionType.RAISE, raise_amt
                if can_check:
                    return ActionType.CHECK, None
                # 小概率跟注
                if can_call and rand < 0.15:
                    return ActionType.CALL, None
                if can_fold:
                    return ActionType.FOLD, None

        # 默认动作
        if can_check:
            return ActionType.CHECK, None
        if can_call:
            return ActionType.CALL, None
        if can_fold:
            return ActionType.FOLD, None
        return list(moves.action_types)[0], None


class PokerManager:
    """德扑游戏管理器 - 8人桌"""

    ACTION_MAP = {
        0: ActionType.FOLD,
        1: ActionType.CALL,      # 也用于 CHECK
        2: ActionType.RAISE,     # 加注1/2底池
        3: ActionType.RAISE,     # 加注1倍底池
        4: ActionType.ALL_IN,
    }

    ACTION_NAMES = {
        0: '弃牌',
        1: '跟注/过牌',
        2: '加注1/2底池',
        3: '加注1倍底池',
        4: 'ALL IN',
        5: '自定义加注'
    }

    PHASE_NAMES = {
        HandPhase.PREFLOP: '翻牌前',
        HandPhase.FLOP: '翻牌',
        HandPhase.TURN: '转牌',
        HandPhase.RIVER: '河牌',
        HandPhase.PREHAND: '准备中',
        HandPhase.SETTLE: '结算',
    }

    def __init__(self):
        self.games: Dict[int, Dict] = {}

    def create_game(self, user_id: int, ai_difficulty: str = 'medium',
                   small_blind: int = 10, big_blind: int = 20,
                   buy_in: int = 1000, ai_player_count: int = 6,
                   second_user_id: int = None) -> int:
        """创建德扑游戏 - 支持1-2个真人玩家"""
        db, PokerGame, PokerPlayer, PokerHand, PokerAction, PokerConfig, User = get_db_models()

        # 计算玩家数量：真人 + AI
        human_count = 2 if second_user_id else 1
        total_players = min(human_count + ai_player_count, 8)

        # 创建数据库记录
        game = PokerGame(
            game_type='cash_game',
            small_blind=small_blind,
            big_blind=big_blind,
            buy_in=buy_in,
            max_players=total_players,
            ai_difficulty=ai_difficulty,
            status='playing',
            created_by=user_id
        )
        db.session.add(game)
        db.session.commit()

        # 创建 texasholdem 游戏
        th_game = TexasHoldEm(
            buyin=buy_in,
            big_blind=big_blind,
            small_blind=small_blind,
            max_players=total_players
        )
        th_game.start_hand()

        # 创建玩家记录
        human_positions = [0]  # 第一个真人在位置0
        if second_user_id:
            human_positions.append(1)  # 第二个真人在位置1

        for i in range(total_players):
            if i == 0:
                # 第一个真人玩家
                player = PokerPlayer(
                    game_id=game.id,
                    user_id=user_id,
                    position=i,
                    chips=buy_in,
                    is_ai=False
                )
            elif i == 1 and second_user_id:
                # 第二个真人玩家
                player = PokerPlayer(
                    game_id=game.id,
                    user_id=second_user_id,
                    position=i,
                    chips=buy_in,
                    is_ai=False
                )
            else:
                # AI玩家
                ai_index = i - human_count + 1
                player = PokerPlayer(
                    game_id=game.id,
                    user_id=None,
                    position=i,
                    chips=buy_in,
                    is_ai=True,
                    ai_name=f'AI玩家{ai_index}',
                    ai_type=ai_difficulty
                )
            db.session.add(player)
        db.session.commit()

        # 创建AI代理（只为AI位置创建）
        ai_agents = {}
        for i in range(total_players):
            if i not in human_positions:
                ai_agents[i] = RuleBasedAI(ai_difficulty)

        # 游戏状态
        self.games[game.id] = {
            'th_game': th_game,
            'game': game,
            'ai_agents': ai_agents,
            'human_positions': human_positions,
            'total_players': total_players,
            'hand_number': 1,
            'is_hand_over': False,
            'is_game_over': False,
            'winner_info': None,
            'last_action': None,
            'pending_ai_action': th_game.current_player not in human_positions,
            'last_phase': th_game.hand_phase,
            'chips_at_round_start': [th_game.buyin] * total_players,
        }

        return game.id

    def get_game_state(self, game_id: int, requesting_user_id: int = None) -> Dict:
        """获取游戏状态"""
        if game_id not in self.games:
            return {'error': 'Game not found'}

        g = self.games[game_id]
        th = g['th_game']

        # 检查是否进入新的下注轮，如果是则重置下注追踪
        current_phase = th.hand_phase
        if current_phase != g.get('last_phase'):
            g['last_phase'] = current_phase
            # 记录新轮开始时每个玩家的筹码
            g['chips_at_round_start'] = [p.chips for p in th.players]

        db, PokerGame, PokerPlayer, *_ = get_db_models()
        players = PokerPlayer.query.filter_by(game_id=game_id).order_by(PokerPlayer.position).all()

        # 找出请求用户的位置
        requesting_user_position = None
        if requesting_user_id:
            for p in players:
                if p.user_id == requesting_user_id:
                    requesting_user_position = p.position
                    break

        # 构建玩家数据
        player_data = []
        for p in players:
            pos = p.position
            th_player = th.players[pos] if pos < len(th.players) else None

            # 手牌 - 显示给手牌结束时所有人看，或者自己的手牌
            is_my_hand = (requesting_user_position is not None and pos == requesting_user_position)
            if g['is_hand_over'] or is_my_hand:
                try:
                    hand = th.get_hand(pos)
                    hand_str = ' '.join([str(c) for c in hand]) if hand else ''
                except:
                    hand_str = ''
            else:
                hand_str = '??'

            # 筹码和当前轮下注
            chips = th_player.chips if th_player else 0
            # 当前轮下注 = 该轮开始时的筹码 - 当前筹码
            chips_at_start = g['chips_at_round_start'][pos] if pos < len(g['chips_at_round_start']) else chips
            current_bet = chips_at_start - chips
            if current_bet < 0:
                current_bet = 0

            # 玩家状态
            is_active = True
            if th_player:
                is_active = th_player.state not in [PlayerState.OUT, PlayerState.SKIP]

            player_data.append({
                'id': p.id,
                'name': p.user.username if p.user else p.ai_name,
                'position': pos,
                'chips': chips,
                'is_ai': p.is_ai,
                'is_active': is_active,
                'hand': hand_str,
                'current_bet': current_bet
            })

        # 公共牌
        board = th.board if th.board else []
        public_cards = ' '.join([str(c) for c in board])

        # 底池
        pot = sum(pot.amount for pot in th.pots) if th.pots else 0

        # 可用动作转换为数字
        legal_actions = []
        min_raise = 0
        max_raise = 0
        call_amount = 0
        if not g['is_hand_over'] and th.is_hand_running():
            moves = th.get_available_moves()
            if ActionType.FOLD in moves:
                legal_actions.append(0)
            if ActionType.CHECK in moves or ActionType.CALL in moves:
                legal_actions.append(1)
            if ActionType.RAISE in moves:
                legal_actions.extend([2, 3, 5])  # 5 = custom raise
                if moves.raise_range:
                    min_raise = moves.raise_range.start
                    max_raise = moves.raise_range.stop - 1
            if ActionType.ALL_IN in moves:
                legal_actions.append(4)
            # 跟注金额暂时设为大盲
            call_amount = th.big_blind

        return {
            'game_id': game_id,
            'status': 'game_over' if g['is_game_over'] else ('hand_over' if g['is_hand_over'] else 'playing'),
            'current_player': th.current_player if th.is_hand_running() else -1,
            'my_position': requesting_user_position,
            'players': player_data,
            'public_cards': public_cards,
            'pot': pot,
            'legal_actions': legal_actions,
            'action_names': [self.ACTION_NAMES.get(a, f'动作{a}') for a in legal_actions],
            'is_hand_over': g['is_hand_over'],
            'is_game_over': g['is_game_over'],
            'round': self.PHASE_NAMES.get(th.hand_phase, '未知'),
            'hand_number': g['hand_number'],
            'dealer_position': th.btn_loc,
            'sb_position': th.sb_loc,
            'bb_position': th.bb_loc,
            'small_blind': th.small_blind,
            'big_blind': th.big_blind,
            'last_action': g['last_action'],
            'pending_ai_action': g['pending_ai_action'],
            'winner_info': g['winner_info'] if g['is_hand_over'] else None,
            'min_raise': min_raise,
            'max_raise': max_raise,
            'call_amount': call_amount,
        }

    def _calculate_raise_amount(self, th_game: TexasHoldEm, action_type: int) -> Optional[int]:
        """计算加注金额"""
        moves = th_game.get_available_moves()
        if ActionType.RAISE not in moves:
            return None

        if not moves.raise_range:
            return None

        min_raise = moves.raise_range.start
        max_raise = moves.raise_range.stop - 1

        # 计算底池大小
        pot = sum(pot.amount for pot in th_game.pots)

        if action_type == 2:  # 加注1/2底池
            amount = pot // 2
        elif action_type == 3:  # 加注1倍底池
            amount = pot
        else:
            amount = min_raise

        # 限制在合法范围内
        return max(min_raise, min(amount, max_raise))

    def make_action(self, game_id: int, user_id: int, action: int, amount: Optional[int] = None) -> Dict:
        """执行玩家动作"""
        if game_id not in self.games:
            return {'error': 'Game not found'}

        g = self.games[game_id]
        th = g['th_game']

        if g['is_hand_over']:
            return {'error': 'Hand is over'}

        # 找出用户的位置
        db, PokerGame, PokerPlayer, *_ = get_db_models()
        player = PokerPlayer.query.filter_by(game_id=game_id, user_id=user_id).first()
        if not player:
            return {'error': 'Player not found in this game'}

        user_position = player.position
        if th.current_player != user_position:
            return {'error': 'Not your turn'}

        return self._do_action(game_id, action, amount, requesting_user_id=user_id)

    def execute_single_ai_action(self, game_id: int, requesting_user_id: int = None) -> Dict:
        """执行单个AI动作"""
        if game_id not in self.games:
            return {'error': 'Game not found'}

        g = self.games[game_id]
        th = g['th_game']
        human_positions = g.get('human_positions', [0])

        if th.current_player in human_positions or g['is_hand_over'] or not th.is_hand_running():
            g['pending_ai_action'] = False
            return {'success': True, 'no_action': True, 'game_state': self.get_game_state(game_id, requesting_user_id)}

        # AI决策
        ai = g['ai_agents'].get(th.current_player)
        if not ai:
            ai = RuleBasedAI('medium')

        action_type, amount = ai.decide_action(th, th.current_player)

        return self._do_ai_action(game_id, action_type, amount, requesting_user_id)

    def _do_ai_action(self, game_id: int, action_type: ActionType, amount: Optional[int], requesting_user_id: int = None) -> Dict:
        """执行AI动作"""
        g = self.games[game_id]
        th = g['th_game']
        player = th.current_player

        # 记录动作
        action_name = {
            ActionType.FOLD: '弃牌',
            ActionType.CHECK: '过牌',
            ActionType.CALL: '跟注',
            ActionType.RAISE: f'加注到{amount}' if amount else '加注',
            ActionType.ALL_IN: 'ALL IN',
        }.get(action_type, str(action_type))

        g['last_action'] = {
            'player': player,
            'action': action_type.value,
            'action_name': action_name
        }

        # 执行动作
        try:
            if action_type == ActionType.RAISE and amount:
                th.take_action(action_type, total=amount)
            else:
                th.take_action(action_type)
        except Exception as e:
            # 如果动作失败，尝试fold
            try:
                th.take_action(ActionType.FOLD)
                g['last_action']['action_name'] = '弃牌(动作无效)'
            except:
                pass

        # 检查是否结束
        if not th.is_hand_running():
            self._finish_hand(game_id)
        else:
            human_positions = g.get('human_positions', [0])
            g['pending_ai_action'] = (th.current_player not in human_positions)

        return {'success': True, 'game_state': self.get_game_state(game_id, requesting_user_id)}

    def _do_action(self, game_id: int, action: int, custom_amount: Optional[int] = None, requesting_user_id: int = None) -> Dict:
        """执行玩家动作"""
        g = self.games[game_id]
        th = g['th_game']
        player = th.current_player

        moves = th.get_available_moves()

        # 转换动作
        if action == 0:  # 弃牌
            action_type = ActionType.FOLD
            amount = None
        elif action == 1:  # 跟注/过牌
            if ActionType.CHECK in moves:
                action_type = ActionType.CHECK
            else:
                action_type = ActionType.CALL
            amount = None
        elif action in [2, 3]:  # 预设加注
            action_type = ActionType.RAISE
            amount = self._calculate_raise_amount(th, action)
        elif action == 4:  # ALL IN
            action_type = ActionType.ALL_IN
            amount = None
        elif action == 5:  # 自定义加注
            action_type = ActionType.RAISE
            if custom_amount:
                # 验证加注金额在合法范围内
                raise_range = moves.get(ActionType.RAISE)
                if raise_range:
                    min_raise = raise_range.start
                    max_raise = raise_range.stop - 1
                    amount = max(min_raise, min(custom_amount, max_raise))
                else:
                    amount = custom_amount
            else:
                amount = self._calculate_raise_amount(th, 2)  # 默认1/2底池
        else:
            return {'error': 'Invalid action'}

        # 检查动作是否合法
        if action_type not in moves:
            # 尝试替代动作
            if action_type == ActionType.RAISE and ActionType.ALL_IN in moves:
                action_type = ActionType.ALL_IN
                amount = None
            elif action_type == ActionType.CALL and ActionType.CHECK in moves:
                action_type = ActionType.CHECK
                amount = None
            else:
                return {'error': f'Action {action_type} not available'}

        # 记录动作
        if action == 5 and amount:
            action_name = f'加注到{amount}'
        else:
            action_name = self.ACTION_NAMES.get(action, f'动作{action}')
        g['last_action'] = {
            'player': player,
            'action': action,
            'action_name': action_name
        }

        # 执行
        try:
            if action_type == ActionType.RAISE and amount:
                th.take_action(action_type, total=amount)
            else:
                th.take_action(action_type)
        except Exception as e:
            return {'error': f'Action failed: {str(e)}'}

        # 检查是否结束
        if not th.is_hand_running():
            self._finish_hand(game_id)
        else:
            human_positions = g.get('human_positions', [0])
            g['pending_ai_action'] = (th.current_player not in human_positions)

        return {'success': True, 'game_state': self.get_game_state(game_id, requesting_user_id)}

    def _finish_hand(self, game_id: int):
        """结束当前手牌"""
        g = self.games[game_id]
        th = g['th_game']

        db, PokerGame, PokerPlayer, *_ = get_db_models()
        players = PokerPlayer.query.filter_by(game_id=game_id).order_by(PokerPlayer.position).all()

        # 获取胜者信息
        winner_info = {
            'winner_position': -1,
            'winner_name': '',
            'pot_won': 0,
            'payoffs': [],
            'player_hands': {},
            'public_cards': [str(c) for c in th.board] if th.board else []
        }

        # 从 hand_history 获取胜者
        if th.hand_history and th.hand_history.settle:
            pot_winners = th.hand_history.settle.pot_winners
            if pot_winners:
                # pot_winners 格式: {pot_id: (amount, hand_rank, [winner_ids])}
                for pot_id, (amount, rank, winners) in pot_winners.items():
                    if winners:
                        winner_pos = winners[0]
                        winner_info['winner_position'] = winner_pos
                        winner_info['pot_won'] = amount
                        if winner_pos < len(players):
                            p = players[winner_pos]
                            winner_info['winner_name'] = p.user.username if p.user else p.ai_name
                        break

        # 获取所有玩家手牌
        for i in range(g['total_players']):
            try:
                hand = th.get_hand(i)
                winner_info['player_hands'][i] = ' '.join([str(c) for c in hand]) if hand else ''
            except:
                winner_info['player_hands'][i] = ''

        # 计算收益
        for i in range(g['total_players']):
            th_player = th.players[i]
            winner_info['payoffs'].append(th_player.chips - players[i].chips if th_player else 0)

        g['winner_info'] = winner_info
        g['is_hand_over'] = True
        g['pending_ai_action'] = False

        # 更新数据库中的筹码
        for i, p in enumerate(players):
            if i < len(th.players):
                p.chips = th.players[i].chips
                # 检查是否出局
                if p.chips <= 0:
                    p.is_active = False
                    g['is_game_over'] = True

        if g['is_game_over']:
            g['game'].status = 'finished'
            g['game'].finished_at = datetime.utcnow()

        db.session.commit()

    def new_hand(self, game_id: int, requesting_user_id: int = None) -> Dict:
        """开始新的一手牌"""
        if game_id not in self.games:
            return {'error': 'Game not found'}

        g = self.games[game_id]

        if g['is_game_over']:
            return {'error': 'Game is over'}

        th = g['th_game']
        human_positions = g.get('human_positions', [0])

        # 开始新的一手
        th.start_hand()

        g['hand_number'] += 1
        g['is_hand_over'] = False
        g['winner_info'] = None
        g['last_action'] = None
        g['pending_ai_action'] = (th.current_player not in human_positions)
        g['last_phase'] = th.hand_phase
        g['chips_at_round_start'] = [p.chips for p in th.players]

        db, *_ = get_db_models()
        g['game'].status = 'playing'
        db.session.commit()

        return {'success': True, 'game_state': self.get_game_state(game_id, requesting_user_id)}


poker_manager = PokerManager()
