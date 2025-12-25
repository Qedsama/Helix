"""Route blueprints initialization."""
from . import auth
from . import assets
from . import photos
from . import messages
from . import calendar
from . import chat
from . import poker
from . import dashboard

# All blueprints to register
all_blueprints = [
    auth.bp,
    assets.bp,
    photos.bp,
    messages.bp,
    calendar.bp,
    chat.bp,
    poker.bp,
    dashboard.bp,
]
