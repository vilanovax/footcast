"""انتخاب و رتبه‌بندی مهم‌ترین اخبار."""

from __future__ import annotations

from datetime import datetime, timezone

from .config import Config
from .models import NewsItem


def _recency_score(item: NewsItem, max_age_hours: int) -> float:
    """اخبار تازه‌تر امتیاز بالاتری می‌گیرند (۰ تا ۱۰)."""
    if not item.published:
        return 3.0  # تاریخ نامعلوم — امتیاز متوسط رو به پایین
    now = datetime.now(tz=timezone.utc)
    age_hours = (now - item.published).total_seconds() / 3600.0
    if age_hours < 0:
        age_hours = 0
    if age_hours > max_age_hours:
        return 0.0
    # خطی: تازه = ۱۰، در آستانه سن = ۰
    return round(10.0 * (1 - age_hours / max_age_hours), 2)


def _keyword_boost(item: NewsItem, keywords: list[str]) -> float:
    text = f"{item.title} {item.summary}".lower()
    hits = sum(1 for kw in keywords if kw.lower() in text)
    return min(hits * 2.0, 6.0)  # هر کلمه ۲ امتیاز، سقف ۶


def score_items(items: list[NewsItem], config: Config) -> list[NewsItem]:
    """به هر خبر امتیاز اهمیت می‌دهد."""
    sel = config.selection
    for item in items:
        recency = _recency_score(item, sel.max_age_hours)
        source = float(item.source_weight)  # ۰ تا ۱۰
        boost = _keyword_boost(item, sel.boost_keywords)
        # وزن‌دهی: تازگی مهم‌ترین، بعد اعتبار منبع، بعد کلمات کلیدی
        item.score = round(recency * 1.5 + source * 1.0 + boost * 1.0, 2)
    return items


def select_top(items: list[NewsItem], config: Config) -> list[NewsItem]:
    """اخبار را امتیازدهی، فیلتر و مرتب می‌کند و مهم‌ترین‌ها را برمی‌گرداند."""
    sel = config.selection
    scored = score_items(items, config)

    # فقط اخباری که در بازه زمانی مجاز هستند (امتیاز تازگی > ۰) یا تاریخ نامعلوم دارند
    fresh = [it for it in scored if it.published is None or _recency_score(it, sel.max_age_hours) > 0]

    fresh.sort(key=lambda it: it.score, reverse=True)
    top = fresh[: sel.max_items]

    print(f"  {len(top)} خبر از {len(scored)} خبر برای تولید محتوا انتخاب شد.")
    return top
