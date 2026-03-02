"""Utility decorators for routes."""
from functools import wraps
from flask import session, jsonify
import inspect


def require_auth(f):
    """Decorator to require user authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401
        # Only pass user_id if the function accepts it
        sig = inspect.signature(f)
        if 'user_id' in sig.parameters:
            kwargs['user_id'] = session['user_id']
        return f(*args, **kwargs)
    return decorated_function
