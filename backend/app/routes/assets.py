"""Asset management routes."""
from flask import Blueprint, request, session, jsonify, current_app
from datetime import datetime, timedelta
from models import db, Asset, AssetHistory, AssetCategoryHistory
from app.utils import require_auth, validate_category, get_asset_categories, get_category_colors

bp = Blueprint('assets', __name__)


def update_asset_history():
    """Update asset history records (including total and category history)."""
    # Calculate current total assets
    total_assets = db.session.query(db.func.sum(Asset.amount)).scalar() or 0
    today = datetime.now().date()

    # Update total asset history
    today_record = AssetHistory.query.filter_by(date=today).first()
    if today_record:
        today_record.total_assets = total_assets
    else:
        history = AssetHistory(date=today, total_assets=total_assets)
        db.session.add(history)

    # Update category asset history
    category_totals = db.session.query(
        Asset.category,
        db.func.sum(Asset.amount).label('total')
    ).group_by(Asset.category).all()

    for category, total in category_totals:
        today_category_record = AssetCategoryHistory.query.filter_by(
            date=today,
            category=category
        ).first()

        if today_category_record:
            today_category_record.amount = total
        else:
            category_history = AssetCategoryHistory(
                date=today,
                category=category,
                amount=total
            )
            db.session.add(category_history)

    db.session.commit()


@bp.route('/api/assets', methods=['GET'])
@require_auth
def get_assets():
    """Get all assets."""
    assets = Asset.query.all()
    return jsonify({
        'success': True,
        'assets': [{
            'id': a.id,
            'name': a.name,
            'category': a.category,
            'amount': float(a.amount),
            'user_id': a.user_id,
            'created_at': a.created_at.isoformat() if a.created_at else None,
            'updated_at': a.updated_at.isoformat() if a.updated_at else None
        } for a in assets]
    })


@bp.route('/api/assets', methods=['POST'])
@require_auth
def create_asset():
    """Create a new asset."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '无效请求'}), 400

    name = data.get('name', '').strip() if data.get('name') else ''
    category = data.get('category', '').strip() if data.get('category') else ''

    # Input validation
    if not name or len(name) > 100:
        return jsonify({'success': False, 'error': '资产名称无效（1-100字符）'}), 400

    if not validate_category(category):
        return jsonify({'success': False, 'error': '分类无效'}), 400

    try:
        amount = float(data.get('amount', 0))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': '金额必须是数字'}), 400

    asset = Asset(
        name=name,
        category=category,
        amount=amount,
        user_id=session['user_id']
    )
    db.session.add(asset)
    db.session.commit()
    update_asset_history()
    return jsonify({'success': True, 'id': asset.id})


@bp.route('/api/assets/<int:asset_id>', methods=['PUT'])
@require_auth
def update_asset(asset_id):
    """Update an asset."""
    asset = Asset.query.get_or_404(asset_id)
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '无效请求'}), 400

    if 'name' in data:
        name = data.get('name', '').strip()
        if not name or len(name) > 100:
            return jsonify({'success': False, 'error': '资产名称无效（1-100字符）'}), 400
        asset.name = name

    if 'category' in data:
        category = data.get('category', '').strip()
        if not validate_category(category):
            return jsonify({'success': False, 'error': '分类无效'}), 400
        asset.category = category

    if 'amount' in data:
        try:
            asset.amount = float(data.get('amount'))
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': '金额必须是数字'}), 400

    asset.updated_at = datetime.utcnow()
    db.session.commit()
    update_asset_history()
    return jsonify({'success': True})


@bp.route('/api/assets/<int:asset_id>', methods=['DELETE'])
@require_auth
def delete_asset(asset_id):
    """Delete an asset."""
    asset = Asset.query.get_or_404(asset_id)
    db.session.delete(asset)
    db.session.commit()
    update_asset_history()
    return jsonify({'success': True})


@bp.route('/api/assets/categories')
def get_categories():
    """Get all asset categories."""
    return jsonify({'success': True, 'categories': get_asset_categories()})


@bp.route('/api/assets/chart-data')
@require_auth
def get_chart_data():
    """Get chart data for assets."""
    # Get parameters
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    chart_type = request.args.get('type', 'total')
    pie_type = request.args.get('pie_type', 'category')

    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = datetime.now().date() - timedelta(days=90)

        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = datetime.now().date()
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    # Get all assets
    assets = Asset.query.all()

    # Pie chart data
    pie_data = {}

    if pie_type == 'category':
        asset_categories = {}
        for asset in assets:
            category = asset.category
            if category not in asset_categories:
                asset_categories[category] = 0
            asset_categories[category] += asset.amount

        pie_data = {
            'labels': list(asset_categories.keys()),
            'data': list(asset_categories.values())
        }
    elif pie_type == 'item':
        pie_data = {
            'labels': [asset.name for asset in assets],
            'data': [asset.amount for asset in assets]
        }

    # Line chart data
    if chart_type == 'category':
        category_colors = get_category_colors()
        line_data = {'labels': [], 'datasets': []}

        all_dates = db.session.query(AssetCategoryHistory.date).filter(
            AssetCategoryHistory.date >= start_date,
            AssetCategoryHistory.date <= end_date
        ).distinct().order_by(AssetCategoryHistory.date.asc()).all()

        if all_dates:
            dates = [d.date for d in all_dates]
            asset_categories_list = get_asset_categories()

            for category in asset_categories_list:
                category_records = AssetCategoryHistory.query.filter(
                    AssetCategoryHistory.category == category,
                    AssetCategoryHistory.date >= start_date,
                    AssetCategoryHistory.date <= end_date
                ).order_by(AssetCategoryHistory.date.asc()).all()

                if category_records and category in asset_categories_list:
                    category_data = []
                    for date in dates:
                        found_record = next((r for r in category_records if r.date == date), None)
                        category_data.append(found_record.amount if found_record else 0)

                    # Smart sampling
                    if len(category_data) > 20:
                        sampled_indices = []
                        total_points = len(category_data)
                        sample_interval = total_points // 20
                        for i in range(0, total_points, sample_interval):
                            if i < len(category_data):
                                sampled_indices.append(i)
                        if sampled_indices[-1] != len(category_data) - 1:
                            sampled_indices.append(len(category_data) - 1)

                        sampled_data = [category_data[i] for i in sampled_indices]
                        sampled_dates = [dates[i].strftime('%m-%d') for i in sampled_indices]
                    else:
                        sampled_data = category_data
                        sampled_dates = [d.strftime('%m-%d') for d in dates]

                    line_data['datasets'].append({
                        'label': category,
                        'data': sampled_data,
                        'borderColor': category_colors.get(category, '#999'),
                        'backgroundColor': category_colors.get(category, '#999') + '33',
                        'borderWidth': 2,
                        'fill': False,
                        'tension': 0.4,
                        'pointRadius': 3,
                        'pointHoverRadius': 5
                    })

                    if not line_data['labels'] and sampled_dates:
                        line_data['labels'] = sampled_dates
    else:
        # Total asset line chart
        history_records = AssetHistory.query.filter(
            AssetHistory.date >= start_date,
            AssetHistory.date <= end_date
        ).order_by(AssetHistory.date.asc()).all()

        if not history_records:
            line_data = {
                'labels': [],
                'datasets': [{
                    'label': '累计总资产',
                    'data': [],
                    'borderColor': '#45b7d1',
                    'backgroundColor': 'rgba(69, 183, 209, 0.1)',
                    'borderWidth': 3,
                    'fill': True,
                    'tension': 0.4
                }]
            }
        else:
            sampled_history = history_records
            daily_labels = []
            daily_totals = []

            for record in sampled_history:
                if (end_date - start_date).days <= 31:
                    date_label = record.date.strftime('%m-%d')
                elif (end_date - start_date).days <= 365:
                    date_label = record.date.strftime('%m-%d')
                else:
                    date_label = record.date.strftime('%Y-%m')

                daily_labels.append(date_label)
                daily_totals.append(record.total_assets)

            line_data = {
                'labels': daily_labels,
                'datasets': [{
                    'label': '累计总资产',
                    'data': daily_totals,
                    'borderColor': '#45b7d1',
                    'backgroundColor': 'rgba(69, 183, 209, 0.1)',
                    'borderWidth': 3,
                    'fill': True,
                    'tension': 0.4,
                    'pointBackgroundColor': '#45b7d1',
                    'pointBorderColor': '#ffffff',
                    'pointBorderWidth': 2,
                    'pointRadius': 6,
                    'pointHoverRadius': 8
                }]
            }

    return jsonify({
        'pie': pie_data,
        'line': line_data,
        'chart_type': chart_type,
        'date_range': {
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d')
        }
    })
