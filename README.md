# Helix

A private space application for couples, featuring financial tracking, photo/message walls, calendar, real-time chat, and Texas Hold'em poker.

## Features

- **Dashboard** - Overview of shared activities and quick access to all features
- **Asset Management** - Track finances with category breakdown and trend charts
- **Photo & Message Wall** - Share photos and messages in a timeline view
- **Calendar** - Personal and shared event scheduling with recurring events support
- **Real-time Chat** - Instant messaging with image sharing
- **Texas Hold'em Poker** - 8-player poker game with AI opponents (powered by RLCard)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + Ant Design |
| Desktop | Tauri v2 (Rust) |
| Backend | Flask + SQLAlchemy + SQLite |
| State | Zustand |
| Poker Engine | RLCard (No-Limit Hold'em) |

## Project Structure

```
Helix/
├── backend/                  # Flask API server
│   ├── app.py               # Main Flask app with all routes
│   ├── models.py            # SQLAlchemy models
│   ├── poker_manager.py     # Texas Hold'em game logic
│   ├── templates/           # Jinja2 templates (legacy)
│   └── static/uploads/      # User uploaded files
├── frontend/                 # React + Tauri desktop app
│   ├── src/
│   │   ├── pages/           # Route components
│   │   ├── components/      # Shared UI components
│   │   ├── services/api.ts  # Axios API client
│   │   └── stores/          # Zustand state management
│   └── src-tauri/           # Tauri Rust config
└── deploy_and_run.sh        # Build & deploy script
```

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- Rust (for Tauri desktop builds)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python run.py
```

The API server runs at `http://localhost:5000`

### Frontend Development

```bash
cd frontend
npm install
npm run dev          # Web development server
npm run tauri:dev    # Desktop app with hot reload
```

### Production Build

**Web + Flask (single server):**
```bash
./deploy_and_run.sh
```

**Desktop app:**
```bash
cd frontend
npm run tauri:build
```

Note: Tauri builds are platform-specific. Build on macOS for `.dmg`, Windows for `.exe`, Linux for `.deb/.AppImage`.

### Production Deployment (Backend)

```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app
```

## API Configuration

Frontend API base URL can be configured via environment variable:

```bash
VITE_API_BASE_URL=https://your-server.com npm run build
```

## Database

SQLite database at `backend/instance/helix.db`. Auto-initializes on first run.

**Backup:**
```bash
cp backend/instance/helix.db backup/
cp -r backend/static/uploads/ backup/
```

## License

MIT
