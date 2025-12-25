#!/usr/bin/env python3
"""WSGI entry point for Helix application (production)."""

import os
import sys

# Get the directory containing this file
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)
os.chdir(PROJECT_ROOT)

from app import create_app

# Ensure upload directories exist
upload_dir = os.path.join('static', 'uploads')
chat_images_dir = os.path.join(upload_dir, 'chat_images')
os.makedirs(upload_dir, exist_ok=True)
os.makedirs(chat_images_dir, exist_ok=True)

# Create app for WSGI server
app = create_app('production')

if __name__ == "__main__":
    app.run()
