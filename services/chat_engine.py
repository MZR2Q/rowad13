"""
LEGACY / DISABLED FEATURE support module for the abandoned regulations-chatbot.

services.knowledge_base / services.gemini_client / services.prompt_builder were
part of an earlier chatbot idea that was scrapped; those modules no longer exist
in this repo, so the try/except below always falls through and kb/gemini_client
stay None (same as in the original monolithic app.py). Only routes/legacy_chat.py
and the quiz AI-question-generation fallback in routes/quiz.py depend on this.
"""
import os
import re

from config import BASE_DIR

try:
    from services.knowledge_base import KnowledgeBase
    from services.prompt_builder import build_selection_prompt, build_final_answer_prompt
    from services.gemini_client import GeminiClient
except ImportError:
    KnowledgeBase = None
    GeminiClient = None
    def build_selection_prompt(*a, **kw): return ""
    def build_final_answer_prompt(*a, **kw): return ""

kb = KnowledgeBase(data_dir=os.path.join(BASE_DIR, 'data')) if KnowledgeBase else None
gemini_client = GeminiClient() if GeminiClient else None


def normalize_query(text: str) -> str:
    text = text.strip()
    text = re.sub(r"[؟?,،؛;:.!()\[\]{}\"']", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.upper()
