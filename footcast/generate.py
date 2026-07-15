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

    return f"""تو سردبیر و گوینده یک پادکست خبری روزانه فوتبال به نام «{cnt.show_name}» برای مخاطب فارسی‌زبان هستی.
از فهرست اخبار زیر یک اسکریپت خبری منسجم به زبان {lang_name} بساز که برای «خوانده‌شدن با صدا» مناسب باشد.

ساختار اپیزود (به همین ترتیب در segments):
- داستان اصلی روز: مهم‌ترین خبر؛ پاسخ به سه پرسش «چه اتفاقی افتاد؟ چرا مهم است؟ چه چیزی را باید دنبال کرد؟»
- چند محور مهم ایران و جهان: هر کدام «اتفاق اصلی + وضعیت اعتبار + اهمیت برای مخاطب».
- در صورت وجود شایعه: با معرفی صریح («خبری که هنوز رسمی نشده») و ذکر منبع و درجه اطمینان.

لحن و نگارش — «محاوره معیار» (نه رسمی کتابی، نه کوچه‌بازاری):
- مثل حرف‌زدن یک مجری مطلع و خوش‌بیان با یک دوست علاقه‌مند به فوتبال.
- افعال گفتاری: «می‌شه، می‌تونه، می‌خواد، داره، هستن، گفته» به‌جای «می‌شود، می‌تواند، است، هستند».
- آینده رسمی ممنوع: «برگزار می‌شه» نه «برگزار خواهد شد».
- افعال مجهول را فعال کن: «باشگاه تأییدش کرده» نه «تأیید شده است».
- عبارت اداری ممنوع: «درباره» نه «در خصوص»؛ «گفت» نه «اظهار داشت».
- عامیانه افراطی ممنوع: از «واسه، می‌خاد، ترکوند، آخه» استفاده نکن.
- جمله‌ها کوتاه (۱۰ تا ۲۰ کلمه)، هر جمله یک پیام؛ هر پاراگراف دو-سه جمله.
- اصطلاحات دقیق حقوقی/فنی (بند فسخ، رأی نهایی، پنجره نقل‌وانتقالات) را تغییر نده.
- هر بخش: یک تیتر کوتاه گویا + متنی حدوداً {cnt.words_per_item} کلمه‌ای.
قانون کاربردی: هر جمله‌ای که بشه بدون تغییر در خبرگزاری منتشر کرد، هنوز محاوره‌ای نشده.

قواعد صحت (بسیار مهم):
- فقط بر اساس همین اخبار بنویس؛ هیچ Fact، عدد، تاریخ یا نقل‌قول جدید نساز و حدس نزن.
- خبر رسمی را از شایعه جدا کن. برای خبری که رسمی نشده، از «قطعی شد» یا «پیوست» استفاده نکن.
- تحلیل را از خبر جدا کن؛ نتیجه‌گیری قطعی نده («به نظر می‌رسد»، «هنوز برای قضاوت زود است»).
- در موضوعات حساس (مصدومیت، پرونده قضایی، محرومیت) محتاط باش و زبان قطعی نگیر.

طنز (اختیاری و ملایم): فقط پس از انتقال دقیق خبر، یک شوخی کوتاه مرتبط با فضای فوتبال.
هرگز درباره مصدومیت، بیماری، ملیت، ظاهر یا مسائل شخصی شوخی نکن.

واژگان فوتبالی:
- اصطلاحات جاافتاده بین هواداران فارسی‌زبان را نگه دار (کرنر، پنالتی، کلین‌شیت، کام‌بک، پرس، ترنزیشن، ست‌پیس، وینگر، فول‌بک، هت‌تریک، دربی).
- ترجمه تحت‌اللفظی نکن که متن مصنوعی و شبیه گزارش رسمی شود.
- ولی معادل فارسیِ طبیعی را ترجیح بده: ضدحمله (نه کانتراتک)، سانتر (نه کراس)، ضربه سر (نه هدر)، گل مساوی، ضدحمله، آرایش تیم، بازیکن آزاد.
- اصطلاح تخصصی کم‌ترشناخته را در اولین استفاده کوتاه توضیح بده (مثل: بازی‌سازی از عقب یا بیلدآپ).

یک مقدمهٔ کوتاه (intro) که سه خبر اصلی را معرفی کند و یک جمع‌بندی کوتاه (outro) بنویس.

یک «قلاب سرد» بنویس: یک جمله یا سؤالِ قویِ کوتاه که پیش از معرفی برنامه گفته می‌شود.
الگو: «اتفاق عجیب + سؤال باز» یا «نتیجه مهم + چیزی که هنوز معلوم نیست». خلاصهٔ کامل خبر نباشد.
یک «سؤال روز» کوتاه هم بنویس که مخاطب را به فکر دعوت کند و پاسخ کاملاً بدیهی نداشته باشد.

خروجی را دقیقاً به صورت JSON با این ساختار بده (بدون هیچ توضیح اضافه):
{{
  "cold_hook": "قلاب سرد",
  "intro": "متن مقدمه",
  "segments": [
    {{"headline": "تیتر", "body": "متن بخش", "source": "نام منبع", "link": "لینک"}}
  ],
  "question": "سؤال روز",
  "outro": "متن جمع‌بندی"
}}
توجه: مقدمه و جمع‌بندی بعداً با امضای ثابت برنامه جایگزین می‌شوند؛ اما آن‌ها را بنویس.

اخبار (به ترتیب اهمیت):
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
    raw = _message_text(message)
    data = _extract_json(raw) if raw else None
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
        cold_hook=data.get("cold_hook", ""),
        intro=data.get("intro", ""),
        segments=segments,
        question=data.get("question", ""),
        outro=data.get("outro", ""),
        language=config.content.language,
    )


def _message_text(message) -> str:
    """اولین بلوک متنی پاسخ را امن استخراج می‌کند (بدون کرش روی بلوک خالی/غیرمتنی)."""
    try:
        for block in message.content:
            text = getattr(block, "text", None)
            if text:
                return text.strip()
    except (AttributeError, TypeError, IndexError):
        pass
    return ""


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
