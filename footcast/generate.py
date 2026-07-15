"""تولید محتوای نوشتاری با استفاده از Claude."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .config import Config
from .models import NewsItem, Script, Segment


def _build_prompt(items: list[NewsItem], config: Config) -> str:
    cnt = config.content
    lang_name = "فارسی" if cnt.language == "fa" else "English"

    news_block = []
    for i, it in enumerate(items, 1):
        news_block.append(
            f"{i}. [{it.region} | {it.source}] {it.title}\n"
            f"   خلاصه: {it.summary[:400]}\n"
            f"   لینک: {it.link}"
        )
    news_text = "\n\n".join(news_block)

    return f"""تو سردبیر و گوینده یک برنامه صوتی خبری فوتبال به نام «{cnt.show_name}» هستی.
از فهرست اخبار خام زیر یک اسکریپت خبری منسجم به زبان {lang_name} بساز که برای «خوانده‌شدن با صدا» مناسب باشد.

قوانین:
- لحن: {cnt.tone}.
- برای هر خبر یک بخش بنویس: یک تیتر کوتاه گویا + یک متن حدوداً {cnt.words_per_item} کلمه‌ای.
- فقط بر اساس اطلاعات همین اخبار بنویس؛ چیزی از خودت اضافه یا حدس نزن (بدون توهم).
- اعداد و اسامی را دقیق نگه دار. اگر خبری مبهم است، محتاطانه بیان کن.
- یک مقدمهٔ کوتاه (intro) و یک جمع‌بندی کوتاه (outro) هم بنویس.
- متن باید روان و قابل‌تلفظ باشد؛ از علائم نگارشی و اختصارات پیچیده پرهیز کن.

خروجی را دقیقاً به صورت JSON با این ساختار بده (بدون هیچ توضیح اضافه):
{{
  "intro": "متن مقدمه",
  "segments": [
    {{"headline": "تیتر", "body": "متن بخش", "source": "نام منبع", "link": "لینک"}}
  ],
  "outro": "متن جمع‌بندی"
}}

اخبار خام:
{news_text}
"""


def _fallback_script(items: list[NewsItem], config: Config) -> Script:
    """ساخت اسکریپت ساده بدون LLM (حالت آزمایشی/بدون کلید)."""
    date = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    segments = [
        Segment(
            headline=it.title,
            body=it.summary or it.title,
            source=it.source,
            link=it.link,
        )
        for it in items
    ]
    return Script(
        show_name=config.content.show_name,
        date=date,
        intro=f"{config.content.show_name}. مرور مهم‌ترین اخبار فوتبال امروز.",
        segments=segments,
        outro="این برنامه به پایان رسید. تا فرصتی دیگر بدرود.",
        language=config.content.language,
    )


def generate_script(items: list[NewsItem], config: Config) -> Script:
    """با Claude اسکریپت خبری تولید می‌کند. بدون کلید به حالت آزمایشی برمی‌گردد."""
    date = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")

    if not config.anthropic_api_key:
        print("  ⚠️  ANTHROPIC_API_KEY تنظیم نشده — حالت آزمایشی (بدون تولید هوشمند).")
        return _fallback_script(items, config)

    try:
        import anthropic
    except ImportError:
        print("  ⚠️  کتابخانه anthropic نصب نیست — حالت آزمایشی.")
        return _fallback_script(items, config)

    client = anthropic.Anthropic(api_key=config.anthropic_api_key)
    prompt = _build_prompt(items, config)

    print(f"  → تولید محتوا با مدل {config.content.model} ...")
    message = client.messages.create(
        model=config.content.model,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()

    data = _extract_json(raw)
    if data is None:
        print("  ⚠️  خروجی مدل JSON معتبر نبود — حالت آزمایشی.")
        return _fallback_script(items, config)

    segments = [
        Segment(
            headline=s.get("headline", ""),
            body=s.get("body", ""),
            source=s.get("source", ""),
            link=s.get("link", ""),
        )
        for s in data.get("segments", [])
    ]
    return Script(
        show_name=config.content.show_name,
        date=date,
        intro=data.get("intro", ""),
        segments=segments,
        outro=data.get("outro", ""),
        language=config.content.language,
    )


def _extract_json(raw: str) -> dict | None:
    """تلاش برای استخراج آبجکت JSON از خروجی مدل."""
    raw = raw.strip()
    if raw.startswith("```"):
        # حذف حصار کد ```json ... ```
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
