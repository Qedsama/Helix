"""Dashboard routes."""
from datetime import datetime, timedelta
from flask import Blueprint, jsonify
from models import db, Asset, Event, Photo, Message
from app.utils import require_auth

bp = Blueprint('dashboard', __name__)


@bp.route('/api/dashboard')
@require_auth
def get_dashboard():
    """Get dashboard overview data."""
    # Calculate total assets
    total_assets = db.session.query(db.func.sum(Asset.amount)).scalar() or 0

    # Get today's events
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    today_events = Event.query.filter(
        Event.start_time >= datetime.combine(today, datetime.min.time()),
        Event.start_time < datetime.combine(tomorrow, datetime.min.time())
    ).order_by(Event.start_time).all()

    # Get recent photos (last 6)
    recent_photos = Photo.query.order_by(Photo.created_at.desc()).limit(6).all()

    # Get recent messages (last 5)
    recent_messages = Message.query.order_by(Message.created_at.desc()).limit(5).all()

    return jsonify({
        'success': True,
        'data': {
            'total_assets': total_assets,
            'today_events': [{
                'id': e.id,
                'title': e.title,
                'start_time': e.start_time.isoformat()
            } for e in today_events],
            'recent_photos': [{
                'id': p.id,
                'filename': p.filename
            } for p in recent_photos],
            'recent_messages': [{
                'id': m.id,
                'content': m.content,
                'created_at': m.created_at.isoformat()
            } for m in recent_messages]
        }
    })
