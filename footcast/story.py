"""مدل دامنه Story و اعتبارسنجی تحریریه (استاندارد تحریریه، بخش‌های ۴، ۵، ۸، ۱۹).

یک Story یک «رویداد خبری» است که ممکن است از چند منبع ساخته شده باشد. همه
خروجی‌های نهایی (متن اجرا، شونوت، کنترل کیفیت) باید از همین لایه ساخته شوند
تا میان آن‌ها تناقض نباشد.
"""

from __future__ import annotations

import difflib
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .models import NewsItem

# ---------------------------------------------------------------------------
# سلسله‌مراتب منابع (§۴)
# ---------------------------------------------------------------------------
TIER_1_OFFICIAL = "TIER_1_OFFICIAL"   # باشگاه، فدراسیون، لیگ، فیفا، یوفا
TIER_2_RELIABLE = "TIER_2_RELIABLE"   # خبرگزاری‌های معتبر
TIER_3_JOURNALIST = "TIER_3_JOURNALIST"  # خبرنگاران معتبر
TIER_4_AGGREGATOR = "TIER_4_AGGREGATOR"  # تجمیع‌کننده/غیررسمی


def tier_from_weight(weight: int, is_official: bool = False) -> str:
    """در نبود Tier صریح، از وزن منبع تخمین می‌زند."""
    if is_official:
        return TIER_1_OFFICIAL
    if weight >= 8:
        return TIER_2_RELIABLE
    if weight >= 6:
        return TIER_3_JOURNALIST
    return TIER_4_AGGREGATOR


# ---------------------------------------------------------------------------
# وضعیت استاندارد خبر (§۵)
# ---------------------------------------------------------------------------
OFFICIAL = "OFFICIAL"                 # رسمی
DIRECT_QUOTE = "DIRECT_QUOTE"         # نقل‌قول مستقیم
REPORTED_AGREEMENT = "REPORTED_AGREEMENT"  # توافق گزارش‌شده
ADVANCED_TALKS = "ADVANCED_TALKS"     # مذاکره پیشرفته
OFFICIAL_BID = "OFFICIAL_BID"         # پیشنهاد رسمی
UNDER_REVIEW = "UNDER_REVIEW"         # در حال بررسی
CONFLICTING = "CONFLICTING"           # گزارش‌های متناقض
RUMOR = "RUMOR"                       # شایعه
DENIED = "DENIED"                     # تکذیب‌شده

STATUS_FA = {
    OFFICIAL: "رسمی",
    DIRECT_QUOTE: "نقل‌قول مستقیم",
    REPORTED_AGREEMENT: "توافق گزارش‌شده",
    ADVANCED_TALKS: "مذاکره پیشرفته",
    OFFICIAL_BID: "پیشنهاد رسمی",
    UNDER_REVIEW: "در حال بررسی",
    CONFLICTING: "گزارش‌های متناقض",
    RUMOR: "شایعه",
    DENIED: "تکذیب‌شده",
}

# کلمات کلیدی برای تخمین وضعیت از متن خبر
_OFFICIAL_MARKERS = ["رسما", "رسماً", "رسمی شد", "official", "confirmed", "announce"]
_RUMOR_MARKERS = ["شایعه", "احتمال", "گمانه", "rumour", "rumor", "reportedly", "linked"]
_DENIED_MARKERS = ["تکذیب", "رد کرد", "denied", "denies"]
_QUOTE_MARKERS = ["گفت:", "اظهار", "مصاحبه", "said:", "told"]

# بخش‌های اپیزود (§۹)
MAIN_STORY = "MAIN_STORY"
KEY_NEWS = "KEY_NEWS"
RUMOR_RADAR = "RUMOR_RADAR"
STAT = "STAT"
CALENDAR = "CALENDAR"
UNUSED = "UNUSED"


class StorySource(BaseModel):
    name: str
    url: str = ""
    tier: str = TIER_3_JOURNALIST


class StoryFacts(BaseModel):
    score: Optional[str] = None
    transfer_fee: Optional[str] = None
    contract_length: Optional[str] = None
    match_time_utc: Optional[str] = None
    match_time_tehran: Optional[str] = None


class Story(BaseModel):
    """یک رویداد خبری تأییدشده (مطابق §۱۹)."""

    id: str
    title: str
    category: str = "GENERAL"
    region: str = "world"
    status: str = REPORTED_AGREEMENT

    official_source: Optional[StorySource] = None
    secondary_sources: list[StorySource] = Field(default_factory=list)

    published_at: Optional[str] = None
    event_at: Optional[str] = None
    retrieved_at: Optional[str] = None

    facts: StoryFacts = Field(default_factory=StoryFacts)

    # امتیازها (۱ تا ۵)
    importance: int = 3
    audience_relevance: int = 3
    freshness: int = 3
    credibility: int = 3
    narrative_value: int = 3
    final_score: float = 0.0

    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    used_in_episode: bool = False
    section: str = UNUSED
    drop_reason: str = ""

    summary: str = ""
    why_it_matters: str = ""
    spoken_version: str = ""
    editorial_notes: str = ""

    @property
    def all_sources(self) -> list[StorySource]:
        s = [self.official_source] if self.official_source else []
        return s + self.secondary_sources

    @property
    def source_count(self) -> int:
        return len(self.all_sources)


# ---------------------------------------------------------------------------
# ساخت Story از خبر خام
# ---------------------------------------------------------------------------
def _contains_any(text: str, markers: list[str]) -> bool:
    low = text.lower()
    return any(m.lower() in low for m in markers)


def infer_status(text: str, tier: str) -> str:
    """وضعیت خبر را از متن و Tier منبع تخمین می‌زند (محافظه‌کارانه)."""
    if _contains_any(text, _DENIED_MARKERS):
        return DENIED
    if _contains_any(text, _OFFICIAL_MARKERS) and tier == TIER_1_OFFICIAL:
        return OFFICIAL
    if _contains_any(text, _QUOTE_MARKERS):
        return DIRECT_QUOTE
    if _contains_any(text, _RUMOR_MARKERS):
        return RUMOR
    if tier == TIER_1_OFFICIAL:
        return OFFICIAL
    if tier in (TIER_2_RELIABLE,):
        return REPORTED_AGREEMENT
    return RUMOR


def _credibility_from(tier: str, source_count: int) -> int:
    """اعتبار ۱ تا ۵ بر اساس Tier و تعداد منابع مستقل."""
    base = {TIER_1_OFFICIAL: 5, TIER_2_RELIABLE: 4, TIER_3_JOURNALIST: 3,
            TIER_4_AGGREGATOR: 2}.get(tier, 2)
    if source_count >= 2:
        base = min(base + 1, 5)
    return base


def _score_1_5(value_0_10: float) -> int:
    return max(1, min(5, round(value_0_10 / 2)))


def compute_final_score(story: Story) -> float:
    """فرمول §۸ (۰ تا ۵ در هر معیار → امتیاز نهایی ۰ تا ۵)."""
    return round(
        story.importance * 0.30
        + story.audience_relevance * 0.25
        + story.freshness * 0.15
        + story.credibility * 0.20
        + story.narrative_value * 0.10,
        3,
    )


_VALID_TIERS = {TIER_1_OFFICIAL, TIER_2_RELIABLE, TIER_3_JOURNALIST, TIER_4_AGGREGATOR}


def story_from_news(item: NewsItem, index: int, is_official: bool | None = None) -> Story:
    """یک Story از یک NewsItem می‌سازد."""
    now = datetime.now(tz=timezone.utc).isoformat()
    official = item.is_official if is_official is None else is_official
    # Tier صریح از کانفیگ در اولویت است؛ وگرنه از وزن تخمین زده می‌شود
    if item.source_tier in _VALID_TIERS:
        tier = item.source_tier
    else:
        tier = tier_from_weight(item.source_weight, official)
    text = f"{item.title} {item.summary}"
    status = infer_status(text, tier)

    source = StorySource(name=item.source, url=item.link, tier=tier)
    story = Story(
        id=f"story-{index:03d}",
        title=item.title,
        summary=item.summary,
        region=item.region,
        status=status,
        official_source=source if tier == TIER_1_OFFICIAL else None,
        secondary_sources=[] if tier == TIER_1_OFFICIAL else [source],
        published_at=item.published.isoformat() if item.published else None,
        retrieved_at=now,
    )
    # امتیازها
    story.credibility = _credibility_from(tier, story.source_count)
    # از امتیاز انتخاب قبلی (۰ تا ~۳۰) اهمیت/تازگی را تخمین می‌زنیم
    story.importance = _score_1_5(min(item.score / 3.0, 10))
    story.audience_relevance = 4 if item.region == "iran" else 3
    story.freshness = 5 if item.published else 3
    story.narrative_value = 3
    story.final_score = compute_final_score(story)
    return story


# ---------------------------------------------------------------------------
# ادغام خبر تکراری بر اساس رویداد (§۷)
# ---------------------------------------------------------------------------
_STOP = {"در", "به", "از", "را", "با", "و", "که", "این", "برای", "شد", "کرد"}


def _title_tokens(title: str) -> set[str]:
    words = re.findall(r"[\w؀-ۿ]+", title.lower())
    return {w for w in words if w not in _STOP and len(w) > 2}


def _same_event(a: Story, b: Story, threshold: float = 0.6) -> bool:
    ratio = difflib.SequenceMatcher(a=a.title.lower(), b=b.title.lower()).ratio()
    if ratio >= 0.85:
        return True
    overlap = _title_tokens(a.title) & _title_tokens(b.title)
    return ratio >= threshold and len(overlap) >= 2


def merge_duplicates(stories: list[Story]) -> list[Story]:
    """Storyهای مربوط به یک رویداد را ادغام می‌کند و منابع را به هم می‌چسباند."""
    merged: list[Story] = []
    for story in stories:
        target = next((m for m in merged if _same_event(m, story)), None)
        if target is None:
            merged.append(story)
            continue
        # منابع را اضافه کن
        for src in story.all_sources:
            if all(s.url != src.url for s in target.all_sources):
                if src.tier == TIER_1_OFFICIAL and target.official_source is None:
                    target.official_source = src
                else:
                    target.secondary_sources.append(src)
        story.is_duplicate = True
        story.duplicate_of = target.id
        # اعتبار و وضعیت را به‌روزرسانی کن
        target.credibility = _credibility_from(
            target.official_source.tier if target.official_source else TIER_2_RELIABLE,
            target.source_count,
        )
        if target.official_source and target.status not in (OFFICIAL, DENIED):
            target.status = OFFICIAL
        target.final_score = compute_final_score(target)
    return merged


def build_stories(items: list[NewsItem]) -> list[Story]:
    """از فهرست اخبار، Storyهای یکتا (ادغام‌شده) می‌سازد."""
    raw = [story_from_news(it, i + 1) for i, it in enumerate(items)]
    return merge_duplicates(raw)


# ---------------------------------------------------------------------------
# انتخاب و بخش‌بندی اپیزود (§۹)
# ---------------------------------------------------------------------------
_RUMOR_STATUSES = {RUMOR, ADVANCED_TALKS, OFFICIAL_BID, CONFLICTING}


def select_for_episode(
    stories: list[Story],
    max_key_news: int = 4,
    max_rumors: int = 2,
    min_credibility_main: int = 3,
) -> list[Story]:
    """به Storyها بخش (section) اختصاص می‌دهد و used_in_episode را تعیین می‌کند.

    قواعد §۸ و §۹: اعتبار کمتر از ۳ وارد بخش اصلی نمی‌شود؛ فقط شایعه مهم در
    «رادار شایعات» با معرفی صریح مجاز است.
    """
    ordered = sorted(stories, key=lambda s: s.final_score, reverse=True)

    main_pool = [s for s in ordered if s.credibility >= min_credibility_main
                 and s.status not in _RUMOR_STATUSES]
    rumor_pool = [s for s in ordered if s.status in _RUMOR_STATUSES]

    used_ids: set[str] = set()

    # داستان اصلی
    if main_pool:
        top = main_pool[0]
        top.section = MAIN_STORY
        top.used_in_episode = True
        used_ids.add(top.id)

    # محورهای مهم
    for s in main_pool[1 : 1 + max_key_news]:
        s.section = KEY_NEWS
        s.used_in_episode = True
        used_ids.add(s.id)

    # رادار شایعات (فقط شایعه‌های مهم)
    for s in rumor_pool[:max_rumors]:
        if s.id in used_ids:
            continue
        s.section = RUMOR_RADAR
        s.used_in_episode = True
        used_ids.add(s.id)

    # بقیه: استفاده‌نشده با دلیل
    for s in ordered:
        if s.id in used_ids:
            continue
        s.section = UNUSED
        s.used_in_episode = False
        if s.credibility < min_credibility_main and s.status not in _RUMOR_STATUSES:
            s.drop_reason = "اعتبار کمتر از حد لازم برای بخش اصلی."
        else:
            s.drop_reason = "اهمیت کمتر نسبت به خبرهای منتخب."

    return ordered
