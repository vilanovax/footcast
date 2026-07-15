"""جمع‌آوری اخبار از فیدهای RSS."""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone

import feedparser

from .config import Config, Source
from .models import NewsItem

_HTML_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _clean(text: str) -> str:
    """حذف تگ‌های HTML و نرمال‌سازی فاصله‌ها."""
    if not text:
        return ""
    text = _HTML_TAG.sub(" ", text)
    text = _WS.sub(" ", text)
    return text.strip()


def _parse_date(entry) -> datetime | None:
    for attr in ("published_parsed", "updated_parsed"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return datetime.fromtimestamp(time.mktime(val), tz=timezone.utc)
            except (OverflowError, ValueError):
                continue
    return None


def fetch_source(source: Source, timeout: int = 20) -> list[NewsItem]:
    """اخبار یک منبع را می‌خواند. در صورت خطا لیست خالی برمی‌گرداند."""
    items: list[NewsItem] = []
    try:
        # feedparser از agent پیش‌فرض استفاده می‌کند؛ برخی سایت‌ها آن را بلاک می‌کنند
        parsed = feedparser.parse(
            source.url,
            agent="Mozilla/5.0 (compatible; FootcastBot/0.1; +https://example.com)",
        )
    except Exception as exc:  # noqa: BLE001 - می‌خواهیم پایپلاین ادامه یابد
        print(f"  ⚠️  خطا در خواندن «{source.name}»: {exc}")
        return items

    if getattr(parsed, "bozo", 0) and not parsed.entries:
        print(f"  ⚠️  فید «{source.name}» قابل خواندن نبود یا خالی است.")
        return items

    for entry in parsed.entries:
        title = _clean(getattr(entry, "title", ""))
        if not title:
            continue
        items.append(
            NewsItem(
                title=title,
                summary=_clean(getattr(entry, "summary", "")),
                link=getattr(entry, "link", ""),
                source=source.name,
                region=source.region,
                published=_parse_date(entry),
                source_weight=source.weight,
            )
        )
    return items


def fetch_all(config: Config) -> list[NewsItem]:
    """همه منابع فعال را می‌خواند و اخبار را با حذف تکراری‌ها برمی‌گرداند."""
    all_items: list[NewsItem] = []
    for source in config.enabled_sources:
        print(f"  → دریافت از «{source.name}» ...")
        fetched = fetch_source(source)
        print(f"     {len(fetched)} خبر دریافت شد.")
        all_items.extend(fetched)

    # حذف تکراری‌ها بر اساس کلید یکتا
    seen: set[str] = set()
    unique: list[NewsItem] = []
    for item in all_items:
        key = item.dedup_key()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    print(f"  مجموع {len(unique)} خبر یکتا از {len(all_items)} خبر خام.")
    return unique
