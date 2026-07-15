"""مقایسه متن ASR با متن تأییدشده (کنترل کیفیت صوت).

ASR متن را خودکار اصلاح نمی‌کند؛ فقط گزارش اختلاف می‌سازد تا انسان تصمیم بگیرد.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field

from .persian_num import normalize_digits

# --- انواع و سطوح اختلاف ---
NAME_PRONUNCIATION = "NAME_PRONUNCIATION"
NUMBER_MISMATCH = "NUMBER_MISMATCH"
WORD_OMISSION = "WORD_OMISSION"
WORD_INSERTION = "WORD_INSERTION"
PHRASE_SUBSTITUTION = "PHRASE_SUBSTITUTION"
SECTION_MISSING = "SECTION_MISSING"

BLOCKER = "BLOCKER"
MAJOR = "MAJOR"
MINOR = "MINOR"
INFO = "INFO"

_PUNCT = re.compile(r"[.،,؛;:!؟?\"'«»()\-—…]")
_DIACRITICS = re.compile(r"[ً-ْٰ]")
_WS = re.compile(r"\s+")

# اعداد به حروف فارسی که «عددی» محسوب می‌شوند (برای تشخیص NUMBER_MISMATCH)
_NUMBER_WORDS = {
    "صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده",
    "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده",
    "نوزده", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود",
    "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد",
    "هزار", "میلیون", "میلیارد", "بر", "نیم",
}


@dataclass
class DiffItem:
    type: str
    severity: str
    approved: str = ""
    heard: str = ""


@dataclass
class AsrDiffReport:
    match_ratio: float = 0.0
    items: list[DiffItem] = field(default_factory=list)
    blocker_count: int = 0
    major_count: int = 0

    def to_dict(self) -> dict:
        return {
            "matchRatio": round(self.match_ratio, 3),
            "blockerCount": self.blocker_count,
            "majorCount": self.major_count,
            "items": [
                {"type": i.type, "severity": i.severity,
                 "approved": i.approved, "heard": i.heard}
                for i in self.items
            ],
        }


def normalize_persian(text: str) -> str:
    """نرمال‌سازی برای مقایسه: یکسان‌سازی ی/ک، حذف اعراب، نشانه‌گذاری، نیم‌فاصله."""
    text = normalize_digits(text)
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = text.replace("‌", " ")  # نیم‌فاصله → فاصله
    text = _DIACRITICS.sub("", text)
    text = _PUNCT.sub(" ", text)
    text = _WS.sub(" ", text)
    return text.strip()


def _tokens(text: str) -> list[str]:
    return normalize_persian(text).split()


def _is_number_word(tok: str) -> bool:
    return tok in _NUMBER_WORDS or tok.isdigit()


def _classify_replace(a_tokens: list[str], b_tokens: list[str]) -> DiffItem:
    a = " ".join(a_tokens)
    b = " ".join(b_tokens)
    if any(_is_number_word(t) for t in a_tokens + b_tokens):
        return DiffItem(NUMBER_MISMATCH, BLOCKER, a, b)
    # جایگزینی تک‌کلمه‌ای مشابه = احتمال خطای تلفظ نام
    if len(a_tokens) == 1 and len(b_tokens) == 1:
        return DiffItem(NAME_PRONUNCIATION, MAJOR, a, b)
    return DiffItem(PHRASE_SUBSTITUTION, MAJOR, a, b)


def diff_asr(approved_text: str, asr_text: str) -> AsrDiffReport:
    """اختلاف متن تأییدشده و متن ASR را دسته‌بندی می‌کند."""
    a = _tokens(approved_text)
    b = _tokens(asr_text)
    report = AsrDiffReport()

    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    report.match_ratio = matcher.ratio()

    # اگر ASR تقریباً خالی باشد ولی متن تأییدشده پرمحتوا → بخش حذف‌شده
    if a and not b:
        report.items.append(DiffItem(SECTION_MISSING, BLOCKER, " ".join(a[:8]) + " ...", ""))
        report.blocker_count = 1
        return report

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        if tag == "replace":
            item = _classify_replace(a[i1:i2], b[j1:j2])
        elif tag == "delete":
            seg = a[i1:i2]
            sev = BLOCKER if len(seg) >= 5 else (MAJOR if any(_is_number_word(t) for t in seg) else MINOR)
            typ = SECTION_MISSING if len(seg) >= 5 else WORD_OMISSION
            item = DiffItem(typ, sev, " ".join(seg), "")
        elif tag == "insert":
            seg = b[j1:j2]
            item = DiffItem(WORD_INSERTION, MINOR, "", " ".join(seg))
        else:
            continue
        report.items.append(item)

    report.blocker_count = sum(1 for i in report.items if i.severity == BLOCKER)
    report.major_count = sum(1 for i in report.items if i.severity == MAJOR)
    return report
