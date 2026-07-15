"""تولید «متن پاک TTS» طبق قوانین Pass 3 سند تحریریه.

هدف: متنی که به ElevenLabs داده می‌شود نباید Markdown، URL، عدد رقمی،
یا نویسه‌های لاتین ناخواسته داشته باشد. اعداد و نتایج و ساعت‌ها به‌صورت
گفتاری نوشته شوند.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .persian_num import normalize_digits, number_to_words
from .pronunciation import PronunciationDictionary, PronunciationResult

# --- الگوها ---
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")          # [متن](url) → متن
_URL = re.compile(r"https?://\S+|www\.\S+")
_MD_EMPHASIS = re.compile(r"[*_`#>]+")
_PAREN_LATIN = re.compile(r"\s*\(([^)]*[A-Za-z][^)]*)\)")  # (English) → حذف
_MULTISPACE = re.compile(r"[ \t]+")
_MULTINEWLINE = re.compile(r"\n{3,}")

# نتیجه مسابقه: 2-1 یا ۲–۱ → «دو بر یک»
_SCORE = re.compile(r"(?<!\d)(\d{1,2})\s*[-–:]\s*(\d{1,2})(?!\d)")
# ساعت: 17:30
_TIME = re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)")
# عدد صحیح یا اعشاری مستقل
_NUMBER = re.compile(r"(?<![\w])\d+(?:\.\d+)?(?![\w])")


@dataclass
class CleanResult:
    text: str
    pronunciation_warnings: list[str] = field(default_factory=list)
    unverified_names: list[str] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)


def _strip_markup(text: str) -> str:
    text = _MD_LINK.sub(r"\1", text)
    text = _URL.sub("", text)
    text = _PAREN_LATIN.sub("", text)
    text = _MD_EMPHASIS.sub("", text)
    return text


def _time_to_words(match: re.Match) -> str:
    hour = int(match.group(1))
    minute = int(match.group(2))
    hour_w = number_to_words(str(hour))
    if minute == 0:
        return f"ساعت {hour_w}"
    if minute == 30:
        return f"ساعت {hour_w} و نیم"
    return f"ساعت {hour_w} و {number_to_words(str(minute))} دقیقه"


def _score_to_words(match: re.Match) -> str:
    a = number_to_words(match.group(1))
    b = number_to_words(match.group(2))
    return f"{a} بر {b}"


def _numbers_to_words(text: str) -> str:
    text = normalize_digits(text)
    text = _TIME.sub(_time_to_words, text)
    text = _SCORE.sub(_score_to_words, text)
    text = _NUMBER.sub(lambda m: number_to_words(m.group(0)), text)
    return text


def clean_for_tts(
    text: str,
    pronunciation: PronunciationDictionary | None = None,
    max_sentence_words: int = 25,
) -> CleanResult:
    """متن خام را به متن پاک آماده گفتار تبدیل می‌کند."""
    issues: list[str] = []

    text = _strip_markup(text)
    text = _numbers_to_words(text)

    # اعمال فرهنگ تلفظ (پس از حذف نویسه‌های لاتین ناخواسته، باقی‌مانده‌ها بررسی می‌شوند)
    warnings: list[str] = []
    unverified: list[str] = []
    if pronunciation is not None:
        res: PronunciationResult = pronunciation.apply(text)
        text = res.text
        warnings = res.warnings
        unverified = res.unverified

    # نرمال‌سازی فاصله‌ها
    text = _MULTISPACE.sub(" ", text)
    text = _MULTINEWLINE.sub("\n\n", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    text = text.strip()

    # --- کنترل‌های Pass 3 (فقط گزارش، بدون تغییر خودکار) ---
    if re.search(r"\d", text):
        issues.append("هنوز عدد رقمی در متن TTS باقی مانده است.")
    if _URL.search(text):
        issues.append("URL در متن TTS باقی مانده است.")
    if re.search(r"[*_`#]", text):
        issues.append("نشانه Markdown در متن TTS باقی مانده است.")
    if warnings:
        issues.append(f"نام(های) بدون تلفظ مشخص: {', '.join(warnings)}")

    # جمله‌های بیش از حد بلند
    for sentence in re.split(r"[.!?؟\n]+", text):
        wc = len(sentence.split())
        if wc > max_sentence_words:
            issues.append(f"جمله بیش از {max_sentence_words} کلمه: «{sentence.strip()[:40]}...»")

    return CleanResult(
        text=text,
        pronunciation_warnings=warnings,
        unverified_names=unverified,
        issues=issues,
    )
