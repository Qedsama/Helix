"""Flask application factory."""
import os
import logging
from flask import Flask, render_template, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import config
from .extensions import db, cors
from .routes import all_blueprints

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
                template_folder='../templates')

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

    # SPA catch-all route
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        if path.startswith('api/') or path.startswith('static/') or path.startswith('poker/'):
            return jsonify({'error': 'Not found'}), 404
        return render_template('index.html')

    # Initialize database
    with app.app_context():
        init_db(app)

    logger.info(f'Helix app created with {config_name} configuration')
    return app


def init_db(app):
    """Initialize the database with default data."""
    from models import User

    db.create_all()

    # Create initial users if not exist
    if User.query.count() == 0:
        user1 = User(username='一二')
        user2 = User(username='布布')
        db.session.add(user1)
        db.session.add(user2)
        db.session.commit()
        logger.info('Database initialized with default users')
