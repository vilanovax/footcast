"""تست‌های ساختار فرمت اپیزود: بخش‌بندی منطقه‌ای، دماسنج شایعات، قلاب سرد."""

from datetime import datetime, timezone

from footcast.branding import apply_branding
from footcast.config import ContentConfig
from footcast.models import NewsItem, Script, Segment
from footcast.story import (
    IRAN_FOOTBALL,
    MAIN_STORY,
    RUMOR_RADAR,
    WORLD_ROUNDUP,
    build_stories,
    heat_for,
    select_for_episode,
    story_from_news,
)


def _item(title, region="iran", weight=8, score=20.0, summary=""):
    return NewsItem(title=title, summary=summary, source="s", source_weight=weight,
                    region=region, score=score,
                    published=datetime.now(tz=timezone.utc))


# --- دماسنج شایعات (§۷) ---
def test_heat_scale_mapping():
    assert heat_for("RUMOR") == 1
    assert heat_for("OFFICIAL_BID") == 3
    assert heat_for("REPORTED_AGREEMENT") == 4
    assert heat_for("OFFICIAL") == 5


def test_story_gets_heat():
    s = story_from_news(_item("شایعه انتقال بازیکن"), 1)
    assert 1 <= s.heat <= 5


# --- بخش‌بندی منطقه‌ای (§۴/§۵) ---
def test_iran_and_world_sections_assigned():
    items = [
        _item("خبر بزرگ داستان اصلی امروز", region="iran", score=40),
        _item("خبر مهم استقلال در تهران", region="iran", score=30),
        _item("رئال مادرید در لالیگا برد", region="europe", score=28),
        _item("بارسلونا قرارداد بست", region="europe", score=26),
    ]
    stories = select_for_episode(build_stories(items))
    sections = {s.section for s in stories if s.used_in_episode}
    assert MAIN_STORY in sections
    assert IRAN_FOOTBALL in sections
    assert WORLD_ROUNDUP in sections


def test_world_section_capped():
    items = [_item("داستان اصلی", region="iran", score=40)]
    items += [_item(f"خبر اروپا شماره {i}", region="europe", score=30 - i) for i in range(6)]
    stories = select_for_episode(build_stories(items), max_world=3)
    world = [s for s in stories if s.section == WORLD_ROUNDUP]
    assert len(world) <= 3


def test_rumor_goes_to_radar():
    items = [
        _item("خبر رسمی داستان اصلی", region="iran", score=40),
        _item("شایعه انتقال یک بازیکن به استقلال", region="iran", score=25),
    ]
    stories = select_for_episode(build_stories(items))
    rumor = [s for s in stories if s.section == RUMOR_RADAR]
    assert len(rumor) >= 1
    assert all(1 <= s.heat <= 5 for s in rumor)


# --- قلاب سرد (§۱) ---
def test_cold_hook_prepended_to_intro():
    cfg = ContentConfig()
    dt = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    stories = select_for_episode(build_stories([_item("پرسپولیس برد", region="iran")]))
    script = Script(show_name="x", date="d", cold_hook="آیا این تیم واقعا قهرمان می‌شود؟",
                    segments=[Segment(headline="ت", body="م")])
    apply_branding(script, stories, dt, cfg)
    assert script.intro.startswith("آیا این تیم واقعا قهرمان می‌شود؟")
    assert "ساشا" in script.intro


def test_no_cold_hook_still_valid_intro():
    cfg = ContentConfig()
    dt = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    stories = select_for_episode(build_stories([_item("خبر", region="iran")]))
    script = Script(show_name="x", date="d", segments=[Segment(headline="ت", body="م")])
    apply_branding(script, stories, dt, cfg)
    assert script.intro.startswith("سلام. من ساشا")
