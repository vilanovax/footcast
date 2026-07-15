"""بازبینی کیفی محتوای تولیدشده پیش از تبدیل به صوت."""

from __future__ import annotations

import json

from .config import Config
from .models import ReviewResult, Script, Segment


def _build_review_prompt(script: Script, config: Config) -> str:
    payload = {
        "intro": script.intro,
        "segments": [s.model_dump() for s in script.segments],
        "outro": script.outro,
    }
    return f"""تو ویراستار ارشد یک برنامه خبری فوتبال هستی. اسکریپت زیر (JSON) را با دقت بازبینی کن.

معیارهای بازبینی:
- درستی و انسجام: آیا متن با اطلاعات منبع همخوان است و ادعای بی‌پایه ندارد؟
- کیفیت زبان فارسی: نگارش، روانی، مناسب‌بودن برای خواندن با صدا.
- لحن مناسب برنامه خبری.
- نبود تکرار، ابهام یا جملات نامفهوم.

اگر لازم بود، متن را اصلاح و بهبود بده (بدون افزودن اطلاعات جدید یا ساختگی).

خروجی را دقیقاً به صورت JSON با این ساختار بده:
{{
  "approved": true/false,
  "score": <عدد ۰ تا ۱۰۰>,
  "issues": ["فهرست ایرادها"],
  "notes": "توضیح کوتاه",
  "revised": {{
    "intro": "...",
    "segments": [{{"headline": "...", "body": "...", "source": "...", "link": "..."}}],
    "outro": "..."
  }}
}}
اگر اصلاحی لازم نبود، همان متن اصلی را در «revised» بازتاب بده.

اسکریپت برای بازبینی:
{json.dumps(payload, ensure_ascii=False, indent=2)}
"""


def _basic_checks(script: Script) -> list[str]:
    """بررسی‌های ساده و قطعی که بدون LLM هم انجام می‌شوند."""
    issues: list[str] = []
    if not script.segments:
        issues.append("هیچ بخش خبری‌ای وجود ندارد.")
    for i, seg in enumerate(script.segments, 1):
        if not seg.headline.strip():
            issues.append(f"بخش {i}: تیتر خالی است.")
        if len(seg.body.strip()) < 20:
            issues.append(f"بخش {i}: متن بسیار کوتاه یا خالی است.")
    return issues


def review_script(script: Script, config: Config) -> ReviewResult:
    """اسکریپت را بازبینی می‌کند. بدون کلید فقط بررسی‌های پایه انجام می‌شود."""
    basic_issues = _basic_checks(script)

    if not config.anthropic_api_key:
        approved = len(basic_issues) == 0
        return ReviewResult(
            approved=approved,
            score=70 if approved else 40,
            issues=basic_issues,
            notes="بازبینی پایه (بدون LLM). برای بازبینی کامل ANTHROPIC_API_KEY را تنظیم کن.",
            revised_script=script,
        )

    try:
        import anthropic
    except ImportError:
        return ReviewResult(
            approved=len(basic_issues) == 0,
            score=70,
            issues=basic_issues,
            notes="کتابخانه anthropic نصب نیست — فقط بازبینی پایه.",
            revised_script=script,
        )

    client = anthropic.Anthropic(api_key=config.anthropic_api_key)
    prompt = _build_review_prompt(script, config)

    print(f"  → بازبینی محتوا با مدل {config.content.model} ...")
    message = client.messages.create(
        model=config.content.model,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    data = _extract_json(raw)

    if data is None:
        return ReviewResult(
            approved=len(basic_issues) == 0,
            score=60,
            issues=basic_issues + ["خروجی بازبینی قابل‌خواندن نبود."],
            notes="بازبینی هوشمند ناموفق بود — به بازبینی پایه بازگشت.",
            revised_script=script,
        )

    revised = data.get("revised")
    revised_script = script
    if isinstance(revised, dict) and revised.get("segments"):
        revised_script = Script(
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

    llm_issues = data.get("issues", []) or []
    return ReviewResult(
        approved=bool(data.get("approved", False)) and len(basic_issues) == 0,
        score=int(data.get("score", 0)),
        issues=basic_issues + list(llm_issues),
        notes=data.get("notes", ""),
        revised_script=revised_script,
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
