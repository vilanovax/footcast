"""تست‌های واحد که بدون شبکه یا کلید API اجرا می‌شوند."""

from datetime import datetime, timedelta, timezone

from footcast.config import ContentConfig, SelectionConfig, Config, Source
from footcast.models import NewsItem, Script, Segment
from footcast.select import select_top, score_items
from footcast.segments import build_segments
from footcast.review import _basic_checks


def _cfg(**sel_overrides) -> Config:
    return Config(
        sources=[Source(name="s", url="x", region="iran", weight=8)],
        selection=SelectionConfig(max_items=3, max_age_hours=36,
                                  boost_keywords=["Champions League", "پرسپولیس"],
                                  **sel_overrides),
        content=ContentConfig(),
    )


def _item(title, region="iran", weight=8, hours_ago=1, summary=""):
    return NewsItem(
        title=title, summary=summary, region=region, source_weight=weight,
        published=datetime.now(tz=timezone.utc) - timedelta(hours=hours_ago),
    )


def test_dedup_key_uses_link_then_title():
    a = NewsItem(title="X", link="http://a")
    b = NewsItem(title="X", link="")
    assert a.dedup_key() == "http://a"
    assert b.dedup_key() == "x"


def test_keyword_boost_increases_score():
    cfg = _cfg()
    plain = _item("خبر عادی فوتبال")
    boosted = _item("پرسپولیس در Champions League")
    score_items([plain, boosted], cfg)
    assert boosted.score > plain.score


def test_select_top_respects_max_items():
    cfg = _cfg()
    items = [_item(f"خبر {i}") for i in range(10)]
    top = select_top(items, cfg)
    assert len(top) == 3


def test_select_top_drops_stale_items():
    cfg = _cfg()
    fresh = _item("تازه", hours_ago=1)
    stale = _item("کهنه", hours_ago=100)  # خارج از بازه ۳۶ ساعته
    top = select_top([fresh, stale], cfg)
    titles = [t.title for t in top]
    assert "تازه" in titles
    assert "کهنه" not in titles


def test_build_segments_splits_long_text():
    text = "\n\n".join(["پاراگراف " * 100 for _ in range(20)])
    segments = build_segments(text, max_chars=1000)
    assert len(segments) > 1
    assert all(len(s.text) <= 1000 for s in segments)
    # شناسه‌ها قطعی و یکتا هستند
    keys = [s.segment_key for s in segments]
    assert len(keys) == len(set(keys))


def test_script_to_speech_text_orders_parts():
    script = Script(
        show_name="X", date="2026-01-01", intro="مقدمه",
        segments=[Segment(headline="تیتر", body="متن")], outro="پایان",
    )
    text = script.to_speech_text()
    assert text.index("مقدمه") < text.index("تیتر") < text.index("متن") < text.index("پایان")


def test_basic_checks_flags_empty_segment():
    script = Script(show_name="X", date="d", segments=[Segment(headline="", body="ok")])
    issues = _basic_checks(script)
    assert any("تیتر" in i for i in issues)
