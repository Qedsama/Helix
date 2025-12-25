"""Flask application configuration."""
import os
from datetime import timedelta


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///helix.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session cookie settings for cross-origin requests
    SESSION_COOKIE_SAMESITE = 'None'
    SESSION_COOKIE_SECURE = False  # Set True if using HTTPS
    SESSION_COOKIE_HTTPONLY = True

    # File uploads
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

    # Static files cache
    SEND_FILE_MAX_AGE_DEFAULT = timedelta(days=1)

    # CORS origins
    CORS_ORIGINS = [
        'http://localhost:1420',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://47.115.224.89:5173',
        'http://47.115.224.89:5174',
        'tauri://localhost',
        'https://tauri.localhost'
    ]


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
