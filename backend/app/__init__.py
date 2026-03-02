"""Flask application factory."""
import os
import logging
from flask import Flask, send_from_directory, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import config
from .extensions import db, cors
from .routes import all_blueprints

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to frontend dist directory
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/dist'))


def create_app(config_name=None):
    """Create and configure the Flask application.

    Args:
        config_name: Configuration name ('development', 'production', 'testing')

    Returns:
        Configured Flask application instance
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__,
                static_folder='../static',
                template_folder=FRONTEND_DIST)

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    cors.init_app(app,
                  supports_credentials=True,
                  origins=app.config['CORS_ORIGINS'])

    # Enable proxy support (for Nginx)
    app.wsgi_app = ProxyFix(app.wsgi_app)

    # Register blueprints
    for blueprint in all_blueprints:
        app.register_blueprint(blueprint)

    # Serve frontend static assets from dist/assets
    @app.route('/assets/<path:filename>')
    def serve_frontend_assets(filename):
        return send_from_directory(os.path.join(FRONTEND_DIST, 'assets'), filename)

    # SPA catch-all route
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        if path.startswith('api/') or path.startswith('static/') or path.startswith('poker/'):
            return jsonify({'error': 'Not found'}), 404
        return send_from_directory(FRONTEND_DIST, 'index.html')

    # Initialize database
    with app.app_context():
        init_db(app)

    logger.info(f'Helix app created with {config_name} configuration')
    return app


def init_db(app):
    """Initialize the database with default data."""
    from models import User
    from sqlalchemy import text

    db.create_all()

    # Auto-migration: add missing columns to travel_itineraries
    with db.engine.connect() as conn:
        try:
            columns = [row[1] for row in conn.execute(text("PRAGMA table_info(travel_itineraries)"))]
            if columns:  # table exists
                if 'check_in_day' not in columns:
                    conn.execute(text("ALTER TABLE travel_itineraries ADD COLUMN check_in_day INTEGER"))
                    logger.info('Added check_in_day column to travel_itineraries')
                if 'check_out_day' not in columns:
                    conn.execute(text("ALTER TABLE travel_itineraries ADD COLUMN check_out_day INTEGER"))
                    logger.info('Added check_out_day column to travel_itineraries')
                # Migrate legacy 'flight' category to 'transport'
                conn.execute(text("UPDATE travel_itineraries SET category='transport' WHERE category='flight'"))
                conn.commit()
        except Exception as e:
            logger.warning(f'Migration check skipped: {e}')

    # Create initial users if not exist
    if User.query.count() == 0:
        user1 = User(username='一二')
        user2 = User(username='布布')
        db.session.add(user1)
        db.session.add(user2)
        db.session.commit()
        logger.info('Database initialized with default users')
