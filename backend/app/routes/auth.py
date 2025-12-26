"""Authentication routes."""
import os
import uuid
import jwt
from datetime import datetime, timedelta
from flask import Blueprint, request, session, jsonify, current_app
from models import db, User
from app.utils import require_auth

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
    print(f"[DEBUG] Request: {request.method} {request.path}, Auth header: {auth_header[:50] if auth_header else 'None'}")
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        payload = verify_token(token)
        if payload:
            session['user_id'] = payload['user_id']
            session['username'] = payload['username']
            print(f"[DEBUG] Token valid for user: {payload['username']}")
        else:
            print(f"[DEBUG] Token invalid or expired")


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


@bp.route('/api/user/avatar', methods=['POST'])
@require_auth
def upload_avatar():
    """Upload user avatar image."""
    if 'avatar' not in request.files:
        return jsonify({'success': False, 'error': '没有选择图片'}), 400

    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择图片'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '不支持的图片格式'}), 400

    # Generate unique filename
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"avatar_{session['user_id']}_{uuid.uuid4().hex[:8]}.{ext}"

    # Ensure upload directory exists
    upload_dir = os.path.join(current_app.root_path, '..', 'static', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    # Save file
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    # Update user avatar in database
    user = User.query.get(session['user_id'])
    user.avatar = f'/static/uploads/{filename}'
    db.session.commit()

    return jsonify({
        'success': True,
        'avatar': user.avatar
    })
