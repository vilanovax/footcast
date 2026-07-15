"""تست‌های هویت ثابت برنامه (شروع و پایان)."""

from datetime import datetime, timezone

from footcast.branding import apply_branding, build_intro, build_outro
from footcast.config import ContentConfig
from footcast.models import NewsItem, Script, Segment
from footcast.persian_date import format_persian_date, gregorian_to_jalali
from footcast.story import build_stories, select_for_episode


def _stories(titles):
    items = [NewsItem(title=t, source="s", source_weight=8, region="iran", score=30 - i)
             for i, t in enumerate(titles)]
    return select_for_episode(build_stories(items))


def test_jalali_conversion_known_date():
    assert gregorian_to_jalali(2026, 7, 15) == (1405, 4, 24)


def test_format_date_has_weekday_and_month():
    dt = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    out = format_persian_date(dt)
    assert "تیر" in out
    assert "،" in out  # روز هفته + تاریخ


def test_format_date_default_omits_year():
    dt = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    # سال به‌صورت پیش‌فرض گفته نمی‌شود (انتشار روزانه)
    assert "هزار" not in format_persian_date(dt)


def test_intro_contains_host_and_signature():
    cfg = ContentConfig()
    dt = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    stories = _stories([
        "پرسپولیس در فینال به پیروزی رسید",
        "استقلال منتظر رأی کمیته انضباطی است",
        "تیم ملی اردوی آماده‌سازی برگزار کرد",
    ])
    intro = build_intro(stories, dt, cfg)
    assert "ساشا" in intro
    assert "همراه شما هستم" in intro
    assert "سه موضوع اصلی" in intro


def test_outro_contains_signature_and_question():
    cfg = ContentConfig()
    outro = build_outro("آیا این تیم قهرمان می‌شود؟", cfg)
    assert "لباس خبر پوشیده" in outro
    assert "مراقب خودتان باشید" in outro
    assert "سؤال امروز" in outro


def test_outro_without_question_still_has_signature():
    cfg = ContentConfig()
    outro = build_outro("", cfg)
    assert "مراقب خودتان باشید" in outro
    assert "سؤال امروز" not in outro


def test_apply_branding_replaces_intro_outro():
    cfg = ContentConfig()
    dt = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    stories = _stories(["پرسپولیس برد", "استقلال باخت", "سپاهان مساوی کرد"])
    script = Script(show_name="x", date="d", intro="قدیمی", outro="قدیمی",
                    question="سؤال؟", segments=[Segment(headline="ت", body="م")])
    apply_branding(script, stories, dt, cfg)
    assert "ساشا" in script.intro
    assert "مراقب خودتان باشید" in script.outro


def test_custom_host_name():
    cfg = ContentConfig(host_name="رضا")
    outro = build_outro("", cfg)
    assert "رضا" in outro
