"""تست‌های فاز C/H: مدل Story، Tier، وضعیت، امتیاز و سه خروجی."""

from datetime import datetime, timezone

from footcast.models import NewsItem
from footcast.outputs import build_qa_report, build_show_notes
from footcast.story import (
    OFFICIAL,
    RUMOR,
    TIER_1_OFFICIAL,
    TIER_2_RELIABLE,
    build_stories,
    compute_final_score,
    infer_status,
    merge_duplicates,
    select_for_episode,
    story_from_news,
    tier_from_weight,
)


def _item(title, summary="", weight=8, region="iran", hours=1, score=20.0):
    it = NewsItem(
        title=title, summary=summary, source="منبع", source_weight=weight,
        region=region, score=score,
        published=datetime.now(tz=timezone.utc),
    )
    return it


def test_tier_from_weight():
    assert tier_from_weight(9) == TIER_2_RELIABLE
    assert tier_from_weight(5) == "TIER_4_AGGREGATOR"
    assert tier_from_weight(5, is_official=True) == TIER_1_OFFICIAL


def test_infer_status_rumor_and_denied():
    assert infer_status("شایعه انتقال بازیکن", TIER_2_RELIABLE) == RUMOR
    assert infer_status("باشگاه خبر را تکذیب کرد", TIER_1_OFFICIAL) == "DENIED"


def test_regular_news_is_reported_not_rumor():
    # خبر عادی از خبرگزاری/خبرنگار نباید پیش‌فرض «شایعه» شود
    assert infer_status("استقلال منتظر رأی کمیته انضباطی است", TIER_2_RELIABLE) == "REPORTED_AGREEMENT"
    assert infer_status("باشگاه بازیکن را در فهرست گذاشت", "TIER_3_JOURNALIST") == "REPORTED_AGREEMENT"


def test_transfer_talks_detected():
    assert infer_status("بارسلونا در آستانه جذب هافبک", TIER_2_RELIABLE) == "ADVANCED_TALKS"
    assert infer_status("مذاکره برای انتقال بازیکن", TIER_2_RELIABLE) == "ADVANCED_TALKS"


def test_infer_status_official_requires_tier1():
    assert infer_status("باشگاه رسما اعلام کرد", TIER_1_OFFICIAL) == OFFICIAL
    # همان متن با Tier پایین‌تر رسمی محسوب نمی‌شود
    assert infer_status("باشگاه رسما اعلام کرد", TIER_2_RELIABLE) != OFFICIAL


def test_final_score_formula():
    s = story_from_news(_item("خبر"), 1)
    s.importance = 5; s.audience_relevance = 5; s.freshness = 5
    s.credibility = 5; s.narrative_value = 5
    assert compute_final_score(s) == 5.0


def test_merge_duplicates_combines_sources():
    a = story_from_news(_item("پرسپولیس قهرمان لیگ برتر شد"), 1)
    b = story_from_news(_item("پرسپولیس قهرمان لیگ برتر شد"), 2)
    b.secondary_sources[0].url = "http://other"
    merged = merge_duplicates([a, b])
    assert len(merged) == 1
    assert merged[0].source_count >= 2


def test_build_stories_dedup():
    items = [
        _item("استقلال بازیکن جدید جذب کرد"),
        _item("استقلال بازیکن جدید جذب کرد"),  # تکراری
        _item("سپاهان سرمربی جدید معرفی کرد"),
    ]
    stories = build_stories(items)
    assert len(stories) == 2


def test_select_for_episode_assigns_sections():
    items = [_item(f"خبر مهم شماره {i}", score=30 - i) for i in range(6)]
    stories = select_for_episode(build_stories(items))
    sections = {s.section for s in stories if s.used_in_episode}
    assert "MAIN_STORY" in sections


def test_low_credibility_not_in_main():
    weak = story_from_news(_item("خبر ضعیف", weight=3), 1)
    weak.credibility = 2
    weak.status = "REPORTED_AGREEMENT"
    result = select_for_episode([weak])
    assert result[0].section != "MAIN_STORY"


def test_show_notes_lists_sources():
    stories = select_for_episode(build_stories([_item("پرسپولیس برد", "خلاصه")]))
    notes = build_show_notes(stories, "فوت‌کست", "2026-07-15")
    assert "شونوت" in notes and "منبع اصلی" in notes


def test_qa_report_flags_english():
    stories = select_for_episode(build_stories([_item("خبر")]))
    qa = build_qa_report(stories, "این متن دارای Real Madrid است", [])
    assert "Real" in qa["unwantedEnglishTokens"]
    assert qa["readyToPublish"] is False


def test_qa_report_word_count():
    stories = select_for_episode(build_stories([_item("خبر")]))
    qa = build_qa_report(stories, "یک دو سه چهار پنج", [])
    assert qa["wordCount"] == 5
