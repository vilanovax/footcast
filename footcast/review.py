"""بازبینی سه‌مرحله‌ای محتوا پیش از تبدیل به صوت.

Pass 1 — صحت و ساختار تحریریه (Fact Checker + Senior Editor)
Pass 2 — روایت و لحن پادکست (Persian Conversational Editor)
Pass 3 — آمادگی TTS (TTS Editor + Audio Script QA)

هر پاس با Claude اجرا می‌شود؛ بدون کلید API به بررسی‌های پایه (قطعی) برمی‌گردد.
"""

from __future__ import annotations

import json

from .config import Config
from .models import PassResult, ReviewResult, Script, Segment
from .pronunciation import PronunciationDictionary
from .tts_clean import clean_for_tts

# افعال رسمی که در لحن محاوره‌ای پادکست باید کم شوند (کنترل پایه Pass 2)
_FORMAL_MARKERS = [
    "خواهد شد", "خواهد کرد", "اظهار داشت", "در خصوص", "به منظور",
    "به شمار می‌رود", "مورد تأیید قرار گرفت", "می‌باشد", "می‌گردد",
]


# ---------------------------------------------------------------------------
# بررسی‌های پایه (بدون LLM)
# ---------------------------------------------------------------------------
def _basic_checks(script: Script) -> list[str]:
    issues: list[str] = []
    if not script.segments:
        issues.append("هیچ بخش خبری‌ای وجود ندارد.")
    for i, seg in enumerate(script.segments, 1):
        if not seg.headline.strip():
            issues.append(f"بخش {i}: تیتر خالی است.")
        if len(seg.body.strip()) < 20:
            issues.append(f"بخش {i}: متن بسیار کوتاه یا خالی است.")
    return issues


def _formal_language_check(script: Script) -> list[str]:
    issues: list[str] = []
    full = script.to_speech_text()
    for marker in _FORMAL_MARKERS:
        if marker in full:
            issues.append(f"عبارت رسمی «{marker}» — برای لحن محاوره‌ای بازنویسی شود.")
    return issues


def _tts_readiness_check(script: Script) -> list[str]:
    pron = PronunciationDictionary.load()
    clean = clean_for_tts(script.to_speech_text(), pronunciation=pron)
    return clean.issues


# ---------------------------------------------------------------------------
# پاس‌های مبتنی بر LLM
# ---------------------------------------------------------------------------
_PASS_PROMPTS = {
    1: (
        "تو Fact Checker و سردبیر ارشد هستی. اسکریپت را از نظر صحت و ساختار بازبینی کن: "
        "درستی زمان و تاریخ، نام‌ها، آمار، نتیجه، نقل‌قول، تفکیک رسمی از شایعه، و تناقض. "
        "اگر ادعایی بی‌پایه یا مبهم بود اصلاح یا محتاطانه‌اش کن. اطلاعات جدید نساز."
    ),
    2: (
        "تو تهیه‌کننده پادکست و ویراستار محاوره فارسی هستی. اجازه تغییر Fact نداری. "
        "قلاب، ریتم، طول جمله، لحن محاوره معیار (می‌شه، می‌تونه، داره، گفته) و انتقال بین بخش‌ها "
        "را بهبود بده. از افعال رسمی (خواهد شد، اظهار داشت، به منظور) پرهیز کن. "
        "اصطلاحات جاافتاده فوتبالی (کرنر، کلین‌شیت، پرس) را ترجمه نکن."
    ),
    3: (
        "تو ویراستار TTS هستی. اجازه تغییر خبر یا تحلیل نداری. متن را برای خوانده‌شدن با صدا آماده کن: "
        "اعداد به حروف، نتایج به شکل «دو بر یک»، ساعت گفتاری، حذف مارک‌داون و URL و نام لاتین داخل پرانتز، "
        "شکستن جمله‌های خیلی بلند و رفع جمله‌های ناقص."
    ),
}


def _build_pass_prompt(pass_number: int, script: Script) -> str:
    role = _PASS_PROMPTS[pass_number]
    payload = {
        "intro": script.intro,
        "segments": [s.model_dump() for s in script.segments],
        "outro": script.outro,
    }
    return f"""{role}

خروجی را دقیقاً به صورت JSON بده:
{{
  "approved": true/false,
  "score": <۰ تا ۱۰۰>,
  "facts_changed": true/false,
  "issues": ["فهرست ایرادها"],
  "notes": "توضیح کوتاه",
  "revised": {{
    "intro": "...",
    "segments": [{{"headline": "...", "body": "...", "source": "...", "link": "..."}}],
    "outro": "..."
  }}
}}
اگر اصلاحی لازم نبود، متن اصلی را در «revised» بازتاب بده.

اسکریپت:
{json.dumps(payload, ensure_ascii=False, indent=2)}
"""


def _run_llm_pass(client, model: str, pass_number: int, name: str, script: Script) -> tuple[PassResult, Script]:
    prompt = _build_pass_prompt(pass_number, script)
    print(f"    → Pass {pass_number} ({name}) ...")
    message = client.messages.create(
        model=model, max_tokens=4000, messages=[{"role": "user", "content": prompt}]
    )
    data = _extract_json(message.content[0].text)
    if data is None:
        return (
            PassResult(pass_number=pass_number, name=name, approved=False,
                       issues=["خروجی پاس قابل‌خواندن نبود."], notes="fallback"),
            script,
        )

    revised = _apply_revision(script, data.get("revised"))
    result = PassResult(
        pass_number=pass_number,
        name=name,
        approved=bool(data.get("approved", False)),
        score=int(data.get("score", 0)),
        facts_changed=bool(data.get("facts_changed", False)),
        issues=list(data.get("issues", []) or []),
        notes=data.get("notes", ""),
    )
    return result, revised


def _apply_revision(script: Script, revised) -> Script:
    if not isinstance(revised, dict) or not revised.get("segments"):
        return script
    return Script(
        show_name=script.show_name,
        date=script.date,
        intro=revised.get("intro", script.intro),
        segments=[
            Segment(
                headline=s.get("headline", ""),
                body=s.get("body", ""),
                source=s.get("source", ""),
                link=s.get("link", ""),
            )
            for s in revised["segments"]
        ],
        outro=revised.get("outro", script.outro),
        language=script.language,
    )


# ---------------------------------------------------------------------------
# ارکستراسیون
# ---------------------------------------------------------------------------
_PASS_NAMES = {1: "صحت و ساختار", 2: "لحن محاوره‌ای", 3: "آمادگی TTS"}


def _fallback_review(script: Script) -> ReviewResult:
    """بازبینی پایه بدون LLM — سه پاس با بررسی‌های قطعی."""
    p1_issues = _basic_checks(script)
    p2_issues = _formal_language_check(script)
    p3_issues = _tts_readiness_check(script)

    passes = [
        PassResult(pass_number=1, name=_PASS_NAMES[1], approved=not p1_issues,
                   score=70 if not p1_issues else 40, issues=p1_issues),
        PassResult(pass_number=2, name=_PASS_NAMES[2], approved=not p2_issues,
                   score=70 if not p2_issues else 55, issues=p2_issues),
        PassResult(pass_number=3, name=_PASS_NAMES[3], approved=not p3_issues,
                   score=70 if not p3_issues else 55, issues=p3_issues),
    ]
    all_issues = p1_issues + p2_issues + p3_issues
    approved = all(p.approved for p in passes)
    avg = sum(p.score for p in passes) // len(passes)
    return ReviewResult(
        approved=approved,
        score=avg,
        issues=all_issues,
        notes="بازبینی پایه (بدون LLM). برای بازبینی کامل ANTHROPIC_API_KEY را تنظیم کن.",
        passes=passes,
        revised_script=script,
    )


def review_script(script: Script, config: Config) -> ReviewResult:
    """بازبینی سه‌مرحله‌ای. بدون کلید به بازبینی پایه برمی‌گردد."""
    if not config.anthropic_api_key:
        return _fallback_review(script)

    try:
        import anthropic
    except ImportError:
        return _fallback_review(script)

    client = anthropic.Anthropic(api_key=config.anthropic_api_key)
    model = config.content.model
    current = script
    passes: list[PassResult] = []

    for pass_number in (1, 2, 3):
        name = _PASS_NAMES[pass_number]
        result, current = _run_llm_pass(client, model, pass_number, name, current)
        passes.append(result)
        # قانون بازگشت: اگر Pass 2 یا 3 تغییر factual داشت، برگرد به Pass 1
        if pass_number > 1 and result.facts_changed:
            print(f"    ↩︎  Pass {pass_number} تغییر factual داشت — بازگشت به Pass 1.")
            result_p1, current = _run_llm_pass(client, model, 1, _PASS_NAMES[1], current)
            passes.append(result_p1)

    # بررسی‌های قطعی نهایی (مکمل LLM)
    basic = _basic_checks(current)
    tts = _tts_readiness_check(current)
    machine_issues = basic + tts

    approved = all(p.approved for p in passes) and not basic
    all_issues = [i for p in passes for i in p.issues] + machine_issues
    avg = sum(p.score for p in passes) // max(len(passes), 1)

    return ReviewResult(
        approved=approved,
        score=avg,
        issues=list(dict.fromkeys(all_issues)),
        notes="بازبینی سه‌مرحله‌ای کامل شد.",
        passes=passes,
        revised_script=current,
    )


def _extract_json(raw: str) -> dict | None:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None
