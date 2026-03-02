"""Travel planning routes - 旅行计划相关路由"""
from flask import Blueprint, request, jsonify, current_app
import requests
import json
import os
from datetime import datetime
from werkzeug.utils import secure_filename
from models import db, TravelPlan, TravelItinerary
from app.utils.decorators import require_auth

bp = Blueprint('travel', __name__, url_prefix='/api/travel')


def get_amap_key():
    """获取高德地图API Key"""
    return current_app.config.get('AMAP_API_KEY', '')


def serialize_itinerary(item):
    """序列化行程项目为字典"""
    photos = []
    if item.photos:
        try:
            photos = json.loads(item.photos)
        except:
            pass

    return {
        'id': item.id,
        'day_number': item.day_number,
        'order_index': item.order_index,
        'title': item.title,
        'description': item.description,
        'location_name': item.location_name,
        'location_address': item.location_address,
        'latitude': item.latitude,
        'longitude': item.longitude,
        'poi_id': item.poi_id,
        'start_time': item.start_time.strftime('%H:%M') if item.start_time else None,
        'end_time': item.end_time.strftime('%H:%M') if item.end_time else None,
        'duration_minutes': item.duration_minutes,
        'category': item.category,
        'cost': item.cost,
        'notes': item.notes,
        # 用户体验记录字段
        'review': item.review,
        'rating': item.rating,
        'actual_cost': item.actual_cost,
        'photos': photos,
        'visited': item.visited,
        'visited_at': item.visited_at.isoformat() if item.visited_at else None,
        # 通勤信息
        'transport_mode': item.transport_mode,
        'transport_duration': item.transport_duration,
        'transport_distance': item.transport_distance,
        'transport_cost': item.transport_cost,
        'transport_info': json.loads(item.transport_info) if item.transport_info else None,
        # 交通类型专用字段（起终点）
        'from_location_name': item.from_location_name,
        'from_location_address': item.from_location_address,
        'from_latitude': item.from_latitude,
        'from_longitude': item.from_longitude,
        'departure_datetime': item.departure_datetime.isoformat() if item.departure_datetime else None,
        'arrival_datetime': item.arrival_datetime.isoformat() if item.arrival_datetime else None,
        # 酒店跨天字段
        'check_in_day': item.check_in_day,
        'check_out_day': item.check_out_day,
    }


def calculate_route_to_item(item):
    """计算到达某个行程项目的路线信息（同时获取驾车和公交）"""
    if not item.latitude or not item.longitude:
        return

    # 找到同一天的前一个行程
    prev_item = TravelItinerary.query.filter(
        TravelItinerary.plan_id == item.plan_id,
        TravelItinerary.day_number == item.day_number,
        TravelItinerary.order_index < item.order_index
    ).order_by(TravelItinerary.order_index.desc()).first()

    if not prev_item or not prev_item.latitude or not prev_item.longitude:
        return

    amap_key = get_amap_key()
    if not amap_key:
        return

    try:
        origin = f"{prev_item.longitude},{prev_item.latitude}"
        destination = f"{item.longitude},{item.latitude}"

        route_info = {}

        # 计算驾车路线
        driving_url = f"https://restapi.amap.com/v3/direction/driving?key={amap_key}&origin={origin}&destination={destination}&strategy=0&extensions=all"
        driving_resp = requests.get(driving_url, timeout=10)
        driving_data = driving_resp.json()

        if driving_data.get('status') == '1' and driving_data.get('route', {}).get('paths'):
            path = driving_data['route']['paths'][0]
            route_info['driving'] = {
                'duration': int(path.get('duration', 0)),
                'distance': int(path.get('distance', 0)),
                'tolls': float(path.get('tolls', 0)),
                'taxi_cost': float(driving_data['route'].get('taxi_cost', 0)),
                'polyline': path.get('polyline', '')  # 路线坐标点
            }

        # 计算公交/地铁路线
        transit_url = f"https://restapi.amap.com/v3/direction/transit/integrated?key={amap_key}&origin={origin}&destination={destination}&city=全国&extensions=all"
        transit_resp = requests.get(transit_url, timeout=10)
        transit_data = transit_resp.json()

        if transit_data.get('status') == '1' and transit_data.get('route', {}).get('transits'):
            transits = transit_data['route']['transits']
            # 取最优的前3条路线
            transit_routes = []
            for t in transits[:3]:
                segments = []
                for seg in t.get('segments', []):
                    if seg.get('bus', {}).get('buslines'):
                        busline = seg['bus']['buslines'][0]
                        segments.append({
                            'type': 'bus',
                            'name': busline.get('name', ''),
                            'departure_stop': busline.get('departure_stop', {}).get('name', ''),
                            'arrival_stop': busline.get('arrival_stop', {}).get('name', ''),
                            'via_num': busline.get('via_num', 0),
                            'polyline': busline.get('polyline', '')
                        })
                    elif seg.get('railway'):
                        railway = seg['railway']
                        segments.append({
                            'type': 'railway',
                            'name': railway.get('name', ''),
                            'departure_stop': railway.get('departure_stop', {}).get('name', ''),
                            'arrival_stop': railway.get('arrival_stop', {}).get('name', ''),
                        })
                    if seg.get('walking', {}).get('distance'):
                        walk_dist = int(seg['walking'].get('distance', 0))
                        if walk_dist > 50:  # 超过50米的步行才记录
                            segments.append({
                                'type': 'walk',
                                'distance': walk_dist,
                                'duration': int(seg['walking'].get('duration', 0))
                            })

                transit_routes.append({
                    'duration': int(t.get('duration', 0)),
                    'distance': int(t.get('distance', 0)),
                    'walking_distance': int(t.get('walking_distance', 0)),
                    'cost': float(t.get('cost', 0)),
                    'segments': segments
                })

            route_info['transit'] = transit_routes

        # 默认使用驾车信息
        if route_info.get('driving'):
            item.transport_mode = 'driving'
            item.transport_duration = route_info['driving']['duration'] // 60  # 转为分钟
            item.transport_distance = route_info['driving']['distance']
            item.transport_cost = route_info['driving'].get('taxi_cost', 0)

        item.transport_info = json.dumps(route_info)

    except Exception as e:
        print(f"Route calculation error: {e}")


# ==================== 旅行计划 CRUD ====================

@bp.route('/plans', methods=['GET'])
@require_auth
def get_plans(user_id):
    """获取所有旅行计划"""
    plans = TravelPlan.query.filter(
        (TravelPlan.user_id == user_id) | (TravelPlan.shared == True)
    ).order_by(TravelPlan.created_at.desc()).all()
    
    result = []
    for plan in plans:
        # 统计各类型行程数量
        hotel_count = sum(1 for i in plan.itineraries if i.category == 'hotel')
        transport_count = sum(1 for i in plan.itineraries if i.category == 'transport')
        result.append({
            'id': plan.id,
            'user_id': plan.user_id,
            'title': plan.title,
            'description': plan.description,
            'destination': plan.destination,
            'start_date': plan.start_date.isoformat() if plan.start_date else None,
            'end_date': plan.end_date.isoformat() if plan.end_date else None,
            'cover_image': plan.cover_image,
            'budget': plan.budget,
            'status': plan.status,
            'shared': plan.shared,
            'created_at': plan.created_at.isoformat() if plan.created_at else None,
            'days_count': (plan.end_date - plan.start_date).days + 1 if plan.start_date and plan.end_date else 0,
            'itinerary_count': len(plan.itineraries),
            'hotel_count': hotel_count,
            'transport_count': transport_count
        })
    
    return jsonify({'success': True, 'plans': result})


@bp.route('/plans', methods=['POST'])
@require_auth
def create_plan(user_id):
    """创建旅行计划"""
    data = request.get_json()
    
    if not data.get('title') or not data.get('start_date') or not data.get('end_date'):
        return jsonify({'success': False, 'error': '标题和日期为必填项'}), 400
    
    try:
        plan = TravelPlan(
            user_id=user_id,
            title=data['title'],
            description=data.get('description', ''),
            destination=data.get('destination', ''),
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date(),
            cover_image=data.get('cover_image', ''),
            budget=data.get('budget', 0),
            status=data.get('status', 'planning'),
            shared=data.get('shared', False)
        )
        db.session.add(plan)
        db.session.commit()
        
        return jsonify({'success': True, 'id': plan.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/plans/<int:plan_id>', methods=['GET'])
@require_auth
def get_plan(user_id, plan_id):
    """获取单个旅行计划详情"""
    plan = TravelPlan.query.get(plan_id)
    if not plan:
        return jsonify({'success': False, 'error': '计划不存在'}), 404
    
    if plan.user_id != user_id and not plan.shared:
        return jsonify({'success': False, 'error': '无权访问'}), 403
    
    # 获取行程列表，按天和顺序排序
    itineraries = TravelItinerary.query.filter_by(plan_id=plan_id)\
        .order_by(TravelItinerary.day_number, TravelItinerary.order_index).all()

    # 按天分组
    itinerary_by_day = {}
    hotel_items = []  # 收集跨天酒店

    for item in itineraries:
        day = item.day_number
        serialized = serialize_itinerary(item)

        # 酒店有check_in_day/check_out_day时，只放入check_in_day那天，其他天注入
        if item.category == 'hotel' and item.check_in_day and item.check_out_day:
            hotel_items.append(serialized)
            # 放入入住日
            if day not in itinerary_by_day:
                itinerary_by_day[day] = []
            itinerary_by_day[day].append(serialized)
        else:
            if day not in itinerary_by_day:
                itinerary_by_day[day] = []
            itinerary_by_day[day].append(serialized)

    # 注入酒店到每个住宿日（check_in_day 到 check_out_day - 1）
    for hotel in hotel_items:
        check_in = hotel['check_in_day']
        check_out = hotel['check_out_day']
        for inject_day in range(check_in, check_out):
            if inject_day == check_in:
                continue  # 已经在入住日了
            if inject_day not in itinerary_by_day:
                itinerary_by_day[inject_day] = []
            injected = dict(hotel)
            injected['is_hotel_injection'] = True
            injected['injected_day'] = inject_day
            itinerary_by_day[inject_day].append(injected)

    result = {
        'id': plan.id,
        'user_id': plan.user_id,
        'title': plan.title,
        'description': plan.description,
        'destination': plan.destination,
        'start_date': plan.start_date.isoformat() if plan.start_date else None,
        'end_date': plan.end_date.isoformat() if plan.end_date else None,
        'cover_image': plan.cover_image,
        'budget': plan.budget,
        'status': plan.status,
        'shared': plan.shared,
        'created_at': plan.created_at.isoformat() if plan.created_at else None,
        'days_count': (plan.end_date - plan.start_date).days + 1 if plan.start_date and plan.end_date else 0,
        'itinerary_by_day': itinerary_by_day,
    }

    return jsonify({'success': True, 'plan': result})


@bp.route('/plans/<int:plan_id>', methods=['PUT'])
@require_auth
def update_plan(user_id, plan_id):
    """更新旅行计划"""
    plan = TravelPlan.query.get(plan_id)
    if not plan:
        return jsonify({'success': False, 'error': '计划不存在'}), 404
    
    if plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权修改'}), 403
    
    data = request.get_json()
    
    try:
        if 'title' in data:
            plan.title = data['title']
        if 'description' in data:
            plan.description = data['description']
        if 'destination' in data:
            plan.destination = data['destination']
        if 'start_date' in data:
            plan.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            plan.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if 'cover_image' in data:
            plan.cover_image = data['cover_image']
        if 'budget' in data:
            plan.budget = data['budget']
        if 'status' in data:
            plan.status = data['status']
        if 'shared' in data:
            plan.shared = data['shared']
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/plans/<int:plan_id>', methods=['DELETE'])
@require_auth
def delete_plan(user_id, plan_id):
    """删除旅行计划"""
    plan = TravelPlan.query.get(plan_id)
    if not plan:
        return jsonify({'success': False, 'error': '计划不存在'}), 404
    
    if plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权删除'}), 403
    
    try:
        db.session.delete(plan)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== 行程项目 CRUD ====================

@bp.route('/plans/<int:plan_id>/itineraries', methods=['POST'])
@require_auth
def add_itinerary(user_id, plan_id):
    """添加行程项目"""
    plan = TravelPlan.query.get(plan_id)
    if not plan or plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权操作'}), 403
    
    data = request.get_json()
    
    if not data.get('title') or not data.get('day_number'):
        return jsonify({'success': False, 'error': '标题和天数为必填项'}), 400
    
    try:
        # 获取当天最大order_index
        max_order = db.session.query(db.func.max(TravelItinerary.order_index))\
            .filter_by(plan_id=plan_id, day_number=data['day_number']).scalar() or 0

        itinerary = TravelItinerary(
            plan_id=plan_id,
            day_number=data['day_number'],
            order_index=data.get('order_index', max_order + 1),
            title=data['title'],
            description=data.get('description', ''),
            location_name=data.get('location_name', ''),
            location_address=data.get('location_address', ''),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            poi_id=data.get('poi_id', ''),
            start_time=datetime.strptime(data['start_time'], '%H:%M').time() if data.get('start_time') else None,
            end_time=datetime.strptime(data['end_time'], '%H:%M').time() if data.get('end_time') else None,
            duration_minutes=data.get('duration_minutes'),
            category=data.get('category', 'attraction'),
            cost=data.get('cost', 0),
            notes=data.get('notes', ''),
            # 交通类型专用字段
            from_location_name=data.get('from_location_name', ''),
            from_location_address=data.get('from_location_address', ''),
            from_latitude=data.get('from_latitude'),
            from_longitude=data.get('from_longitude'),
            departure_datetime=datetime.fromisoformat(data['departure_datetime'].replace('Z', '+00:00')) if data.get('departure_datetime') else None,
            arrival_datetime=datetime.fromisoformat(data['arrival_datetime'].replace('Z', '+00:00')) if data.get('arrival_datetime') else None,
            # 酒店跨天字段
            check_in_day=data.get('check_in_day'),
            check_out_day=data.get('check_out_day'),
            # 路线信息（前端可直接传入）
            transport_mode=data.get('transport_mode'),
            transport_duration=data.get('transport_duration'),
            transport_distance=data.get('transport_distance'),
            transport_cost=data.get('transport_cost'),
            transport_info=json.dumps(data['transport_info']) if isinstance(data.get('transport_info'), dict) else data.get('transport_info'),
        )
        db.session.add(itinerary)
        db.session.flush()  # 获取ID

        # 只有在没有前端传入transport_mode时才自动计算路线
        if not data.get('transport_mode'):
            calculate_route_to_item(itinerary)
        
        db.session.commit()
        
        return jsonify({'success': True, 'id': itinerary.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/itineraries/<int:item_id>', methods=['PUT'])
@require_auth
def update_itinerary(user_id, item_id):
    """更新行程项目"""
    item = TravelItinerary.query.get(item_id)
    if not item:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if item.plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权修改'}), 403
    
    data = request.get_json()
    
    try:
        # 记录原始位置，用于判断是否需要重新计算路线
        old_lat = item.latitude
        old_lng = item.longitude
        old_day = item.day_number
        old_order = item.order_index
        
        if 'day_number' in data:
            item.day_number = data['day_number']
        if 'order_index' in data:
            item.order_index = data['order_index']
        if 'title' in data:
            item.title = data['title']
        if 'description' in data:
            item.description = data['description']
        if 'location_name' in data:
            item.location_name = data['location_name']
        if 'location_address' in data:
            item.location_address = data['location_address']
        if 'latitude' in data:
            item.latitude = data['latitude']
        if 'longitude' in data:
            item.longitude = data['longitude']
        if 'poi_id' in data:
            item.poi_id = data['poi_id']
        if 'start_time' in data:
            item.start_time = datetime.strptime(data['start_time'], '%H:%M').time() if data['start_time'] else None
        if 'end_time' in data:
            item.end_time = datetime.strptime(data['end_time'], '%H:%M').time() if data['end_time'] else None
        if 'duration_minutes' in data:
            item.duration_minutes = data['duration_minutes']
        if 'category' in data:
            item.category = data['category']
        if 'cost' in data:
            item.cost = data['cost']
        if 'notes' in data:
            item.notes = data['notes']
        # 交通信息（手动设置时跳过自动计算）
        if 'transport_mode' in data:
            item.transport_mode = data['transport_mode']
        if 'transport_duration' in data:
            item.transport_duration = data['transport_duration']
        if 'transport_distance' in data:
            item.transport_distance = data['transport_distance']
        if 'transport_cost' in data:
            item.transport_cost = data['transport_cost']
        if 'transport_info' in data:
            item.transport_info = json.dumps(data['transport_info']) if isinstance(data['transport_info'], dict) else data['transport_info']
        # 交通类型专用字段（起终点）
        if 'from_location_name' in data:
            item.from_location_name = data['from_location_name']
        if 'from_location_address' in data:
            item.from_location_address = data['from_location_address']
        if 'from_latitude' in data:
            item.from_latitude = data['from_latitude']
        if 'from_longitude' in data:
            item.from_longitude = data['from_longitude']
        if 'departure_datetime' in data:
            item.departure_datetime = datetime.fromisoformat(data['departure_datetime'].replace('Z', '+00:00')) if data['departure_datetime'] else None
        if 'arrival_datetime' in data:
            item.arrival_datetime = datetime.fromisoformat(data['arrival_datetime'].replace('Z', '+00:00')) if data['arrival_datetime'] else None
        # 酒店跨天字段
        if 'check_in_day' in data:
            item.check_in_day = data['check_in_day']
        if 'check_out_day' in data:
            item.check_out_day = data['check_out_day']

        # 如果位置、天数或顺序变化了，重新计算路线
        position_changed = (
            item.latitude != old_lat or 
            item.longitude != old_lng or 
            item.day_number != old_day or
            item.order_index != old_order
        )
        
        # 只有在没有手动设置transport_mode的情况下才自动计算
        if position_changed and 'transport_mode' not in data:
            calculate_route_to_item(item)
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/itineraries/<int:item_id>', methods=['DELETE'])
@require_auth
def delete_itinerary(user_id, item_id):
    """删除行程项目"""
    item = TravelItinerary.query.get(item_id)
    if not item:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if item.plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权删除'}), 403
    
    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== 高德地图API代理 ====================

@bp.route('/amap/regeo', methods=['GET'])
@require_auth
def amap_regeo(user_id):
    """逆地理编码 - 坐标转城市名"""
    amap_key = get_amap_key()
    if not amap_key:
        return jsonify({'success': False, 'error': '请配置高德地图API Key'}), 500

    location = request.args.get('location', '')  # 经度,纬度
    if not location:
        return jsonify({'success': False, 'error': '请提供坐标'}), 400

    try:
        url = 'https://restapi.amap.com/v3/geocode/regeo'
        params = {
            'key': amap_key,
            'location': location,
            'extensions': 'base',
        }

        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if data.get('status') == '1' and data.get('regeocode'):
            addr = data['regeocode'].get('addressComponent', {})
            province = addr.get('province', '') or ''
            city = addr.get('city', '') or ''
            district = addr.get('district', '') or ''
            # 直辖市（北京、上海、天津、重庆）city字段为空数组或空字符串，回退到province
            if isinstance(city, list) or not city:
                city = province
            if isinstance(province, list):
                province = ''
            if isinstance(district, list):
                district = ''
            return jsonify({
                'success': True,
                'result': {
                    'province': province,
                    'city': city,
                    'district': district,
                    'formatted_address': data['regeocode'].get('formatted_address', ''),
                }
            })
        else:
            return jsonify({'success': False, 'error': data.get('info', '逆地理编码失败')}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/amap/search', methods=['GET'])
@require_auth
def amap_search(user_id):
    """高德地图POI搜索"""
    amap_key = get_amap_key()
    if not amap_key:
        return jsonify({'success': False, 'error': '请配置高德地图API Key'}), 500
    
    keywords = request.args.get('keywords', '')
    city = request.args.get('city', '')
    types = request.args.get('types', '')  # POI类型
    
    if not keywords:
        return jsonify({'success': False, 'error': '请输入搜索关键词'}), 400
    
    try:
        url = 'https://restapi.amap.com/v3/place/text'
        params = {
            'key': amap_key,
            'keywords': keywords,
            'city': city,
            'types': types,
            'offset': 20,
            'extensions': 'all'
        }
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data.get('status') == '1':
            pois = []
            for poi in data.get('pois', []):
                location = poi.get('location', '').split(',')
                pois.append({
                    'id': poi.get('id'),
                    'name': poi.get('name'),
                    'address': poi.get('address'),
                    'type': poi.get('type'),
                    'typecode': poi.get('typecode'),
                    'longitude': float(location[0]) if len(location) == 2 else None,
                    'latitude': float(location[1]) if len(location) == 2 else None,
                    'tel': poi.get('tel'),
                    'rating': poi.get('biz_ext', {}).get('rating'),
                    'photos': [p.get('url') for p in poi.get('photos', [])[:3]]
                })
            return jsonify({'success': True, 'pois': pois})
        else:
            return jsonify({'success': False, 'error': data.get('info', '搜索失败')}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/amap/around', methods=['GET'])
@require_auth  
def amap_around(user_id):
    """高德地图周边搜索"""
    amap_key = get_amap_key()
    if not amap_key:
        return jsonify({'success': False, 'error': '请配置高德地图API Key'}), 500
    
    location = request.args.get('location', '')  # 经度,纬度
    keywords = request.args.get('keywords', '')
    types = request.args.get('types', '')
    radius = request.args.get('radius', 3000)
    
    if not location:
        return jsonify({'success': False, 'error': '请提供位置坐标'}), 400
    
    try:
        url = 'https://restapi.amap.com/v3/place/around'
        params = {
            'key': amap_key,
            'location': location,
            'keywords': keywords,
            'types': types,
            'radius': radius,
            'offset': 20,
            'extensions': 'all'
        }
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data.get('status') == '1':
            pois = []
            for poi in data.get('pois', []):
                loc = poi.get('location', '').split(',')
                pois.append({
                    'id': poi.get('id'),
                    'name': poi.get('name'),
                    'address': poi.get('address'),
                    'type': poi.get('type'),
                    'distance': poi.get('distance'),
                    'longitude': float(loc[0]) if len(loc) == 2 else None,
                    'latitude': float(loc[1]) if len(loc) == 2 else None,
                    'tel': poi.get('tel'),
                    'rating': poi.get('biz_ext', {}).get('rating')
                })
            return jsonify({'success': True, 'pois': pois})
        else:
            return jsonify({'success': False, 'error': data.get('info', '搜索失败')}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/amap/direction', methods=['GET'])
@require_auth
def amap_direction(user_id):
    """高德地图路线规划"""
    amap_key = get_amap_key()
    if not amap_key:
        return jsonify({'success': False, 'error': '请配置高德地图API Key'}), 500
    
    origin = request.args.get('origin', '')  # 起点 经度,纬度
    destination = request.args.get('destination', '')  # 终点 经度,纬度
    mode = request.args.get('mode', 'driving')  # driving/walking/transit
    
    if not origin or not destination:
        return jsonify({'success': False, 'error': '请提供起点和终点坐标'}), 400
    
    try:
        if mode == 'driving':
            url = 'https://restapi.amap.com/v3/direction/driving'
        elif mode == 'walking':
            url = 'https://restapi.amap.com/v3/direction/walking'
        else:
            url = 'https://restapi.amap.com/v3/direction/transit/integrated'
        
        params = {
            'key': amap_key,
            'origin': origin,
            'destination': destination,
            'extensions': 'all'
        }
        
        if mode == 'transit':
            params['city'] = request.args.get('city', '北京')
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data.get('status') == '1':
            route = data.get('route', {})
            result = {
                'origin': route.get('origin'),
                'destination': route.get('destination'),
                'paths': []
            }

            # 驾车模式包含taxi_cost
            if mode == 'driving':
                result['taxi_cost'] = float(route.get('taxi_cost', 0))

            paths = route.get('paths', []) or route.get('transits', [])
            for path in paths[:3]:  # 只返回前3条路线
                path_info = {
                    'distance': path.get('distance'),
                    'duration': path.get('duration'),  # 秒
                    'strategy': path.get('strategy', ''),
                    'toll': path.get('toll', 0),  # 收费
                    'walking_distance': path.get('walking_distance')
                }
                # 公交模式包含费用
                if mode == 'transit':
                    path_info['cost'] = float(path.get('cost', 0))
                result['paths'].append(path_info)

            return jsonify({'success': True, 'route': result})
        else:
            return jsonify({'success': False, 'error': data.get('info', '路线规划失败')}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/amap/geocode', methods=['GET'])
@require_auth
def amap_geocode(user_id):
    """地理编码 - 地址转坐标"""
    amap_key = get_amap_key()
    if not amap_key:
        return jsonify({'success': False, 'error': '请配置高德地图API Key'}), 500
    
    address = request.args.get('address', '')
    city = request.args.get('city', '')
    
    if not address:
        return jsonify({'success': False, 'error': '请输入地址'}), 400
    
    try:
        url = 'https://restapi.amap.com/v3/geocode/geo'
        params = {
            'key': amap_key,
            'address': address,
            'city': city
        }
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data.get('status') == '1' and data.get('geocodes'):
            geo = data['geocodes'][0]
            location = geo.get('location', '').split(',')
            return jsonify({
                'success': True,
                'result': {
                    'formatted_address': geo.get('formatted_address'),
                    'longitude': float(location[0]) if len(location) == 2 else None,
                    'latitude': float(location[1]) if len(location) == 2 else None,
                    'province': geo.get('province'),
                    'city': geo.get('city'),
                    'district': geo.get('district')
                }
            })
        else:
            return jsonify({'success': False, 'error': '地址解析失败'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== AI行程规划建议 ====================

@bp.route('/plans/<int:plan_id>/suggest', methods=['POST'])
@require_auth
def suggest_itinerary(user_id, plan_id):
    """AI行程规划建议（简化版，实际可接入AI服务）"""
    plan = TravelPlan.query.get(plan_id)
    if not plan or plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权操作'}), 403
    
    data = request.get_json()
    preferences = data.get('preferences', [])  # ['美食', '文化', '自然风光']
    pace = data.get('pace', 'moderate')  # relaxed/moderate/intensive
    
    # 这里可以接入真正的AI服务（如OpenAI、通义千问等）
    # 目前返回一个基于目的地的简单建议
    
    days_count = (plan.end_date - plan.start_date).days + 1
    
    suggestions = {
        'message': f'为您的{plan.destination or "目的地"}{days_count}天行程提供以下建议',
        'daily_tips': [],
        'recommended_pois': []
    }
    
    # 每天的建议
    for day in range(1, days_count + 1):
        if pace == 'relaxed':
            spots = 2
        elif pace == 'intensive':
            spots = 5
        else:
            spots = 3
        
        suggestions['daily_tips'].append({
            'day': day,
            'tip': f'第{day}天建议游览{spots}个景点',
            'morning': '上午安排主要景点',
            'afternoon': '下午可以逛逛周边',
            'evening': '晚上体验当地美食'
        })
    
    return jsonify({'success': True, 'suggestions': suggestions})


# ==================== 用户体验记录 ====================

@bp.route('/itineraries/<int:item_id>/review', methods=['POST'])
@require_auth
def add_review(user_id, item_id):
    """添加/更新行程项目的感受和评分"""
    item = TravelItinerary.query.get(item_id)
    if not item:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if item.plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权操作'}), 403
    
    data = request.get_json()
    
    try:
        if 'review' in data:
            item.review = data['review']
        if 'rating' in data:
            item.rating = max(1, min(5, int(data['rating'])))  # 限制1-5
        if 'actual_cost' in data:
            item.actual_cost = data['actual_cost']
        if 'visited' in data:
            item.visited = data['visited']
            if data['visited'] and not item.visited_at:
                item.visited_at = datetime.utcnow()
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/itineraries/<int:item_id>/photos', methods=['POST'])
@require_auth
def upload_itinerary_photos(user_id, item_id):
    """上传行程项目照片"""
    item = TravelItinerary.query.get(item_id)
    if not item:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if item.plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权操作'}), 403
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '请选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '请选择文件'}), 400
    
    # 检查文件类型
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if ext not in allowed_extensions:
        return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
    
    try:
        # 生成唯一文件名
        import uuid
        filename = f"travel_{item_id}_{uuid.uuid4().hex[:8]}.{ext}"
        
        # 确保目录存在
        upload_folder = os.path.join(current_app.root_path, '..', 'static', 'uploads', 'travel')
        os.makedirs(upload_folder, exist_ok=True)
        
        # 保存文件
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        # 更新数据库
        photos = []
        if item.photos:
            try:
                photos = json.loads(item.photos)
            except:
                pass
        
        photos.append(filename)
        item.photos = json.dumps(photos)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'filename': filename,
            'url': f'/static/uploads/travel/{filename}'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/itineraries/<int:item_id>/photos/<filename>', methods=['DELETE'])
@require_auth
def delete_itinerary_photo(user_id, item_id, filename):
    """删除行程项目照片"""
    item = TravelItinerary.query.get(item_id)
    if not item:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if item.plan.user_id != user_id:
        return jsonify({'success': False, 'error': '无权操作'}), 403
    
    try:
        photos = []
        if item.photos:
            try:
                photos = json.loads(item.photos)
            except:
                pass
        
        if filename in photos:
            photos.remove(filename)
            item.photos = json.dumps(photos)
            db.session.commit()
            
            # 删除文件
            filepath = os.path.join(current_app.root_path, '..', 'static', 'uploads', 'travel', filename)
            if os.path.exists(filepath):
                os.remove(filepath)
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

