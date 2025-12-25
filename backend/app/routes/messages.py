"""Message wall routes."""
from flask import Blueprint, request, session, jsonify
from sqlalchemy.orm import joinedload
from models import db, Message
from app.utils import require_auth

bp = Blueprint('messages', __name__)


@bp.route('/api/messages', methods=['GET'])
@require_auth
def get_messages():
    """Get all messages."""
    # Use joinedload to avoid N+1 queries
    messages = Message.query.options(joinedload(Message.user)).order_by(Message.created_at.desc()).all()
    return jsonify({
        'success': True,
        'messages': [{
            'id': m.id,
            'content': m.content,
            'user_id': m.user_id,
            'username': m.user.username if m.user else 'Unknown',
            'created_at': m.created_at.isoformat() if m.created_at else None
        } for m in messages]
    })


@bp.route('/api/messages', methods=['POST'])
@require_auth
def create_message():
    """Create a new message."""
    data = request.get_json()
    if not data or not data.get('content'):
        return jsonify({'success': False, 'error': '消息内容不能为空'}), 400

    content = data.get('content', '').strip()
    if len(content) > 2000:
        return jsonify({'success': False, 'error': '消息内容过长（最多2000字符）'}), 400

    message = Message(
        content=content,
        user_id=session['user_id']
    )
    db.session.add(message)
    db.session.commit()
    return jsonify({'success': True, 'id': message.id})


@bp.route('/api/messages/<int:message_id>', methods=['DELETE'])
@require_auth
def delete_message(message_id):
    """Delete a message."""
    message = Message.query.get_or_404(message_id)
    if message.user_id != session['user_id']:
        return jsonify({'success': False, 'error': 'Not authorized'}), 403

    db.session.delete(message)
    db.session.commit()
    return jsonify({'success': True})
