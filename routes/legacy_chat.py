"""
LEGACY / DISABLED FEATURE: the regulations-chatbot ('/ask', '/articles').

services.knowledge_base / services.gemini_client / services.prompt_builder do not
exist in this repo (only the abandoned _archive/chatbot copy did, since deleted).
kb and gemini_client are therefore always None, so both routes below throw at
runtime exactly as they did before this file existed -- behavior intentionally
left unchanged during the app.py restructuring.
"""
import re
import json
import time
from flask import Blueprint, request, jsonify, Response, stream_with_context

from utils import get_or_create_session_id
from services.analytics import log_question
from services.chat_engine import kb, gemini_client, build_selection_prompt, build_final_answer_prompt, normalize_query

legacy_chat_bp = Blueprint('legacy_chat', __name__)

@legacy_chat_bp.route('/ask', methods=['POST'])
def ask():
    start_time = time.time()
    sid = get_or_create_session_id()

    data = request.get_json() or {}
    question = data.get('question', '').strip()
    history = data.get('history', [])
    is_non_stream = (data.get('stream') is False or request.headers.get('Accept') == 'application/json')

    if not question:
        return jsonify({"error": "الرجاء إرسال سؤال."}), 400

    # ─── معالجة التحية والترحيب الفوري ───
    clean_q = question.lower()
    clean_q_no_accents = re.sub(r"[أإآ]", "ا", clean_q)
    greetings = ["السلام عليكم", "وعليكم السلام", "مرحبا", "مرحباً", "اهلا", "أهلا", "هلا", "من انت", "مين انت", "من أنت", "صباح الخير", "مساء الخير", "سلام عليكم"]
    if any(g in clean_q_no_accents for g in greetings) or clean_q_no_accents in ["سلام", "هاي", "hello", "hi"]:
        greeting_resp = "وعليكم السلام ورحمة الله وبركاته! 🌸 أهلاً بك في جامعة حفر الباطن.\n\nأنا مساعدك الأكاديمي الذكي 🤖، ويسعدني إجابتك فوراً عن أي استفسار يخص اللوائح، القبول، التأجيل، الاعتذار، أو المكافآت."
        if is_non_stream:
            return jsonify({"answer": greeting_resp, "sources": [], "action": "none"})
        def gen_greet():
            yield f"data: {json.dumps({'chunk': greeting_resp}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'sources': [], 'action': 'none', 'done': True}, ensure_ascii=False)}\n\n"
        return Response(stream_with_context(gen_greet()), mimetype='text/event-stream')

    # المرحلة الاستباقية (التقاط أسئلة الفهرس وعدد المواد)
    overview_response = kb.handle_overview_question(question)
    if overview_response:
        try:
            log_question(
                session_id=sid, question=question,
                normalized_question=question.lower(),
                answer=overview_response.get("answer", ""),
                sources=[],
                selected_document_id="overview",
                intent="overview",
                used_gemini=False, used_fallback=False,
                response_time_ms=int((time.time() - start_time) * 1000)
            )
        except Exception:
            pass
        return jsonify({
            "answer": overview_response.get("answer", ""),
            "action": overview_response.get("action", "none")
        })

    # Combine history context for a richer query for fallback
    full_query = question
    if history:
        last_turn = history[-1]
        full_query = f"{last_turn.get('user', '')} {last_turn.get('bot', '')} {question}"

    # المرحلة الأولى: اختيار المواد (الفهم الدلالي)
    article_index = kb.get_article_index()
    selection_prompt = build_selection_prompt(question, history, article_index)
    selection_result, raw_response = gemini_client.ask_gemini_json(selection_prompt)

    # ------------------ LOGGING PREP ------------------
    log_data = {
        "question": question,
        "intent": "general_query",
        "selected_document_id": None,
        "candidate_ids": [],
        "matched_article_ids": [],
        "matched_table_ids": [],
        "matched_formula_ids": [],
        "final_sources": [],
        "used_gemini": False,
        "used_fallback": False,
        "used_force_rule": False,
        "raw_gemini_response": raw_response,
        "parse_error": None
    }

    def fallback_search(q):
        log_data["used_fallback"] = True
        q_clean = q.lower().replace("أ", "ا").replace("إ", "ا")
        q_clean = re.sub(r"[؟?,،؛;:.!()\[\]{}\"']", " ", q_clean)
        query_words = [w for w in q_clean.split() if len(w) > 2]

        if not query_words:
            return kb.get_all_regulations()[:3]

        scored_articles = []
        for reg in kb.get_all_regulations():
            title = reg.get('title', '').lower().replace("أ", "ا").replace("إ", "ا")
            content = str(reg.get('content', '')).lower().replace("أ", "ا").replace("إ", "ا")
            tags = " ".join(reg.get('tags', [])).lower().replace("أ", "ا").replace("إ", "ا")

            score = 0
            if "اختبار" in q_clean and ("يوم" in q_clean or "نفس" in q_clean):
                if str(reg.get("article_number", "")) == "36":
                    score += 20

            for word in query_words:
                if word in title:
                    score += 3
                if word in tags:
                    score += 2
                if word in content:
                    score += 1

            if score > 0:
                scored_articles.append((score, reg))

        scored_articles.sort(key=lambda x: x[0], reverse=True)
        matched = [item[1] for item in scored_articles[:4]]
        return matched if matched else kb.get_all_regulations()[:3]

    candidate_ids = []

    if not selection_result or not isinstance(selection_result, dict):
        log_data["parse_error"] = "Invalid JSON returned or parsing failed."
    else:
        log_data["used_gemini"] = True
        raw_ids = selection_result.get("candidate_ids", [])

        if isinstance(raw_ids, list):
            for i in raw_ids:
                if isinstance(i, str) and (i.startswith("table_") or i.startswith("formula_")):
                    candidate_ids.append(i)
                else:
                    try:
                        candidate_ids.append(int(i))
                    except (ValueError, TypeError):
                        candidate_ids.append(str(i))

    # ------------------ FORCE RULES ------------------
    normalized_query = normalize_query(question)
    force_candidates = []

    exam_keywords = ["اختبارين", "مقررين", "تعارض الاختبارات", "جدول الاختبارات"]
    if any(k in question.replace("أ","ا").replace("إ","ا") for k in exam_keywords) or ("اختبار" in question and "يوم" in question):
        force_candidates.append("study_exam_regulations_36")

    if "DN" in normalized_query or "ح" in normalized_query.split():
        force_candidates.extend(["study_exam_regulations_9", "study_exam_regulations_table_53_1"])

    if "W" in normalized_query or "ع" in normalized_query.split():
        force_candidates.append("study_exam_regulations_table_53_1")

    if "IC" in normalized_query or "ل" in normalized_query.split():
        force_candidates.extend(["study_exam_regulations_25", "study_exam_regulations_27", "study_exam_regulations_table_53_1"])

    if "IP" in normalized_query or "م" in normalized_query.split():
        force_candidates.extend(["study_exam_regulations_27", "study_exam_regulations_table_53_1"])

    if "NP" in normalized_query or "NF" in normalized_query or "F" in normalized_query.split():
        force_candidates.append("study_exam_regulations_table_53_1")

    if force_candidates:
        log_data["used_force_rule"] = True
        for fid in force_candidates:
            if fid not in candidate_ids:
                candidate_ids.append(fid)

    log_data["candidate_ids"] = candidate_ids

    confidence = selection_result.get("confidence", 0.0) if selection_result and isinstance(selection_result, dict) else 0.0
    ambiguity_level = selection_result.get("ambiguity_level", "low") if selection_result and isinstance(selection_result, dict) else "low"
    clarification_question = selection_result.get("clarification_question") if selection_result and isinstance(selection_result, dict) else None

    if not candidate_ids or (confidence < 0.4 and not log_data["used_force_rule"]):
        selected_regulations = fallback_search(full_query)

    elif ambiguity_level == "high" and clarification_question:
        return jsonify({"answer": clarification_question})

    elif ambiguity_level == "medium" and clarification_question and confidence < 0.7:
        return jsonify({"answer": clarification_question})

    else:
        selected_regulations = kb.get_regulations_by_ids(candidate_ids)
        if not selected_regulations:
            selected_regulations = fallback_search(full_query)

    # المرحلة الثانية: توليد الإجابة النهائية
    for reg in selected_regulations:
        rid = str(reg.get("unique_id"))
        rtype = reg.get("type", "article")
        log_data["final_sources"].append(rid)

        if rtype == "table":
            log_data["matched_table_ids"].append(rid)
        elif rtype == "formula":
            log_data["matched_formula_ids"].append(rid)
        else:
            log_data["matched_article_ids"].append(rid)

    # ------------------ PRINT LOGS ------------------
    print("\n" + "="*50)
    print("--- [DEBUG] RETRIEVAL LOG ---")
    for k, v in log_data.items():
        print(f"{k}: {v}")
    print("="*50 + "\n")

    final_prompt = build_final_answer_prompt(question, history, selected_regulations)

    # بناء قائمة المصادر (we do this before generating to send it later)
    sources_meta = []
    seen_ids = set()
    for reg in selected_regulations:
        rid = str(reg.get("unique_id"))
        if rid in seen_ids:
            continue
        seen_ids.add(rid)

        doc_id = reg.get("document_id")
        doc_name = "لائحة الانضباط الطلابي" if doc_id == "discipline_regulations" else "لائحة الدراسة والاختبارات للمرحلة الجامعية"
        rtype = reg.get("type", "article")

        if rtype == "article":
            art_num = reg.get("article_number", str(reg.get("id")))
            if not str(art_num).startswith("المادة"):
                art_num = f"المادة {art_num}"
            label = f"{art_num} - {doc_name.replace(' للمرحلة الجامعية', '')}"
        else:
            label = f"{reg.get('article_number', '')} - {doc_name.replace(' للمرحلة الجامعية', '')}"
            if "جدول" not in label and rtype == "table":
                label = f"جدول: {reg.get('title')} - {label}"
            if "معادلة" not in label and rtype == "formula":
                label = f"معادلة: {reg.get('title')} - {label}"

        sources_meta.append({
            "unique_id":             rid,
            "document_id":           doc_id,
            "document_name":         doc_name,
            "type":                  rtype,
            "id":                    reg.get("id"),
            "article_number":        reg.get("article_number"),
            "display_title":         reg.get("title"),
            "official_section_title": reg.get("official_section_title", reg.get("category")),
            "label":                 label
        })

    def generate():
        final_answer = ""
        # stream chunks
        generator = gemini_client.ask_gemini_stream(final_prompt)
        for chunk in generator:
            final_answer += chunk
            yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
        
        # Check for fallback
        if "عذراً، حدث خطأ أثناء الاتصال" in final_answer or not final_answer:
            fallback_msg = "المساعد الذكي يواجه ضغطاً مؤقتاً في معالجة السؤال.<br><br>"
            fallback_msg += "بناءً على الكلمات المفتاحية في سؤالك، قد تجد الإجابة في المواد التالية:<br><br>"
            for reg in selected_regulations[:4]:
                base_article = reg.get('article_number', '').strip()
                fallback_msg += f"🔹 **{base_article}**: {reg.get('title')}<br>"
            final_answer = fallback_msg
            yield f"data: {json.dumps({'chunk': '\\n\\n' + fallback_msg}, ensure_ascii=False)}\n\n"

        # حساب selected_document_id للتحليلات
        doc_ids_in_sources = list({s.get('document_id') for s in sources_meta if s.get('document_id')})
        if len(doc_ids_in_sources) > 1:
            selected_doc_for_log = "mixed"
        elif len(doc_ids_in_sources) == 1:
            selected_doc_for_log = doc_ids_in_sources[0]
        else:
            selected_doc_for_log = "unknown"

        response_time_ms = int((time.time() - start_time) * 1000)

        # تسجيل السؤال في قاعدة البيانات
        try:
            log_question(
                session_id=sid,
                question=question,
                normalized_question=question.lower().replace("أ","ا").replace("إ","ا"),
                answer=final_answer,
                sources=sources_meta,
                selected_document_id=selected_doc_for_log,
                intent=log_data.get("intent", "general_query"),
                used_gemini=log_data.get("used_gemini", False),
                used_fallback=log_data.get("used_fallback", False),
                response_time_ms=response_time_ms
            )
        except Exception:
            pass

        action_val = "none"
        if "أين أجد" in question or "أين أبحث" in question:
            if selected_doc_for_log == "discipline_regulations": action_val = "show_discipline_index"
            elif selected_doc_for_log == "study_exam_regulations": action_val = "show_study_index"

    if is_non_stream:
        # Collect response non-streamingly for widget
        final_ans = ""
        try:
            generator = gemini_client.ask_gemini_stream(final_prompt)
            for chunk in generator:
                final_ans += chunk
        except Exception as e:
            print(f"[Ask Non-Stream Error] {e}")

        if "عذراً، حدث خطأ أثناء الاتصال" in final_ans or not final_ans:
            fallback_msg = "المساعد الذكي يواجه ضغطاً مؤقتاً في معالجة السؤال.<br><br>"
            fallback_msg += "بناءً على الكلمات المفتاحية في سؤالك، قد تجد الإجابة في المواد التالية:<br><br>"
            for reg in selected_regulations[:4]:
                base_article = reg.get('article_number', '').strip()
                fallback_msg += f"🔹 **{base_article}**: {reg.get('title')}<br>"
            final_ans = fallback_msg

        try:
            doc_ids_in_sources = list({s.get('document_id') for s in sources_meta if s.get('document_id')})
            selected_doc_for_log = doc_ids_in_sources[0] if len(doc_ids_in_sources) == 1 else ("mixed" if len(doc_ids_in_sources) > 1 else "unknown")
            log_question(
                session_id=sid, question=question,
                normalized_question=question.lower().replace("أ","ا").replace("إ","ا"),
                answer=final_ans, sources=sources_meta, selected_document_id=selected_doc_for_log,
                intent=log_data.get("intent", "general_query"), used_gemini=log_data.get("used_gemini", False),
                used_fallback=log_data.get("used_fallback", False), response_time_ms=int((time.time() - start_time) * 1000)
            )
        except Exception: pass

        return jsonify({"answer": final_ans, "sources": sources_meta, "action": "none"})

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


@legacy_chat_bp.route('/articles', methods=['GET'])
def get_articles():
    all_regs = kb.get_all_regulations()
    sources_dict = {}

    for reg in all_regs:
        doc_id = reg.get("document_id")
        if doc_id not in sources_dict:
            doc_name = "لائحة الانضباط الطلابي" if doc_id == "discipline_regulations" else "لائحة الدراسة والاختبارات للمرحلة الجامعية"
            sources_dict[doc_id] = {
                "document_id":           doc_id,
                "document_name":         doc_name,
                "official_articles_count": 0,
                "knowledge_items_count": 0,
                "tables_count":          0,
                "formulas_count":        0,
                "items":                 [],
                "tables":                [],
                "formulas":              []
            }

        rtype = reg.get("type", "article")
        sources_dict[doc_id]["knowledge_items_count"] += 1

        if rtype == "article":
            sources_dict[doc_id]["official_articles_count"] += 1
            sources_dict[doc_id]["items"].append(reg)
        elif rtype == "table":
            sources_dict[doc_id]["tables_count"] += 1
            sources_dict[doc_id]["tables"].append(reg)
        elif rtype == "formula":
            sources_dict[doc_id]["formulas_count"] += 1
            sources_dict[doc_id]["formulas"].append(reg)

    sources_list = list(sources_dict.values())
    return jsonify({"sources": sources_list})
