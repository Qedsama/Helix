"""Authentication routes."""
import jwt
from datetime import datetime, timedelta
from flask import Blueprint, request, session, jsonify, current_app
from models import db, User
from app.utils import require_auth

bp = Blueprint('auth', __name__)


def generate_token(user):
    """Generate JWT token for user."""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'exp': datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def verify_token(token):
    """Verify JWT token and return user info."""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@bp.before_app_request
def load_user_from_token():
    """Load user from Authorization header token."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        payload = verify_token(token)
        if payload:
            session['user_id'] = payload['user_id']
            session['username'] = payload['username']


@bp.route('/api/login', methods=['POST'])
def login():
    """User login."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': '无效请求'}), 400

    username = data.get('username')
    if not username:
        return jsonify({'success': False, 'message': '用户名不能为空'}), 400

    user = User.query.filter_by(username=username).first()
    if user:
        token = generate_token(user)
        session['user_id'] = user.id
        session['username'] = user.username
        return jsonify({
            'success': True,
            'message': '登录成功',
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username,
                'avatar': user.avatar
            }
        })
    return jsonify({'success': False, 'message': '用户不存在'}), 401


@bp.route('/api/check-auth')
def check_auth():
    """Check authentication status."""
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                'success': True,
                'authenticated': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'avatar': user.avatar
                }
            })
    return jsonify({'success': True, 'authenticated': False})


@bp.route('/api/logout')
def logout():
    """User logout."""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out'})


@bp.route('/api/users')
def get_users():
    """Get all users list."""
    users = User.query.all()
    return jsonify({
        'success': True,
        'users': [{
            'id': u.id,
            'username': u.username,
            'avatar': u.avatar
        } for u in users]
    })


@bp.route('/api/user')
@require_auth
def get_user():
    """Get current user info."""
    user = User.query.get(session['user_id'])
    return jsonify({
        'success': True,
        'user': {
            'id': session['user_id'],
            'username': user.username if user else session.get('username'),
            'avatar': user.avatar if user else ''
        }
    })


@bp.route('/api/user/profile', methods=['POST'])
@require_auth
def update_profile():
    """Update user profile."""
    data = request.get_json()
    username = data.get('username')
    avatar = data.get('avatar')

    user = User.query.get(session['user_id'])
    if username:
        user.username = username
        session['username'] = username
    if avatar is not None:
        user.avatar = avatar

    db.session.commit()
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'avatar': user.avatar
        }
    })
