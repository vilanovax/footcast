"""فرهنگ واژگان ثابت فوتبال — منبع واحد برای تحریریه و TTS.

سه نقش:
- normalize(): شکل مصنوعی/انگلیسی را به فارسی طبیعی تبدیل می‌کند (§۳)
- pronunciation_entries(): اصطلاحات جاافتاده + تلفظ TTS آن‌ها (§۱، §۷)
- explain_hints(): راهنمای «توضیح در اولین اشاره» برای پرامپت تولید (§۲)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .config import ROOT

DEFAULT_GLOSSARY_PATH = ROOT / "config" / "football_terms.yaml"


@dataclass
class KeepTerm:
    display: str
    tts: str
    aliases: list[str] = field(default_factory=list)


@dataclass
class Glossary:
    keep: list[KeepTerm] = field(default_factory=list)
    translate: dict[str, str] = field(default_factory=dict)
    explain: list[dict] = field(default_factory=list)

    # --- بارگذاری ---
    @classmethod
    def load(cls, path: str | Path = DEFAULT_GLOSSARY_PATH) -> "Glossary":
        path = Path(path)
        if not path.exists():
            return cls()
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        keep = [
            KeepTerm(
                display=k["display"],
                tts=k.get("tts", k["display"]),
                aliases=list(k.get("aliases", [])),
            )
            for k in raw.get("keep", [])
        ]
        return cls(
            keep=keep,
            translate=dict(raw.get("translate", {})),
            explain=list(raw.get("explain", [])),
        )

    # --- جایگزینی تحریریه (§۳) ---
    def normalize(self, text: str) -> str:
        """شکل‌های مصنوعی را با فارسی طبیعی جایگزین می‌کند (با مرز واژه)."""
        if not text:
            return text
        # بلندترها اول تا «کانتر اتک» پیش از «کانتر» جایگزین شود
        for src in sorted(self.translate, key=len, reverse=True):
            dst = self.translate[src]
            text = re.sub(rf"(?<!\w){re.escape(src)}(?!\w)", dst, text)
        return text

    # --- ورودی‌های تلفظ TTS (§۱، §۷) ---
    def pronunciation_entries(self):
        """فهرست ورودی‌های تلفظ برای تزریق به فرهنگ تلفظ."""
        from .pronunciation import PronunciationEntry

        entries = []
        for term in self.keep:
            # خودِ شکل نمایشی
            entries.append(PronunciationEntry(
                original=term.display, display_fa=term.display,
                tts_fa=term.tts, entity="TERM", verified=True))
            # شکل‌های جایگزین (مثل بدون نیم‌فاصله یا لاتین)
            for alias in term.aliases:
                entries.append(PronunciationEntry(
                    original=alias, display_fa=term.display,
                    tts_fa=term.tts, entity="TERM", verified=True))
        return entries

    # --- راهنمای توضیح در اولین اشاره (§۲) ---
    def explain_hints(self, limit: int = 8) -> list[str]:
        return [f"{e['term']}: {e['hint']}" for e in self.explain[:limit]]


def load_glossary(path: str | Path = DEFAULT_GLOSSARY_PATH) -> Glossary:
    return Glossary.load(path)
