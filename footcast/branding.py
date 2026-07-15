"""هویت ثابت برنامه: امضای شروع و پایان پادکست.

شروع و پایان هر اپیزود جمله‌های ثابت دارند تا شنونده برنامه و مجری را بشناسد؛
فقط تاریخ و سه تیتر روز تغییر می‌کنند.

شروع (۴ جزء، حدود ۲۰ تا ۳۰ ثانیه):
  ۱) سلام و معرفی مجری   ۲) روز و تاریخ شمسی
  ۳) معرفی کوتاه برنامه   ۴) سه موضوع اصلی و ورود به خبر اول

پایان:
  سؤال روز (در صورت وجود) + دعوت کوتاه به دنبال‌کردن + جمله امضای برنامه
"""

from __future__ import annotations

from datetime import datetime

from .config import ContentConfig
from .persian_date import format_persian_date
from .story import Story


# واژه‌های ربط/اضافه که تیتر نباید روی آن‌ها تمام شود
_TRAILING = {"و", "به", "از", "در", "با", "که", "را", "تا", "بر", "برای",
             "درباره", "پیش", "این", "یک", "روی", "طبق"}


def _teaser(story: Story, max_words: int = 9) -> str:
    """تیتر کوتاه‌شده برای معرفی موضوع در شروع (بدون قطع روی حرف ربط)."""
    words = story.title.split()
    if len(words) <= max_words:
        return story.title.strip()
    words = words[:max_words]
    # اگر به «و <کلمه>» ختم شد، هر دو حذف شوند
    if len(words) > 3 and words[-2] == "و":
        words = words[:-2]
    # حذف حروف ربط/اضافه انتهایی
    while len(words) > 3 and words[-1] in _TRAILING:
        words.pop()
    return " ".join(words).strip()


def build_intro(
    stories: list[Story],
    when: datetime,
    content: ContentConfig,
    with_year: bool = False,
) -> str:
    """شروع ثابت برنامه با تاریخ و سه تیتر روز."""
    date_str = format_persian_date(when, with_weekday=True, with_year=with_year)
    signature = content.intro_signature.format(host=content.host_name, date=date_str)

    used = [s for s in stories if s.used_in_episode] or stories
    teasers = [_teaser(s) for s in used[:3]]

    parts = [signature]
    if len(teasers) >= 3:
        parts.append(f"امروز سه موضوع اصلی داریم؛ {teasers[0]}، {teasers[1]}، و {teasers[2]}.")
    elif len(teasers) == 2:
        parts.append(f"امروز دو موضوع مهم داریم؛ {teasers[0]}، و {teasers[1]}.")
    elif teasers:
        parts.append(f"مهم‌ترین خبر امروز: {teasers[0]}.")

    parts.append("اول برویم سراغ مهم‌ترین خبر امروز.")
    return " ".join(parts)


def build_outro(question: str, content: ContentConfig) -> str:
    """پایان ثابت برنامه: سؤال روز + دعوت به دنبال‌کردن + امضا."""
    signature = content.outro_signature.format(host=content.host_name)
    parts: list[str] = []
    if question and question.strip():
        parts.append(f"و اما سؤال امروز؛ {question.strip()}")
    parts.append(content.follow_invite)
    parts.append(signature)
    return " ".join(parts)


def apply_branding(script, stories, when: datetime, content: ContentConfig) -> None:
    """intro/outro اسکریپت را با امضای ثابت برنامه جایگزین می‌کند (درجا)."""
    script.intro = build_intro(stories, when, content)
    script.outro = build_outro(getattr(script, "question", "") or "", content)
