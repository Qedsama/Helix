"""Validation utilities and constants."""
from flask import current_app

# Asset categories
ASSET_CATEGORIES = [
    '现金',
    '活期储蓄',
    '定期储蓄',
    '基金',
    '股票',
    '黄金现货'
]

# Chart colors for asset categories
CATEGORY_COLORS = {
    '现金': '#ff6b6b',
    '活期储蓄': '#4ecdc4',
    '定期储蓄': '#45b7d1',
    '基金': '#f4a261',
    '股票': '#e9c46a',
    '黄金现货': '#a8dadc'
}


def get_category_colors():
    """Get asset category color configuration."""
    return CATEGORY_COLORS


def validate_category(category):
    """Validate if asset category is valid."""
    return category in ASSET_CATEGORIES


def get_asset_categories():
    """Get all asset categories."""
    return ASSET_CATEGORIES.copy()


def allowed_file(filename):
    """Check if the file extension is allowed."""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg', 'gif'})
