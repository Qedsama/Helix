"""AI Travel Planning routes - AI旅行规划路由（Function Calling模式）"""
from flask import Blueprint, request, jsonify, current_app
import json
import requests
from datetime import datetime
from models import db, TravelPlan, TravelItinerary
from app.utils.decorators import require_auth

bp = Blueprint('travel_ai', __name__, url_prefix='/api/travel/ai')


# 工具定义
TRAVEL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_travel_plan",
            "description": "创建一个新的旅行计划",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "计划标题"},
                    "destination": {"type": "string", "description": "目的地"},
                    "start_date": {"type": "string", "description": "开始日期，格式YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "结束日期，格式YYYY-MM-DD"},
                    "budget": {"type": "number", "description": "预算金额"},
                    "description": {"type": "string", "description": "计划描述"}
                },
                "required": ["title", "destination", "start_date", "end_date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_travel_plans",
            "description": "列出用户的所有旅行计划",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_travel_plan",
            "description": "获取指定旅行计划的详细信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "plan_id": {"type": "integer", "description": "计划ID"}
                },
                "required": ["plan_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_itinerary",
            "description": "向旅行计划添加一个行程项目（景点、餐饮、交通、酒店）",
            "parameters": {
                "type": "object",
                "properties": {
                    "plan_id": {"type": "integer", "description": "计划ID"},
                    "day_number": {"type": "integer", "description": "第几天（对于酒店，使用check_in_day的值）"},
                    "title": {"type": "string", "description": "行程项名称（地点名/酒店名/航班车次信息等）"},
                    "category": {
                        "type": "string",
                        "enum": ["attraction", "food", "transport", "hotel"],
                        "description": "类型：景点/餐饮/交通/酒店"
                    },
                    "start_time": {"type": "string", "description": "开始时间，格式HH:MM（景点/餐饮用）"},
                    "end_time": {"type": "string", "description": "结束时间，格式HH:MM（景点/餐饮用）"},
                    "location_name": {"type": "string", "description": "地点名称"},
                    "location_address": {"type": "string", "description": "详细地址"},
                    "cost": {"type": "number", "description": "预计费用"},
                    "description": {"type": "string", "description": "描述或备注"},
                    "from_location_name": {"type": "string", "description": "出发地名称（仅transport类型）"},
                    "departure_datetime": {"type": "string", "description": "出发时间，格式YYYY-MM-DDTHH:MM:SS（仅transport类型）"},
                    "arrival_datetime": {"type": "string", "description": "到达时间，格式YYYY-MM-DDTHH:MM:SS（仅transport类型）"},
                    "check_in_day": {"type": "integer", "description": "入住日，第几天（仅hotel类型）"},
                    "check_out_day": {"type": "integer", "description": "退房日，第几天（仅hotel类型）"}
                },
                "required": ["plan_id", "day_number", "title", "category"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_itinerary",
            "description": "更新一个行程项目",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "integer", "description": "行程项ID"},
                    "title": {"type": "string", "description": "行程项名称"},
                    "category": {"type": "string", "description": "类型"},
                    "start_time": {"type": "string", "description": "开始时间"},
                    "end_time": {"type": "string", "description": "结束时间"},
                    "location_name": {"type": "string", "description": "地点名称"},
                    "location_address": {"type": "string", "description": "详细地址"},
                    "cost": {"type": "number", "description": "预计费用"},
                    "description": {"type": "string", "description": "描述"},
                    "day_number": {"type": "integer", "description": "调整到第几天"},
                    "order_index": {"type": "integer", "description": "在当天的顺序"}
                },
                "required": ["item_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_itinerary",
            "description": "删除一个行程项目",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "integer", "description": "行程项ID"}
                },
                "required": ["item_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_poi",
            "description": "搜索地点（景点、餐厅、酒店等），返回高德地图POI信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "keywords": {"type": "string", "description": "搜索关键词"},
                    "city": {"type": "string", "description": "城市名称"}
                },
                "required": ["keywords"]
            }
        }
    }
]

# 系统提示词
SYSTEM_PROMPT = """你是一个专业的旅行规划助手，可以帮助用户创建和管理旅行计划。

你可以使用以下工具来帮助用户：
1. create_travel_plan - 创建新的旅行计划
2. list_travel_plans - 查看用户的所有旅行计划
3. get_travel_plan - 获取某个计划的详细信息
4. add_itinerary - 添加行程项（景点、餐饮、交通、酒店）
5. update_itinerary - 修改行程项
6. delete_itinerary - 删除行程项
7. search_poi - 搜索地点信息

行程只有4种类型：
- attraction: 景点游览
- food: 餐饮（早餐/午餐/晚餐/小吃等）
- transport: 交通（包括飞机、高铁、火车、长途汽车、地铁等所有交通方式）。需要填写出发地(from_location_name)、出发时间(departure_datetime)、到达时间(arrival_datetime)
- hotel: 酒店入住。需要填写入住日(check_in_day)和退房日(check_out_day)，day_number设为check_in_day的值

工作流程：
1. 当用户说想去某地旅行时，先询问出行日期、预算、偏好等
2. 信息收集完后，调用 create_travel_plan 创建计划
3. 然后根据用户需求，逐步调用 add_itinerary 添加行程项
4. 每天建议安排3-5个活动，时间要合理
5. 如果需要搜索具体地点信息，使用 search_poi
6. 一次可以调用多个工具，尽量高效地完成任务

注意：
- 用简洁的语言与用户交流
- 每次添加行程后简单确认
- 交通和酒店也作为行程项添加
- transport类型涵盖所有交通方式（飞机用"东航MU5678"、高铁用"G1234"等作为title）"""


def call_qwen_api(messages, api_key, tools=None, model='qwen-plus'):
    """调用通义千问API（支持Function Calling）"""
    url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    data = {
        'model': model,
        'input': {
            'messages': messages
        },
        'parameters': {
            'result_format': 'message',
            'temperature': 0.7,
            'max_tokens': 4000
        }
    }

    if tools:
        data['parameters']['tools'] = tools

    try:
        response = requests.post(url, headers=headers, json=data, timeout=60)
        result = response.json()

        if 'output' in result and 'choices' in result['output']:
            message = result['output']['choices'][0]['message']
            return {
                'success': True,
                'message': message,
                'content': message.get('content', ''),
                'tool_calls': message.get('tool_calls', [])
            }
        else:
            error_msg = result.get('message', '未知错误')
            return {'success': False, 'error': error_msg}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def execute_tool(tool_name, arguments, user_id):
    """执行工具调用"""
    try:
        if tool_name == 'create_travel_plan':
            plan = TravelPlan(
                user_id=user_id,
                title=arguments.get('title', '我的旅行计划'),
                description=arguments.get('description', ''),
                destination=arguments.get('destination', ''),
                start_date=datetime.strptime(arguments['start_date'], '%Y-%m-%d').date(),
                end_date=datetime.strptime(arguments['end_date'], '%Y-%m-%d').date(),
                budget=arguments.get('budget', 0),
                status='planning',
                shared=False
            )
            db.session.add(plan)
            db.session.commit()
            return {
                'success': True,
                'plan_id': plan.id,
                'message': f'已创建旅行计划「{plan.title}」，计划ID: {plan.id}'
            }

        elif tool_name == 'list_travel_plans':
            plans = TravelPlan.query.filter(
                (TravelPlan.user_id == user_id) | (TravelPlan.shared == True)
            ).order_by(TravelPlan.created_at.desc()).all()
            result = []
            for p in plans:
                result.append({
                    'id': p.id,
                    'title': p.title,
                    'destination': p.destination,
                    'start_date': p.start_date.isoformat() if p.start_date else None,
                    'end_date': p.end_date.isoformat() if p.end_date else None,
                    'status': p.status
                })
            return {'success': True, 'plans': result}

        elif tool_name == 'get_travel_plan':
            plan_id = arguments['plan_id']
            plan = TravelPlan.query.get(plan_id)
            if not plan:
                return {'success': False, 'error': '计划不存在'}
            if plan.user_id != user_id and not plan.shared:
                return {'success': False, 'error': '无权访问'}

            itineraries = TravelItinerary.query.filter_by(plan_id=plan_id)\
                .order_by(TravelItinerary.day_number, TravelItinerary.order_index).all()

            itinerary_by_day = {}
            for item in itineraries:
                day = item.day_number
                if day not in itinerary_by_day:
                    itinerary_by_day[day] = []
                itinerary_by_day[day].append({
                    'id': item.id,
                    'title': item.title,
                    'category': item.category,
                    'start_time': item.start_time.strftime('%H:%M') if item.start_time else None,
                    'end_time': item.end_time.strftime('%H:%M') if item.end_time else None,
                    'location_name': item.location_name,
                    'cost': item.cost,
                    'check_in_day': item.check_in_day,
                    'check_out_day': item.check_out_day,
                })

            return {
                'success': True,
                'plan': {
                    'id': plan.id,
                    'title': plan.title,
                    'destination': plan.destination,
                    'start_date': plan.start_date.isoformat() if plan.start_date else None,
                    'end_date': plan.end_date.isoformat() if plan.end_date else None,
                    'budget': plan.budget,
                    'days_count': (plan.end_date - plan.start_date).days + 1 if plan.start_date and plan.end_date else 0,
                    'itinerary_by_day': itinerary_by_day
                }
            }

        elif tool_name == 'add_itinerary':
            plan_id = arguments['plan_id']
            plan = TravelPlan.query.get(plan_id)
            if not plan or plan.user_id != user_id:
                return {'success': False, 'error': '无权操作此计划'}

            day_number = arguments['day_number']
            category = arguments.get('category', 'attraction')

            # 酒店：day_number用check_in_day
            check_in_day = arguments.get('check_in_day')
            check_out_day = arguments.get('check_out_day')
            if category == 'hotel' and check_in_day:
                day_number = check_in_day

            max_order = db.session.query(db.func.max(TravelItinerary.order_index))\
                .filter_by(plan_id=plan_id, day_number=day_number).scalar() or 0

            # 处理时间
            start_time = None
            end_time = None
            if arguments.get('start_time'):
                try:
                    start_time = datetime.strptime(arguments['start_time'], '%H:%M').time()
                except:
                    pass
            if arguments.get('end_time'):
                try:
                    end_time = datetime.strptime(arguments['end_time'], '%H:%M').time()
                except:
                    pass

            # 处理出发/到达时间
            departure_datetime = None
            arrival_datetime = None
            if arguments.get('departure_datetime'):
                try:
                    departure_datetime = datetime.fromisoformat(arguments['departure_datetime'].replace('Z', ''))
                except:
                    pass
            if arguments.get('arrival_datetime'):
                try:
                    arrival_datetime = datetime.fromisoformat(arguments['arrival_datetime'].replace('Z', ''))
                except:
                    pass

            itinerary = TravelItinerary(
                plan_id=plan_id,
                day_number=day_number,
                order_index=max_order + 1,
                title=arguments['title'],
                description=arguments.get('description', ''),
                location_name=arguments.get('location_name', ''),
                location_address=arguments.get('location_address', ''),
                start_time=start_time,
                end_time=end_time,
                category=category,
                cost=arguments.get('cost', 0),
                from_location_name=arguments.get('from_location_name', ''),
                departure_datetime=departure_datetime,
                arrival_datetime=arrival_datetime,
                check_in_day=check_in_day,
                check_out_day=check_out_day,
            )
            db.session.add(itinerary)
            db.session.commit()

            return {
                'success': True,
                'item_id': itinerary.id,
                'message': f'已添加第{day_number}天行程：{itinerary.title}'
            }

        elif tool_name == 'update_itinerary':
            item_id = arguments['item_id']
            item = TravelItinerary.query.get(item_id)
            if not item:
                return {'success': False, 'error': '行程项不存在'}
            if item.plan.user_id != user_id:
                return {'success': False, 'error': '无权修改'}

            for key in ['title', 'category', 'location_name', 'location_address', 'cost', 'description', 'day_number', 'order_index']:
                if key in arguments:
                    setattr(item, key, arguments[key])
            if 'start_time' in arguments and arguments['start_time']:
                try:
                    item.start_time = datetime.strptime(arguments['start_time'], '%H:%M').time()
                except:
                    pass
            if 'end_time' in arguments and arguments['end_time']:
                try:
                    item.end_time = datetime.strptime(arguments['end_time'], '%H:%M').time()
                except:
                    pass

            db.session.commit()
            return {'success': True, 'message': f'已更新行程：{item.title}'}

        elif tool_name == 'delete_itinerary':
            item_id = arguments['item_id']
            item = TravelItinerary.query.get(item_id)
            if not item:
                return {'success': False, 'error': '行程项不存在'}
            if item.plan.user_id != user_id:
                return {'success': False, 'error': '无权删除'}

            title = item.title
            db.session.delete(item)
            db.session.commit()
            return {'success': True, 'message': f'已删除行程：{title}'}

        elif tool_name == 'search_poi':
            amap_key = current_app.config.get('AMAP_API_KEY', '')
            if not amap_key:
                return {'success': False, 'error': '未配置高德地图API Key'}

            keywords = arguments.get('keywords', '')
            city = arguments.get('city', '')

            url = 'https://restapi.amap.com/v3/place/text'
            params = {
                'key': amap_key,
                'keywords': keywords,
                'city': city,
                'offset': 10,
                'extensions': 'all'
            }

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            if data.get('status') == '1':
                pois = []
                for poi in data.get('pois', [])[:5]:
                    location = poi.get('location', '').split(',')
                    pois.append({
                        'name': poi.get('name'),
                        'address': poi.get('address'),
                        'type': poi.get('type'),
                        'rating': poi.get('biz_ext', {}).get('rating'),
                        'longitude': float(location[0]) if len(location) == 2 else None,
                        'latitude': float(location[1]) if len(location) == 2 else None,
                    })
                return {'success': True, 'pois': pois}
            else:
                return {'success': False, 'error': '搜索失败'}

        else:
            return {'success': False, 'error': f'未知工具: {tool_name}'}

    except Exception as e:
        db.session.rollback()
        return {'success': False, 'error': str(e)}


@bp.route('/chat', methods=['POST'])
@require_auth
def chat(user_id):
    """AI对话接口（Function Calling模式 - 多轮工具调用）"""
    api_key = current_app.config.get('DASHSCOPE_API_KEY')
    if not api_key:
        return jsonify({
            'success': False,
            'error': '请先配置通义千问API Key (DASHSCOPE_API_KEY)'
        }), 500

    data = request.get_json()
    messages = data.get('messages', [])

    if not messages:
        return jsonify({'success': False, 'error': '消息不能为空'}), 400

    # 构建完整的消息列表
    full_messages = [
        {'role': 'system', 'content': SYSTEM_PROMPT}
    ] + messages

    model = current_app.config.get('QWEN_MODEL', 'qwen-plus')
    all_tool_results = []
    max_iterations = 10

    for iteration in range(max_iterations):
        # 调用AI
        result = call_qwen_api(full_messages, api_key, TRAVEL_TOOLS, model)

        if not result['success']:
            return jsonify({'success': False, 'error': result['error']}), 500

        tool_calls = result.get('tool_calls', [])

        # 没有工具调用，返回最终结果
        if not tool_calls:
            return jsonify({
                'success': True,
                'message': result.get('content', ''),
                'tool_calls': all_tool_results
            })

        # 将助手消息（包含tool_calls）追加到消息列表
        assistant_msg = result['message']
        full_messages.append(assistant_msg)

        # 执行每个工具调用
        for tool_call in tool_calls:
            func = tool_call.get('function', {})
            tool_name = func.get('name')
            arguments_str = func.get('arguments', '{}')
            tool_call_id = tool_call.get('id', '')

            try:
                arguments = json.loads(arguments_str) if isinstance(arguments_str, str) else arguments_str
            except:
                arguments = {}

            # 执行工具
            tool_result = execute_tool(tool_name, arguments, user_id)
            all_tool_results.append({
                'tool_name': tool_name,
                'arguments': arguments,
                'result': tool_result
            })

            # 将工具结果追加到消息列表
            tool_msg = {
                'role': 'tool',
                'content': json.dumps(tool_result, ensure_ascii=False),
            }
            if tool_call_id:
                tool_msg['tool_call_id'] = tool_call_id
            if tool_name:
                tool_msg['name'] = tool_name
            full_messages.append(tool_msg)

    # 超过最大迭代次数，返回当前结果
    return jsonify({
        'success': True,
        'message': result.get('content', '工具调用已完成。'),
        'tool_calls': all_tool_results
    })
