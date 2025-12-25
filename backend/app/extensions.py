"""Flask extensions initialization."""
from flask_cors import CORS

# Import db from models to ensure single instance
from models import db

cors = CORS()

__all__ = ['db', 'cors']
