"""Poker game routes."""
from flask import Blueprint, request, session, jsonify
from models import PokerGame, PokerConfig
from app.games import poker_manager
from app.utils import require_auth

bp = Blueprint('poker', __name__)


@bp.route('/poker/create', methods=['POST'])
@require_auth
def create_game():
    """Create a new poker game."""
    data = request.get_json() or {}

    try:
        game_id = poker_manager.create_game(
            user_id=session['user_id'],
            ai_difficulty=data.get('ai_difficulty', 'medium'),
            small_blind=data.get('small_blind', 10),
            big_blind=data.get('big_blind', 20),
            buy_in=data.get('buy_in', 1000),
            ai_player_count=data.get('ai_player_count', 6),
            second_user_id=data.get('second_user_id')
        )
        return jsonify({'success': True, 'game_id': game_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/poker/recent')
@require_auth
def recent_games():
    """Get recent poker games."""
    games = PokerGame.query.filter_by(created_by=session['user_id']).order_by(PokerGame.created_at.desc()).limit(10).all()
    return jsonify({
        'success': True,
        'games': [{
            'id': g.id,
            'status': g.status,
            'small_blind': g.small_blind,
            'big_blind': g.big_blind,
            'ai_difficulty': g.ai_difficulty,
            'created_at': g.created_at.isoformat() if g.created_at else None
        } for g in games]
    })


@bp.route('/poker/game/<int:game_id>/state')
@require_auth
def game_state(game_id):
    """Get poker game state."""
    try:
        state = poker_manager.get_game_state(game_id, requesting_user_id=session['user_id'])
        if 'error' in state:
            return jsonify({'success': False, 'error': state['error']}), 400
        return jsonify(state)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/poker/game/<int:game_id>/action', methods=['POST'])
@require_auth
def game_action(game_id):
    """Make a poker action."""
    data = request.get_json() or {}
    action = data.get('action')
    amount = data.get('amount')

    try:
        result = poker_manager.make_action(game_id, session['user_id'], action, amount)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/poker/game/<int:game_id>/ai_step', methods=['POST'])
@require_auth
def ai_step(game_id):
    """Execute a single AI action."""
    try:
        result = poker_manager.execute_single_ai_action(game_id, requesting_user_id=session['user_id'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/poker/game/<int:game_id>/new_hand', methods=['POST'])
@require_auth
def new_hand(game_id):
    """Start a new hand."""
    try:
        result = poker_manager.new_hand(game_id, requesting_user_id=session['user_id'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/poker/config', methods=['GET'])
@require_auth
def get_config():
    """Get poker configuration."""
    config = PokerConfig.query.filter_by(user_id=session['user_id']).first()
    if not config:
        return jsonify({
            'success': True,
            'config': {
                'default_ai_difficulty': 'medium',
                'default_small_blind': 10,
                'default_big_blind': 20,
                'default_buy_in': 1000,
                'ai_player_count': 6,
                'auto_ai_players': True
            }
        })

    return jsonify({
        'success': True,
        'config': {
            'default_ai_difficulty': config.default_ai_difficulty,
            'default_small_blind': config.default_small_blind,
            'default_big_blind': config.default_big_blind,
            'default_buy_in': config.default_buy_in,
            'ai_player_count': config.ai_player_count,
            'auto_ai_players': config.auto_ai_players
        }
    })
