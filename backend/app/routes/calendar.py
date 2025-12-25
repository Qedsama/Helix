"""Calendar event routes."""
from flask import Blueprint, request, session, jsonify
from datetime import datetime
from models import db, Event
from app.utils import require_auth

bp = Blueprint('calendar', __name__)


@bp.route('/api/events', methods=['GET'])
@require_auth
def get_events():
    """Get all events for current user."""
    user_id = session['user_id']
    events = Event.query.filter(
        db.or_(
            Event.user_id == user_id,
            Event.shared == True,
            Event.invited_user == user_id
        )
    ).order_by(Event.start_time).all()

    return jsonify({
        'success': True,
        'events': [{
            'id': e.id,
            'title': e.title,
            'description': e.description,
            'event_date': e.start_time.strftime('%Y-%m-%d') if e.start_time else None,
            'start_time': e.start_time.isoformat() if e.start_time else None,
            'end_time': e.end_time.isoformat() if e.end_time else None,
            'shared': e.shared,
            'user_id': e.user_id,
            'created_at': e.created_at.isoformat() if e.created_at else None
        } for e in events]
    })


@bp.route('/api/events', methods=['POST'])
@require_auth
def create_event():
    """Create a new event."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '无效请求'}), 400

    title = data.get('title', '').strip() if data.get('title') else ''
    if not title or len(title) > 200:
        return jsonify({'success': False, 'error': '标题无效（1-200字符）'}), 400

    # 支持两种格式：event_date (YYYY-MM-DD) 或 start_time/end_time (YYYY-MM-DD HH:mm:ss)
    try:
        if data.get('start_time'):
            start_time = datetime.strptime(data.get('start_time'), '%Y-%m-%d %H:%M:%S')
            end_time = datetime.strptime(data.get('end_time'), '%Y-%m-%d %H:%M:%S') if data.get('end_time') else start_time
        elif data.get('event_date'):
            start_time = datetime.strptime(data.get('event_date'), '%Y-%m-%d')
            end_time = start_time
        else:
            return jsonify({'success': False, 'error': '请提供日期时间'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': '日期格式无效'}), 400

    event = Event(
        title=title,
        description=data.get('description'),
        start_time=start_time,
        end_time=end_time,
        event_type=data.get('event_type', 'other'),
        shared=data.get('shared', False),
        user_id=session['user_id']
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({'success': True, 'id': event.id})


@bp.route('/api/events/<int:event_id>', methods=['PUT'])
@require_auth
def update_event(event_id):
    """Update an event."""
    event = Event.query.get_or_404(event_id)
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '无效请求'}), 400

    if 'title' in data:
        title = data.get('title', '').strip()
        if not title or len(title) > 200:
            return jsonify({'success': False, 'error': '标题无效（1-200字符）'}), 400
        event.title = title

    event.description = data.get('description', event.description)

    if data.get('event_date'):
        try:
            event_date = datetime.strptime(data.get('event_date'), '%Y-%m-%d')
            event.start_time = event_date
            event.end_time = event_date
        except ValueError:
            return jsonify({'success': False, 'error': '日期格式无效，应为 YYYY-MM-DD'}), 400

    event.event_type = data.get('event_type', event.event_type)
    event.shared = data.get('shared', event.shared)

    db.session.commit()
    return jsonify({'success': True})


@bp.route('/api/events/<int:event_id>', methods=['DELETE'])
@require_auth
def delete_event(event_id):
    """Delete an event."""
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({'success': True})
