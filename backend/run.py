#!/usr/bin/env python3
"""Helix application development entry point."""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

if __name__ == '__main__':
    # Ensure upload directories exist
    upload_dir = os.path.join('static', 'uploads')
    chat_images_dir = os.path.join(upload_dir, 'chat_images')
    os.makedirs(upload_dir, exist_ok=True)
    os.makedirs(chat_images_dir, exist_ok=True)

    # Create and run app
    app = create_app('development')

    print("Helix starting...")
    print("Access URL: http://localhost:5000")
    print("=" * 50)

    app.run(debug=True, host='0.0.0.0', port=5000)
