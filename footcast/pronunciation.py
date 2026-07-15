"""فرهنگ تلفظ و پردازشگر آن.

پیش از ارسال هر بخش به TTS، نام‌های شناخته‌شده با شکل «قابل‌تلفظ» جایگزین می‌شوند
و نام‌های ناشناخته‌ی لاتین به‌عنوان هشدار گزارش می‌شوند.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .config import ROOT

DEFAULT_PRONUNCIATION_PATH = ROOT / "config" / "pronunciation.yaml"

# رشته‌ای که حداقل یک حرف لاتین دارد (نامزد نام خارجیِ بدون تلفظ)
_LATIN_TOKEN = re.compile(r"[A-Za-z][A-Za-z'’.\-]*")


@dataclass
class PronunciationEntry:
    original: str
    display_fa: str
    tts_fa: str
    entity: str = "TERM"
    verified: bool = False


@dataclass
class PronunciationResult:
    text: str
    warnings: list[str] = field(default_factory=list)  # نام‌های ناشناخته
    unverified: list[str] = field(default_factory=list)  # موجود ولی تأییدنشده


class PronunciationDictionary:
    def __init__(self, entries: list[PronunciationEntry]):
        # مرتب‌سازی بر اساس طول original (بلندترها اول) تا "Real Madrid" قبل از "Real" جایگزین شود
        self.entries = sorted(entries, key=lambda e: len(e.original), reverse=True)

    @classmethod
    def load(
        cls,
        path: str | Path = DEFAULT_PRONUNCIATION_PATH,
        include_glossary: bool = True,
    ) -> "PronunciationDictionary":
        path = Path(path)
        entries: list[PronunciationEntry] = []
        if path.exists():
            raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            entries = [
                PronunciationEntry(
                    original=e["original"],
                    display_fa=e.get("display_fa", e["original"]),
                    tts_fa=e.get("tts_fa", e.get("display_fa", e["original"])),
                    entity=e.get("entity", "TERM"),
                    verified=bool(e.get("verified", False)),
                )
                for e in raw.get("entries", [])
            ]

        # اصطلاحات فوتبالی و تلفظ آن‌ها (فرهنگ واژگان)
        if include_glossary:
            try:
                from .glossary import load_glossary

                entries.extend(load_glossary().pronunciation_entries())
            except Exception:  # noqa: BLE001 - نبود فرهنگ نباید مانع شود
                pass

        return cls(entries)

    def apply(self, text: str) -> PronunciationResult:
        """نام‌های شناخته‌شده را جایگزین و ناشناخته‌ها را گزارش می‌کند."""
        warnings: list[str] = []
        unverified: list[str] = []

        for entry in self.entries:
            if entry.original in text:
                text = text.replace(entry.original, entry.tts_fa)
                if not entry.verified:
                    unverified.append(entry.original)

        # هر رشته لاتین باقی‌مانده = نام ناشناخته
        for match in _LATIN_TOKEN.finditer(text):
            token = match.group(0)
            if len(token) >= 2:  # از حروف تکی صرف‌نظر کن
                warnings.append(token)

        # حذف تکراری‌ها با حفظ ترتیب
        warnings = list(dict.fromkeys(warnings))
        unverified = list(dict.fromkeys(unverified))
        return PronunciationResult(text=text, warnings=warnings, unverified=unverified)
