"""Quiz taking/submission, quiz bank & category admin CRUD, journey stations admin."""
import time
import random
import threading
from flask import Blueprint, request, jsonify, session

from utils import admin_required
from services.chat_engine import kb, gemini_client
from services.analytics import (
    get_connection, get_quiz_questions_count, get_random_quiz_questions,
    save_quiz_question, get_quiz_leaderboard, save_quiz_attempt,
    get_all_quiz_attempts, get_quiz_attempt_by_id, get_all_quiz_categories,
    save_quiz_category, update_quiz_category, delete_quiz_category,
    get_all_quiz_questions, delete_quiz_question_by_id, update_quiz_question_by_id,
    get_student_progress_db, save_student_progress_db,
)

quiz_bp = Blueprint('quiz', __name__)

@quiz_bp.route('/api/quiz/start', methods=['POST'])
def quiz_start():
    """Start a quiz: return 5 questions from bank + generate 2 new ones in background to grow the bank."""
    try:
        data = request.get_json() or {}
        student_id = data.get('student_id', '').strip()
        student_name = data.get('student_name', '').strip()

        if not student_id or not student_name:
            return jsonify({"error": "يرجى إدخال الرقم الجامعي والاسم"}), 400

        if len(student_id) != 10 or not student_id.isdigit():
            return jsonify({"error": "يرجى إدخال رقم جامعي صحيح مكون من 10 أرقام بالضبط"}), 400

        # Store student info in session
        session['quiz_student_id'] = student_id
        session['quiz_student_name'] = student_name

        category_id = data.get('category_id')
        if category_id and category_id != 'all':
            try:
                category_id = int(category_id)
            except Exception:
                category_id = None
        else:
            category_id = None

        bank_count = get_quiz_questions_count(category_id=category_id)
        final_questions = []

        if bank_count >= 5:
            # Pull 5 random from bank for the student filtered by category
            db_questions = get_random_quiz_questions(5, category_id=category_id)
            for q in db_questions:
                final_questions.append({
                    "id": q["id"],
                    "question": q["question"],
                    "options": [q["option_a"], q["option_b"], q["option_c"], q["option_d"]],
                    "correct_option": q["correct_option"],
                    "explanation": q.get("explanation", ""),
                    "category_name": q.get("category_name", ""),
                    "source": "bank"
                })
            session['quiz_answers'] = {str(q['id']): q['correct_option'] for q in db_questions}
            session['quiz_explanations'] = {str(q['id']): q.get('explanation', '') for q in db_questions}
        else:
            # Bank too small for this category — fallback to general bank or AI
            answers_map = {}
            explanations_map = {}

            if bank_count > 0:
                db_questions = get_random_quiz_questions(bank_count, category_id=category_id)
                for q in db_questions:
                    final_questions.append({
                        "id": q["id"],
                        "question": q["question"],
                        "options": [q["option_a"], q["option_b"], q["option_c"], q["option_d"]],
                        "correct_option": q["correct_option"],
                        "explanation": q.get("explanation", ""),
                        "category_name": q.get("category_name", ""),
                        "source": "bank"
                    })
                answers_map = {str(q['id']): q['correct_option'] for q in db_questions}
                explanations_map = {str(q['id']): q.get('explanation', '') for q in db_questions}

            # Fill remaining with general bank
            to_fill = 5 - len(final_questions)
            if to_fill > 0:
                gen_questions = get_random_quiz_questions(to_fill)
                for q in gen_questions:
                    if str(q['id']) not in answers_map:
                        final_questions.append({
                            "id": q["id"],
                            "question": q["question"],
                            "options": [q["option_a"], q["option_b"], q["option_c"], q["option_d"]],
                            "correct_option": q["correct_option"],
                            "explanation": q.get("explanation", ""),
                            "category_name": q.get("category_name", ""),
                            "source": "bank"
                        })
                        answers_map[str(q['id'])] = q['correct_option']
                        explanations_map[str(q['id'])] = q.get('explanation', '')

            to_generate = 5 - len(final_questions)
            generated = _generate_quiz_questions_via_gemini(to_generate)
            for gq in generated:
                final_questions.append({
                    "id": gq["temp_id"],
                    "question": gq["question"],
                    "options": gq["options"],
                    "correct_option": gq["correct_option"],
                    "explanation": gq.get("explanation", ""),
                    "source": "ai"
                })
                answers_map[str(gq["temp_id"])] = gq["correct_option"]
                explanations_map[str(gq["temp_id"])] = gq.get("explanation", "")

            session['quiz_answers'] = answers_map
            session['quiz_explanations'] = explanations_map

        # Store full structured questions in session for detailed answer logging
        session['quiz_questions_data'] = {str(q['id']): q for q in final_questions}
        session['quiz_category_id'] = category_id

        # Always generate 2 new questions in background to grow the bank
        import threading
        def grow_bank():
            try:
                _generate_quiz_questions_via_gemini(2)
                new_count = get_quiz_questions_count()
                print(f"[Quiz] Bank grown: now {new_count} questions total")
            except Exception as ex:
                print(f"[Quiz] Background generation error: {ex}")

        thread = threading.Thread(target=grow_bank, daemon=True)
        thread.start()

        # Shuffle questions order
        random.shuffle(final_questions)

        return jsonify({"questions": final_questions, "time_per_question": 20})

    except Exception as e:
        print(f"[Quiz] Error starting quiz: {e}")
        return jsonify({"error": "حدث خطأ أثناء تحميل الأسئلة"}), 500
def _generate_quiz_questions_via_gemini(count):
    """Generate quiz questions using Gemini API from regulations data."""
    generated = []
    try:
        # Pick random articles from regulations
        all_articles = kb.get_all_articles()
        if not all_articles:
            return []

        selected_articles = random.sample(all_articles, min(count, len(all_articles)))

        for i, article in enumerate(selected_articles):
            prompt = f"""أنت مُعد اختبارات أكاديمية متخصص ودقيق جداً. بناءً على النص التالي من لوائح جامعة حفر الباطن، أنشئ سؤال اختيار من متعدد واحد فقط.

النص المرجعي:
المادة: {article.get('article_number', '')}
العنوان: {article.get('title', '')}
المحتوى: {article.get('content', '')[:800]}

المطلوب والشروط:
1. أنشئ سؤالاً واضحاً بـ 4 خيارات (أ، ب، ج، د).
2. يجب أن تكون الإجابة الصحيحة مستخرجة بـ 100% دقة ووضوح من النص المرجعي أعلاه فقط.
3. الخيارات الثلاثة الخاطئة يجب أن تكون منطقية ولكنها غير صحيحة بناءً على النص.
4. حدد حرف الإجابة الصحيحة بالضبط (a أو b أو c أو d).
5. اذكر شرحاً مفصلاً يقتبس النص ويمهد للإجابة الصحيحة.

الإجابة يجب أن تكون بصيغة JSON فقط بالشكل التالي:
{{
  "question": "نص السؤال",
  "option_a": "الخيار أ",
  "option_b": "الخيار ب",
  "option_c": "الخيار ج",
  "option_d": "الخيار د",
  "correct_option": "a",
  "explanation": "شرح مفصل وموثق من نص المادة للإجابة الصحيحة"
}}"""

            result, raw = gemini_client.ask_gemini_json(prompt)
            if result and isinstance(result, dict):
                temp_id = f"gen_{int(time.time())}_{i}"
                correct = result.get('correct_option', 'a').lower().strip()
                if correct not in ('a', 'b', 'c', 'd'):
                    correct = 'a'

                q_data = {
                    "temp_id": temp_id,
                    "question": result.get('question', ''),
                    "options": [
                        result.get('option_a', ''),
                        result.get('option_b', ''),
                        result.get('option_c', ''),
                        result.get('option_d', '')
                    ],
                    "correct_option": correct,
                    "explanation": result.get('explanation', ''),
                }
                generated.append(q_data)

                # Save to database for future use
                save_quiz_question(
                    question=result.get('question', ''),
                    option_a=result.get('option_a', ''),
                    option_b=result.get('option_b', ''),
                    option_c=result.get('option_c', ''),
                    option_d=result.get('option_d', ''),
                    correct_option=correct,
                    explanation=result.get('explanation', ''),
                    article_ref=article.get('article_number', ''),
                    document_name=article.get('document_name', '')
                )

    except Exception as e:
        print(f"[Quiz] Error generating questions: {e}")

    return generated


@quiz_bp.route('/api/quiz/submit', methods=['POST'])
def quiz_submit():
    """Submit quiz answers, evaluate correctness, store detailed answers and link to student account progress."""
    try:
        data = request.get_json() or {}
        answers = data.get('answers', {})  # {question_id: selected_option}
        time_taken = int(data.get('time_taken', 0) or 0)

        correct_map = session.get('quiz_answers', {})
        explanations_map = session.get('quiz_explanations', {})
        questions_data = session.get('quiz_questions_data', {})

        # Fallback to payload student_id / student_name if session is missing
        student_id = str(data.get('student_id') or session.get('quiz_student_id') or '').strip()
        student_name = str(data.get('student_name') or session.get('quiz_student_name') or '').strip()
        category_name = str(data.get('category_name') or '')

        if not correct_map and not answers:
            return jsonify({"error": "لم يتم العثور على بيانات الكويز"}), 400

        correct_count = 0
        results = []
        letter_idx_map = {'a': 0, 'b': 1, 'c': 2, 'd': 3}

        # Iterate over all questions in the test
        all_qids = list(questions_data.keys()) if questions_data else list(answers.keys())
        for qid_str in all_qids:
            q_info = questions_data.get(qid_str, {})
            q_text = q_info.get('question', f'سؤال {qid_str}')
            options = q_info.get('options', [])
            q_category = q_info.get('category_name', category_name)

            selected = str(answers.get(qid_str, '')).lower().strip()
            correct = str(q_info.get('correct_option') or correct_map.get(qid_str, '')).lower().strip()

            is_correct = (selected != '' and selected == correct)
            if is_correct:
                correct_count += 1

            selected_idx = letter_idx_map.get(selected)
            selected_text = options[selected_idx] if (selected_idx is not None and len(options) > selected_idx) else ("لم يتم الإجابة" if not selected else selected)

            correct_idx = letter_idx_map.get(correct)
            correct_text = options[correct_idx] if (correct_idx is not None and len(options) > correct_idx) else correct

            explanation = q_info.get('explanation') or explanations_map.get(qid_str, '')

            results.append({
                "question_id": qid_str,
                "question": q_text,
                "options": options,
                "selected_option": selected,
                "selected_text": selected_text,
                "correct_option": correct,
                "correct_text": correct_text,
                "is_correct": is_correct,
                "explanation": explanation,
                "category_name": q_category
            })

        total = len(results) if results else len(answers)
        wrong_count = max(0, total - correct_count)
        score_percent = round((correct_count / total) * 100) if total > 0 else 0

        # Save complete attempt to database
        attempt_id = save_quiz_attempt(
            student_id=student_id,
            student_name=student_name,
            total_questions=total,
            correct_answers=correct_count,
            wrong_answers=wrong_count,
            score_percent=score_percent,
            time_taken_seconds=time_taken,
            category_name=category_name or (results[0].get('category_name') if results else ''),
            answers_detail=results
        )

        # ─── Link to Student Unified Progress & Points in Database ───
        new_total_points = 0
        quiz_points_earned = round((correct_count / total) * 100) if total > 0 else 0
        total_attempts = 1
        is_first_attempt = True
        first_attempt_time = time_taken
        first_attempt_score = score_percent

        if student_id and student_id != 'guest_student':
            existing_prog = get_student_progress_db(student_id) or {}
            prev_explore = float(existing_prog.get('explore_points', 0) or 0)
            prev_campus = float(existing_prog.get('campus_points', 0) or 0)
            prev_quiz = float(existing_prog.get('quiz_points', 0) or 0)

            quiz_data = existing_prog.get('quiz_data', {}) or {}
            total_attempts = int(quiz_data.get('total_attempts', 0)) + 1
            is_first_attempt = (total_attempts == 1)

            # Only the FIRST attempt counts for ranking
            if is_first_attempt:
                new_quiz_points = float(quiz_points_earned)
                quiz_data['first_score_percent'] = score_percent
                quiz_data['first_correct'] = correct_count
                quiz_data['first_wrong'] = wrong_count
                quiz_data['first_time_seconds'] = time_taken
                quiz_data['time_taken_seconds'] = time_taken
            else:
                # Keep first attempt's score and time for ranking
                new_quiz_points = prev_quiz
                first_attempt_time = int(quiz_data.get('first_time_seconds', 0) or 0)
                first_attempt_score = float(quiz_data.get('first_score_percent', 0) or 0)

            new_total_points = prev_explore + new_quiz_points + prev_campus

            quiz_data['last_attempt_id'] = attempt_id
            quiz_data['last_score_percent'] = score_percent
            quiz_data['last_correct'] = correct_count
            quiz_data['last_wrong'] = wrong_count
            quiz_data['last_time_seconds'] = time_taken
            quiz_data['total_attempts'] = total_attempts
            quiz_data['max_score_percent'] = max(float(quiz_data.get('max_score_percent', 0)), float(score_percent))

            save_student_progress_db(
                student_id=student_id,
                student_name=student_name or existing_prog.get('student_name', f"طالب {student_id}"),
                explore_points=prev_explore,
                quiz_points=new_quiz_points,
                campus_points=prev_campus,
                total_points=new_total_points,
                explored_docs=existing_prog.get('explored_docs', {}),
                quiz_data=quiz_data,
                campus_data=existing_prog.get('campus_data', {})
            )
            print(f"[Quiz] 🎓 Student progress linked for {student_name} ({student_id}): Score {score_percent}%, Attempt #{total_attempts}, Points {new_total_points}")

        # Get leaderboard
        leaderboard = get_quiz_leaderboard(3)

        return jsonify({
            "success": True,
            "attempt_id": attempt_id,
            "student_id": student_id,
            "student_name": student_name,
            "correct_count": correct_count,
            "wrong_count": wrong_count,
            "total": total,
            "score_percent": score_percent,
            "points_earned": quiz_points_earned,
            "total_points": new_total_points,
            "results": results,
            "leaderboard": leaderboard,
            "total_attempts": total_attempts,
            "is_first_attempt": is_first_attempt,
            "first_attempt_time": first_attempt_time,
            "first_attempt_score": first_attempt_score
        })

    except Exception as e:
        print(f"[Quiz] Error submitting quiz: {e}")
        return jsonify({"error": "حدث خطأ أثناء حساب النتيجة"}), 500
@quiz_bp.route('/api/quiz/leaderboard')
def quiz_leaderboard():
    """Get quiz leaderboard."""
    leaderboard = get_quiz_leaderboard(3)
    return jsonify({"leaderboard": leaderboard})


@quiz_bp.route('/api/admin/quiz-attempts', methods=['GET'])
@admin_required
def admin_get_quiz_attempts():
    """Admin API to retrieve detailed quiz attempts log."""
    limit = int(request.args.get('limit', 100))
    student_id = request.args.get('student_id')
    attempts = get_all_quiz_attempts(limit=limit, student_id=student_id)
    return jsonify({
        "success": True,
        "count": len(attempts),
        "attempts": attempts
    })


@quiz_bp.route('/api/admin/quiz-attempts/<int:attempt_id>', methods=['GET'])
@admin_required
def admin_get_single_quiz_attempt(attempt_id):
    """Admin API to retrieve single quiz attempt with full question breakdown."""
    attempt = get_quiz_attempt_by_id(attempt_id)
    if not attempt:
        return jsonify({"success": False, "error": "المحاولة غير موجودة"}), 404
    return jsonify({
        "success": True,
        "attempt": attempt
    })
@quiz_bp.route('/api/categories', methods=['GET'])
def get_public_categories():
    categories = get_all_quiz_categories()
    return jsonify({"success": True, "categories": categories})
@quiz_bp.route('/api/admin/quiz-categories', methods=['GET'])
@admin_required
def admin_get_quiz_categories():
    categories = get_all_quiz_categories()
    return jsonify({"success": True, "categories": categories})

@quiz_bp.route('/api/admin/quiz-categories/add', methods=['POST'])
@admin_required
def admin_add_quiz_category():
    try:
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        icon = data.get('icon', 'fa-folder').strip()
        color = data.get('color', '#882D1B').strip()
        browse_cards = data.get('browse_cards', [])

        if not name:
            return jsonify({"success": False, "error": "اسم القسم مطلوب"}), 400

        cid = save_quiz_category(name, description, icon, color, browse_cards)
        if cid:
            return jsonify({"success": True, "message": f"تم إنشاء القسم '{name}' بنجاح!", "category_id": cid})
        else:
            return jsonify({"success": False, "error": "فشل إنشاء القسم"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@quiz_bp.route('/api/admin/quiz-categories/edit/<int:cid>', methods=['POST'])
@admin_required
def admin_edit_quiz_category(cid):
    try:
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        icon = data.get('icon', 'fa-folder').strip()
        color = data.get('color', '#882D1B').strip()
        browse_cards = data.get('browse_cards', [])

        if not name:
            return jsonify({"success": False, "error": "اسم القسم مطلوب"}), 400

        res = update_quiz_category(cid, name, description, icon, color, browse_cards)
        if res:
            return jsonify({"success": True, "message": "تم تحديث بيانات القسم وبطاقات التصفح بنجاح!"})
        else:
            return jsonify({"success": False, "error": "فشل تحديث القسم"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@quiz_bp.route('/api/admin/quiz-categories/delete/<int:cid>', methods=['POST'])
@admin_required
def admin_delete_quiz_category(cid):
    try:
        # Check if category has any assigned questions
        questions = get_all_quiz_questions(category_id=cid)
        if len(questions) > 0:
            return jsonify({
                "success": False,
                "error": f"🚫 حظر الحذف: لا يمكن حذف هذا القسم لأنه يحتوي على ({len(questions)}) أسئلة مضافة! يرجى حذف جميع أسئلة هذا القسم أولاً من بنك الأسئلة أو بطاقة القسم."
            }), 400

        res = delete_quiz_category(cid, delete_questions=False)
        if res:
            return jsonify({"success": True, "message": "تم حذف القسم بنجاح!"})
        else:
            return jsonify({"success": False, "error": "فشل الحذف"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
STATION_NAMES = {
    1: 'عن الجامعة', 2: 'الأنظمة التقنية', 3: 'حقوقك وواجباتك',
    4: 'القبول والتسجيل', 5: 'شؤون الطلاب'
}
STATION_ICONS = {
    1: 'fa-university', 2: 'fa-laptop-code', 3: 'fa-scale-balanced',
    4: 'fa-user-plus', 5: 'fa-graduation-cap'
}
STATION_COLORS = {
    1: '#882D1B', 2: '#2563eb', 3: '#059669',
    4: '#d97706', 5: '#7c3aed'
}

@quiz_bp.route('/api/admin/journey/stations', methods=['GET'])
@admin_required
def admin_get_journey_stations():
    """Return 5 journey stations with their questions grouped + point distribution."""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT id, question, option_a, option_b, option_c, option_d,
                   correct_option, explanation, article_ref, document_name,
                   slide_number, station_number, is_journey, category_id, category_name
            FROM quiz_questions
            WHERE is_journey = 1 AND station_number IS NOT NULL
            ORDER BY station_number ASC, slide_number ASC
        """).fetchall()
        conn.close()

        stations = {}
        for i in range(1, 6):
            stations[i] = {
                'station_number': i,
                'name': STATION_NAMES.get(i, f'المحطة {i}'),
                'icon': STATION_ICONS.get(i, 'fa-circle'),
                'color': STATION_COLORS.get(i, '#882D1B'),
                'points_total': 4,
                'questions': [],
                'proof_slots': []
            }

        # Station 2 has fixed proof upload slots (slides 10, 11)
        stations[2]['proof_slots'] = [
            {'slide': 10, 'label': 'إثبات تفعيل البريد الإلكتروني', 'protected': True},
            {'slide': 11, 'label': 'إثبات تفعيل البلاك بورد', 'protected': True}
        ]

        for r in rows:
            sn = r['station_number']
            if sn in stations:
                q = dict(r)
                q['options_count'] = sum(1 for opt in [q['option_a'], q['option_b'], q['option_c'], q['option_d']] if opt and opt.strip())
                stations[sn]['questions'].append(q)

        # Calculate points per question
        for sn, st in stations.items():
            num_q = len(st['questions'])
            st['questions_count'] = num_q
            st['points_per_question'] = round(4 / num_q, 2) if num_q > 0 else 0

        return jsonify({
            'success': True,
            'stations': list(stations.values()),
            'station_names': STATION_NAMES,
            'total_quiz_points': 20
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
@quiz_bp.route('/api/admin/quiz-questions', methods=['GET'])
@admin_required
def admin_get_quiz_questions():
    category_id = request.args.get('category_id', type=int)
    questions = get_all_quiz_questions(category_id=category_id)
    return jsonify({"success": True, "questions": questions})


@quiz_bp.route('/api/admin/quiz-questions/add', methods=['POST'])
@admin_required
def admin_add_quiz_question():
    try:
        data = request.get_json() or {}
        question = data.get('question', '').strip()
        q_type = data.get('question_type', 'mc')  # 'mc' or 'tf'
        category_id = data.get('category_id')
        category_name = data.get('category_name', '').strip()
        station_number = data.get('station_number')  # 1-5 for journey questions
        
        if not question:
            return jsonify({"success": False, "error": "نص السؤال مطلوب"}), 400

        if q_type == 'tf':
            option_a = "صح (صحيحة)"
            option_b = "خطأ (خاطئة)"
            option_c = ""
            option_d = ""
            correct_option = data.get('correct_option', 'a')
        else:
            option_a = data.get('option_a', '').strip()
            option_b = data.get('option_b', '').strip()
            option_c = data.get('option_c', '').strip()
            option_d = data.get('option_d', '').strip()
            correct_option = data.get('correct_option', 'a')
            if not option_a or not option_b:
                return jsonify({"success": False, "error": "الخياران أ وب مطلوبان على الأقل"}), 400

        # Build images_json from images array
        images_data = data.get('images', [])
        import json as _json
        images_json_str = _json.dumps(images_data, ensure_ascii=False) if images_data else '[]'

        save_quiz_question(
            question=question,
            option_a=option_a,
            option_b=option_b,
            option_c=option_c,
            option_d=option_d,
            correct_option=correct_option,
            explanation=data.get('explanation', '').strip(),
            article_ref=data.get('article_ref', '').strip(),
            document_name=data.get('document_name', 'عام'),
            image_url=data.get('image_url', '').strip(),
            category_id=category_id,
            category_name=category_name,
            images_json=images_json_str
        )

        # If station_number provided, mark as journey question
        if station_number and int(station_number) in range(1, 6):
            sn = int(station_number)
            conn = get_connection()
            # Get the new question ID (last inserted)
            new_q = conn.execute("SELECT id FROM quiz_questions ORDER BY id DESC LIMIT 1").fetchone()
            if new_q:
                # Auto-assign next slide_number for this station
                existing_slides = conn.execute(
                    "SELECT slide_number FROM quiz_questions WHERE station_number = ? AND is_journey = 1 ORDER BY slide_number ASC",
                    (sn,)
                ).fetchall()
                # Station slide ranges: 1:[4-9], 2:[10-14], 3:[15-20], 4:[21-26], 5:[27-32]
                base_slides = {1: 4, 2: 12, 3: 15, 4: 21, 5: 27}
                used_slides = set(r['slide_number'] for r in existing_slides if r['slide_number'])
                base = base_slides.get(sn, sn * 6)
                new_slide = base
                while new_slide in used_slides:
                    new_slide += 1

                conn.execute(
                    "UPDATE quiz_questions SET station_number = ?, slide_number = ?, is_journey = 1 WHERE id = ?",
                    (sn, new_slide, new_q['id'])
                )
                conn.commit()
            conn.close()

        return jsonify({"success": True, "message": "تم إضافة السؤال بنجاح!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@quiz_bp.route('/api/admin/quiz-questions/edit/<int:qid>', methods=['POST'])
@admin_required
def admin_edit_quiz_question(qid):
    try:
        data = request.get_json() or {}
        
        # Handle station-only move operation
        if 'station_number' in data and 'question' not in data:
            sn = int(data['station_number'])
            if sn in range(1, 6):
                conn = get_connection()
                # Auto-assign slide_number for new station
                existing_slides = conn.execute(
                    "SELECT slide_number FROM quiz_questions WHERE station_number = ? AND is_journey = 1",
                    (sn,)
                ).fetchall()
                base_slides = {1: 4, 2: 12, 3: 15, 4: 21, 5: 27}
                used_slides = set(r['slide_number'] for r in existing_slides if r['slide_number'])
                new_slide = base_slides.get(sn, sn * 6)
                while new_slide in used_slides:
                    new_slide += 1
                conn.execute(
                    "UPDATE quiz_questions SET station_number = ?, slide_number = ?, is_journey = 1 WHERE id = ?",
                    (sn, new_slide, qid)
                )
                conn.commit()
                conn.close()
            return jsonify({"success": True, "message": f"تم نقل السؤال إلى المحطة {sn} بنجاح!"})

        question = data.get('question', '').strip()
        q_type = data.get('question_type', 'mc')
        
        if not question:
            return jsonify({"success": False, "error": "نص السؤال مطلوب"}), 400

        if q_type == 'tf':
            option_a = "صح (صحيحة)"
            option_b = "خطأ (خاطئة)"
            option_c = ""
            option_d = ""
            correct_option = data.get('correct_option', 'a')
        else:
            option_a = data.get('option_a', '').strip()
            option_b = data.get('option_b', '').strip()
            option_c = data.get('option_c', '').strip()
            option_d = data.get('option_d', '').strip()
            correct_option = data.get('correct_option', 'a')

        payload = {
            "question": question,
            "option_a": option_a,
            "option_b": option_b,
            "option_c": option_c,
            "option_d": option_d,
            "correct_option": correct_option,
            "explanation": data.get('explanation', '').strip(),
            "article_ref": data.get('article_ref', '').strip(),
            "document_name": data.get('document_name', 'عام'),
            "image_url": data.get('image_url', '').strip(),
            "category_id": data.get('category_id'),
            "category_name": data.get('category_name', '').strip(),
            "images": data.get('images', [])
        }
        res = update_quiz_question_by_id(qid, payload)

        # Update station if provided
        station_number = data.get('station_number')
        if station_number and int(station_number) in range(1, 6):
            sn = int(station_number)
            conn = get_connection()
            existing_slides = conn.execute(
                "SELECT slide_number FROM quiz_questions WHERE station_number = ? AND is_journey = 1 AND id != ?",
                (sn, qid)
            ).fetchall()
            base_slides = {1: 4, 2: 12, 3: 15, 4: 21, 5: 27}
            used_slides = set(r['slide_number'] for r in existing_slides if r['slide_number'])
            new_slide = base_slides.get(sn, sn * 6)
            while new_slide in used_slides:
                new_slide += 1
            conn.execute(
                "UPDATE quiz_questions SET station_number = ?, slide_number = ?, is_journey = 1 WHERE id = ?",
                (sn, new_slide, qid)
            )
            conn.commit()
            conn.close()

        if res:
            return jsonify({"success": True, "message": "تم تحديث السؤال بنجاح!"})
        else:
            return jsonify({"success": False, "error": "فشل التحديث"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@quiz_bp.route('/api/admin/quiz-questions/delete/<int:qid>', methods=['POST'])
@admin_required
def admin_delete_quiz_question(qid):
    try:
        res = delete_quiz_question_by_id(qid)
        if res:
            return jsonify({"success": True, "message": "تم حذف السؤال بنجاح!"})
        else:
            return jsonify({"success": False, "error": "فشل الحذف"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
