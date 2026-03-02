"""Learning quiz routes - generates backend dev quiz questions via Qwen API."""
import hashlib
import json
import re
from datetime import datetime, date, timedelta

import requests as http_requests
from flask import Blueprint, jsonify, request, current_app
from models import db, LearningQuestion, LearningAnswer
from app.utils import require_auth

bp = Blueprint('learning', __name__)

DAILY_LIMIT = 50

SYSTEM_PROMPT = """你是一个后端开发技术出题专家。请根据要求生成高质量的后端开发选择题。

要求：
1. 每道题必须包含4个选项(A/B/C/D)，只有一个正确答案
2. 题目涵盖以下分类: databases(数据库), api_design(API设计), security(安全), performance(性能优化), architecture(架构设计), networking(网络), devops(运维部署), concurrency(并发编程), caching(缓存), testing(测试)
3. 难度分布: 约30%简单(easy), 50%中等(medium), 20%困难(hard)
4. 所有内容使用中文
5. 解释要简洁明了，说明为什么正确答案是对的

请严格按照以下JSON格式返回，不要包含任何其他文字：
[
  {
    "question": "题目文本",
    "option_a": "选项A",
    "option_b": "选项B",
    "option_c": "选项C",
    "option_d": "选项D",
    "correct_answer": "A",
    "explanation": "解释说明",
    "category": "databases",
    "difficulty": "medium"
  }
]"""


def _build_user_prompt(count, existing_questions):
    """Build the user prompt with dedup context."""
    prompt = f"请生成{count}道后端开发技术选择题。"
    if existing_questions:
        prompt += "\n\n以下题目已经出过，请避免重复或过于相似的题目：\n"
        for q in existing_questions[-50:]:
            prompt += f"- {q}\n"
    return prompt


def _parse_questions_json(text):
    """Parse Claude response, stripping markdown fences if present."""
    text = text.strip()
    # Strip markdown code fences
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if match:
        text = match.group(1).strip()
    return json.loads(text)


@bp.route('/api/learning/generate', methods=['POST'])
@require_auth
def generate_questions(user_id):
    """Generate a batch of quiz questions via Claude API."""
    api_key = current_app.config.get('DASHSCOPE_API_KEY')
    if not api_key:
        return jsonify({'success': False, 'error': '请先配置通义千问API Key (DASHSCOPE_API_KEY)'}), 500

    today = date.today()

    # Check daily limit
    today_count = LearningQuestion.query.filter(
        LearningQuestion.batch_date == today
    ).count()
    if today_count >= DAILY_LIMIT:
        return jsonify({
            'success': False,
            'error': f'今日已达到{DAILY_LIMIT}题上限',
            'today_count': today_count
        }), 400

    remaining = DAILY_LIMIT - today_count
    batch_size = min(10, remaining)

    # Get recent questions for dedup context
    recent_questions = [q.question_text for q in
                        LearningQuestion.query.order_by(
                            LearningQuestion.id.desc()
                        ).limit(50).all()]

    # Call Qwen API
    try:
        url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        model = current_app.config.get('QWEN_MODEL', 'qwen-plus')
        data = {
            'model': model,
            'input': {
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': _build_user_prompt(batch_size, recent_questions)}
                ]
            },
            'parameters': {
                'result_format': 'message',
                'temperature': 0.7,
                'max_tokens': 4096
            }
        }
        resp = http_requests.post(url, headers=headers, json=data, timeout=60)
        result = resp.json()

        if 'output' not in result or 'choices' not in result['output']:
            error_msg = result.get('message', '未知错误')
            return jsonify({'success': False, 'error': f'AI服务调用失败: {error_msg}'}), 500

        raw_text = result['output']['choices'][0]['message']['content']
        questions_data = _parse_questions_json(raw_text)
    except json.JSONDecodeError:
        return jsonify({'success': False, 'error': '解析AI返回数据失败'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI服务调用失败: {str(e)}'}), 500

    # Save questions, dedup by hash
    saved = []
    for i, q in enumerate(questions_data):
        q_hash = hashlib.sha256(q['question'].encode('utf-8')).hexdigest()

        # Skip if duplicate
        if LearningQuestion.query.filter_by(question_hash=q_hash).first():
            continue

        question = LearningQuestion(
            question_text=q['question'],
            option_a=q['option_a'],
            option_b=q['option_b'],
            option_c=q['option_c'],
            option_d=q['option_d'],
            correct_answer=q['correct_answer'].upper(),
            explanation=q.get('explanation', ''),
            category=q.get('category', 'general'),
            difficulty=q.get('difficulty', 'medium'),
            batch_date=today,
            batch_index=today_count + i + 1,
            question_hash=q_hash,
        )
        db.session.add(question)
        saved.append(question)

    db.session.commit()

    return jsonify({
        'success': True,
        'generated': len(saved),
        'today_count': today_count + len(saved),
        'daily_limit': DAILY_LIMIT,
        'questions': [{
            'id': q.id,
            'question_text': q.question_text,
            'option_a': q.option_a,
            'option_b': q.option_b,
            'option_c': q.option_c,
            'option_d': q.option_d,
            'category': q.category,
            'difficulty': q.difficulty,
        } for q in saved]
    })


@bp.route('/api/learning/questions')
@require_auth
def get_questions(user_id):
    """Get questions for a given date with user's answer status."""
    date_str = request.args.get('date')
    if date_str:
        try:
            query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'error': '日期格式无效'}), 400
    else:
        query_date = date.today()

    questions = LearningQuestion.query.filter(
        LearningQuestion.batch_date == query_date
    ).order_by(LearningQuestion.batch_index).all()

    # Get user's answers for these questions
    question_ids = [q.id for q in questions]
    answers = {a.question_id: a for a in
               LearningAnswer.query.filter(
                   LearningAnswer.user_id == user_id,
                   LearningAnswer.question_id.in_(question_ids)
               ).all()} if question_ids else {}

    result = []
    for q in questions:
        item = {
            'id': q.id,
            'question_text': q.question_text,
            'option_a': q.option_a,
            'option_b': q.option_b,
            'option_c': q.option_c,
            'option_d': q.option_d,
            'category': q.category,
            'difficulty': q.difficulty,
        }
        answer = answers.get(q.id)
        if answer:
            # Already answered - reveal correct answer and explanation
            item['answered'] = True
            item['selected_answer'] = answer.selected_answer
            item['is_correct'] = answer.is_correct
            item['correct_answer'] = q.correct_answer
            item['explanation'] = q.explanation
        else:
            item['answered'] = False

        result.append(item)

    return jsonify({
        'success': True,
        'date': query_date.isoformat(),
        'questions': result,
        'total': len(result),
        'answered': len(answers),
        'daily_limit': DAILY_LIMIT,
    })


@bp.route('/api/learning/answer', methods=['POST'])
@require_auth
def submit_answer(user_id):
    """Submit an answer for a question."""
    data = request.get_json()
    question_id = data.get('question_id')
    selected = data.get('selected_answer', '').upper()
    time_spent = data.get('time_spent')

    if not question_id or selected not in ('A', 'B', 'C', 'D'):
        return jsonify({'success': False, 'error': '参数无效'}), 400

    question = LearningQuestion.query.get(question_id)
    if not question:
        return jsonify({'success': False, 'error': '题目不存在'}), 404

    # Check if already answered
    existing = LearningAnswer.query.filter_by(
        user_id=user_id, question_id=question_id
    ).first()
    if existing:
        return jsonify({
            'success': False,
            'error': '已经回答过此题',
            'correct_answer': question.correct_answer,
            'explanation': question.explanation,
        }), 400

    is_correct = selected == question.correct_answer

    answer = LearningAnswer(
        user_id=user_id,
        question_id=question_id,
        selected_answer=selected,
        is_correct=is_correct,
        time_spent=time_spent,
    )
    db.session.add(answer)
    db.session.commit()

    return jsonify({
        'success': True,
        'is_correct': is_correct,
        'correct_answer': question.correct_answer,
        'explanation': question.explanation,
    })


@bp.route('/api/learning/stats')
@require_auth
def get_stats(user_id):
    """Get learning statistics for the current user."""
    # Overall stats
    total_answered = LearningAnswer.query.filter_by(user_id=user_id).count()
    total_correct = LearningAnswer.query.filter_by(user_id=user_id, is_correct=True).count()
    accuracy = round(total_correct / total_answered * 100, 1) if total_answered > 0 else 0

    # Today's progress
    today = date.today()
    today_total = LearningQuestion.query.filter_by(batch_date=today).count()
    today_answered = LearningAnswer.query.join(LearningQuestion).filter(
        LearningAnswer.user_id == user_id,
        LearningQuestion.batch_date == today
    ).count()
    today_correct = LearningAnswer.query.join(LearningQuestion).filter(
        LearningAnswer.user_id == user_id,
        LearningQuestion.batch_date == today,
        LearningAnswer.is_correct == True
    ).count()

    # Streak calculation (consecutive days with at least 1 answer)
    streak = 0
    check_date = today
    while True:
        day_count = LearningAnswer.query.join(LearningQuestion).filter(
            LearningAnswer.user_id == user_id,
            LearningQuestion.batch_date == check_date
        ).count()
        if day_count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # Category breakdown
    category_stats = db.session.query(
        LearningQuestion.category,
        db.func.count(LearningAnswer.id).label('total'),
        db.func.sum(db.case((LearningAnswer.is_correct == True, 1), else_=0)).label('correct')
    ).join(LearningAnswer).filter(
        LearningAnswer.user_id == user_id
    ).group_by(LearningQuestion.category).all()

    categories = [{
        'category': cat,
        'total': total,
        'correct': correct,
        'accuracy': round(correct / total * 100, 1) if total > 0 else 0
    } for cat, total, correct in category_stats]

    # 7-day trend
    trend = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_answered = LearningAnswer.query.join(LearningQuestion).filter(
            LearningAnswer.user_id == user_id,
            LearningQuestion.batch_date == d
        ).count()
        day_correct = LearningAnswer.query.join(LearningQuestion).filter(
            LearningAnswer.user_id == user_id,
            LearningQuestion.batch_date == d,
            LearningAnswer.is_correct == True
        ).count()
        trend.append({
            'date': d.isoformat(),
            'answered': day_answered,
            'correct': day_correct,
            'accuracy': round(day_correct / day_answered * 100, 1) if day_answered > 0 else 0
        })

    return jsonify({
        'success': True,
        'total_answered': total_answered,
        'total_correct': total_correct,
        'accuracy': accuracy,
        'streak': streak,
        'today': {
            'total': today_total,
            'answered': today_answered,
            'correct': today_correct,
        },
        'categories': categories,
        'trend': trend,
    })
