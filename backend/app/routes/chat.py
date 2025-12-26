"""Chat routes."""
import os
import uuid
from flask import Blueprint, request, session, jsonify, current_app
from sqlalchemy.orm import joinedload
from werkzeug.utils import secure_filename
from models import db, ChatMessage, ChatReaction
from app.utils import require_auth

bp = Blueprint('chat', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def serialize_reactions(reactions):
    """将消息的表情反应序列化为分组格式"""
    reaction_map = {}
    for r in reactions:
        if r.emoji not in reaction_map:
            reaction_map[r.emoji] = {
                'emoji': r.emoji,
                'count': 0,
                'users': []
            }
        reaction_map[r.emoji]['count'] += 1
        reaction_map[r.emoji]['users'].append({
            'user_id': r.user_id,
            'username': r.user.username if r.user else 'Unknown'
        })
    return list(reaction_map.values())


@bp.route('/api/chat/messages', methods=['GET'])
@require_auth
def get_messages():
    """Get chat messages with reactions."""
    messages = ChatMessage.query.options(
        joinedload(ChatMessage.sender),
        joinedload(ChatMessage.reactions).joinedload(ChatReaction.user)
    ).order_by(ChatMessage.created_at.asc()).limit(100).all()

    return jsonify({
        'success': True,
        'messages': [{
            'id': m.id,
            'content': m.content,
            'sender_id': m.sender_id,
            'message_type': m.message_type,
            'image_filename': m.image_filename,
            'username': m.sender.username if m.sender else 'Unknown',
            'created_at': m.created_at.isoformat() if m.created_at else None,
            'reactions': serialize_reactions(m.reactions)
        } for m in messages]
    })


@bp.route('/api/chat/send', methods=['POST'])
@require_auth
def send_message():
    """Send a chat message."""
    data = request.get_json()
    if not data or not data.get('content'):
        return jsonify({'success': False, 'error': '消息内容不能为空'}), 400

    content = data.get('content', '').strip()
    if len(content) > 2000:
        return jsonify({'success': False, 'error': '消息内容过长（最多2000字符）'}), 400

    current_user_id = session['user_id']
    # Get the other user as receiver (only two users: 1 and 2)
    receiver_id = 2 if current_user_id == 1 else 1

    message = ChatMessage(
        content=content,
        sender_id=current_user_id,
        receiver_id=receiver_id,
        message_type='text'
    )
    db.session.add(message)
    db.session.commit()
    return jsonify({'success': True, 'id': message.id})


@bp.route('/api/chat/reaction', methods=['POST'])
@require_auth
def add_reaction():
    """Add an emoji reaction to a message."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '无效请求'}), 400

    message_id = data.get('message_id')
    emoji = data.get('emoji', '').strip()

    if not message_id or not emoji:
        return jsonify({'success': False, 'error': '缺少必要参数'}), 400

    # 验证消息存在
    message = ChatMessage.query.get(message_id)
    if not message:
        return jsonify({'success': False, 'error': '消息不存在'}), 404

    # 检查是否已存在相同的反应
    existing = ChatReaction.query.filter_by(
        message_id=message_id,
        user_id=session['user_id'],
        emoji=emoji
    ).first()

    if existing:
        # 如果已存在，则删除（切换效果）
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'success': True, 'action': 'removed'})

    # 添加新反应
    reaction = ChatReaction(
        message_id=message_id,
        user_id=session['user_id'],
        emoji=emoji
    )
    db.session.add(reaction)
    db.session.commit()
    return jsonify({'success': True, 'action': 'added', 'id': reaction.id})


@bp.route('/api/chat/reaction/<int:message_id>/<emoji>', methods=['DELETE'])
@require_auth
def remove_reaction(message_id, emoji):
    """Remove an emoji reaction from a message."""
    reaction = ChatReaction.query.filter_by(
        message_id=message_id,
        user_id=session['user_id'],
        emoji=emoji
    ).first()

    if not reaction:
        return jsonify({'success': False, 'error': '反应不存在'}), 404

    db.session.delete(reaction)
    db.session.commit()
    return jsonify({'success': True})


@bp.route('/api/chat/upload_image', methods=['POST'])
@require_auth
def upload_image():
    """Upload an image for chat."""
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': '没有选择图片'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择图片'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '不支持的图片格式'}), 400

    # Generate unique filename
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"

    # Ensure upload directory exists
    upload_dir = os.path.join(current_app.root_path, '..', 'static', 'uploads', 'chat_images')
    os.makedirs(upload_dir, exist_ok=True)

    # Save file
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    # Create chat message with image
    current_user_id = session['user_id']
    receiver_id = 2 if current_user_id == 1 else 1

    message = ChatMessage(
        content='[图片]',
        sender_id=current_user_id,
        receiver_id=receiver_id,
        message_type='image',
        image_filename=f'/static/uploads/chat_images/{filename}'
    )
    db.session.add(message)
    db.session.commit()

    return jsonify({
        'success': True,
        'id': message.id,
        'image_url': f'/static/uploads/chat_images/{filename}'
    })
