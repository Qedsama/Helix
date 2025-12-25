"""Photo wall routes."""
import os
import logging
from flask import Blueprint, request, session, jsonify, current_app
from datetime import datetime
from werkzeug.utils import secure_filename
from models import db, Photo
from app.utils import require_auth, allowed_file

bp = Blueprint('photos', __name__)
logger = logging.getLogger(__name__)


@bp.route('/api/photos', methods=['GET'])
@require_auth
def get_photos():
    """Get all photos."""
    photos = Photo.query.order_by(Photo.created_at.desc()).all()
    return jsonify({
        'success': True,
        'photos': [{
            'id': p.id,
            'filename': p.filename,
            'caption': p.caption,
            'user_id': p.user_id,
            'created_at': p.created_at.isoformat() if p.created_at else None
        } for p in photos]
    })


@bp.route('/api/photos/upload', methods=['POST'])
@require_auth
def upload_photo():
    """Upload a photo."""
    if 'photo' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    file = request.files['photo']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename
        file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))

        photo = Photo(
            filename=filename,
            caption=request.form.get('caption', ''),
            user_id=session['user_id']
        )
        db.session.add(photo)
        db.session.commit()
        return jsonify({'success': True, 'id': photo.id})

    return jsonify({'success': False, 'error': 'Invalid file type'}), 400


@bp.route('/api/photos/<int:photo_id>', methods=['DELETE'])
@require_auth
def delete_photo(photo_id):
    """Delete a photo."""
    photo = Photo.query.get_or_404(photo_id)

    # Delete file
    try:
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], photo.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError as e:
        logger.warning(f'Failed to delete photo file: {e}')

    db.session.delete(photo)
    db.session.commit()
    return jsonify({'success': True})
