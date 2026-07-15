"""سه خروجی هماهنگ از یک selectedStories مشترک (§۱۸، §۲۱).

1) متن اجرای پادکست  → از review/tts_clean (ماژول‌های موجود)
2) شونوت و منابع     → build_show_notes
3) گزارش کنترل کیفیت → build_qa_report

هدف: هر سه از همان لایه Story ساخته شوند تا تناقض نداشته باشند.
"""

from __future__ import annotations

import re

from .story import STATUS_FA, Story

# محدوده کلمه بر دقیقه اجرای فارسی (§۲۰)
WORDS_PER_MINUTE = 140


# ---------------------------------------------------------------------------
# خروجی دوم: شونوت و منابع (§۱۸)
# ---------------------------------------------------------------------------
def build_show_notes(stories: list[Story], show_name: str, date: str) -> str:
    """جدول شونوت با منابع، وضعیت، زمان‌ها و درجه اطمینان برای هر خبر."""
    lines = [f"# شونوت — {show_name}", f"تاریخ: {date}", ""]

    used = [s for s in stories if s.used_in_episode]
    unused = [s for s in stories if not s.used_in_episode]

    lines.append("## خبرهای استفاده‌شده در اپیزود")
    lines.append("")
    lines.append("| خبر | وضعیت | منبع اصلی | منبع تأییدکننده | اطمینان | بخش |")
    lines.append("|-----|-------|-----------|-----------------|---------|-----|")
    for s in used:
        if s.official_source:
            primary = s.official_source.name
            secondary_list = s.secondary_sources[:2]
        elif s.secondary_sources:
            primary = s.secondary_sources[0].name
            secondary_list = s.secondary_sources[1:3]
        else:
            primary = "-"
            secondary_list = []
        secondary = "، ".join(x.name for x in secondary_list) or "-"
        lines.append(
            f"| {s.title[:50]} | {STATUS_FA.get(s.status, s.status)} | {primary} "
            f"| {secondary} | {s.credibility}/5 | {s.section} |"
        )
    lines.append("")

    if unused:
        lines.append("## اخبار تکمیلی (در متن پادکست استفاده نشده)")
        lines.append("")
        for s in unused:
            lines.append(f"- {s.title[:60]} — دلیل: {s.drop_reason or 'انتخاب‌نشده'}")
        lines.append("")

    # فهرست کامل منابع
    lines.append("## منابع")
    lines.append("")
    for s in used:
        for src in s.all_sources:
            if src.url:
                lines.append(f"- [{src.name}]({src.url}) — {STATUS_FA.get(s.status, s.status)}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# خروجی سوم: گزارش کنترل کیفیت (§۲۱)
# ---------------------------------------------------------------------------
def build_qa_report(
    stories: list[Story],
    spoken_text: str,
    tts_issues: list[str],
    target_minutes: float = 11.0,
) -> dict:
    """گزارش کنترل کیفیت هماهنگ با استاندارد تحریریه."""
    used = [s for s in stories if s.used_in_episode]

    # ادعاهای بدون منبع
    unsourced = [s.title for s in used if s.source_count == 0]
    # خبرهای متناقض
    conflicting = [s.title for s in used if s.status == "CONFLICTING"]
    # خبرهای شایعه‌ای در بخش اصلی (نباید باشد)
    rumor_in_main = [
        s.title for s in used
        if s.section in ("MAIN_STORY", "KEY_NEWS") and s.status in ("RUMOR",)
    ]
    # خبرهای حذف‌شده
    dropped = [{"title": s.title, "reason": s.drop_reason}
               for s in stories if not s.used_in_episode]

    # طول متن (§۲۰)
    word_count = len(spoken_text.split())
    est_minutes = round(word_count / WORDS_PER_MINUTE, 1)
    target_words = int(target_minutes * WORDS_PER_MINUTE)
    length_delta_pct = round(abs(word_count - target_words) / max(target_words, 1) * 100, 1)

    # واژه‌های انگلیسی ناخواسته در متن اجرا
    latin = sorted(set(re.findall(r"[A-Za-z]{2,}", spoken_text)))

    checks = {
        "storyCount": len(used),
        "unsourcedClaims": unsourced,
        "conflictingSources": conflicting,
        "rumorInMainSection": rumor_in_main,
        "droppedStories": dropped,
        "wordCount": word_count,
        "estimatedMinutes": est_minutes,
        "targetMinutes": target_minutes,
        "lengthDeltaPercent": length_delta_pct,
        "unwantedEnglishTokens": latin,
        "ttsIssues": tts_issues,
    }

    # جمع‌بندی: آیا آماده انتشار است؟
    blockers = []
    if unsourced:
        blockers.append("ادعای بدون منبع در اپیزود.")
    if rumor_in_main:
        blockers.append("خبر شایعه‌ای در بخش اصلی.")
    if latin:
        blockers.append(f"واژه انگلیسی ناخواسته در متن اجرا: {', '.join(latin[:5])}")
    if length_delta_pct > 20:
        blockers.append(f"طول متن {length_delta_pct}% با هدف فاصله دارد.")

    checks["blockers"] = blockers
    checks["readyToPublish"] = len(blockers) == 0
    return checks
