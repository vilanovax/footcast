"""بازنویسی «محاوره معیار» — تبدیل فارسی رسمی به گفتاری طبیعی.

هدف: نه رسمی و کتابی، نه کوچه‌بازاری. این یک مرحله مستقل پس از قفل‌شدن صحت خبر
است (§۱۸) تا دقت خبر فدای روان‌نویسی نشود.

- to_colloquial(): تبدیل قطعی و امن افعال و واژه‌های رسمی
- find_over_colloquial(): شناسایی شکل‌های بیش‌ازحد عامیانه (§۱۷) برای گزارش QA
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from .config import ROOT

DEFAULT_COLLOQUIAL_PATH = ROOT / "config" / "colloquial.yaml"

# «ی است» → «یه» (صفت + است)، مثل «خطرناکی است» → «خطرناکیه»
# پایان جمله (قبل از نقطه/ویرگول/علامت) هم پوشش داده می‌شود.
_YE_AST = re.compile(r"(\S+ی)\s+است(?=[\s.،؛!؟]|$)")


@dataclass
class ColloquialRules:
    replace: dict[str, str] = field(default_factory=dict)
    fix: dict[str, str] = field(default_factory=dict)
    flag: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, path: str | Path = DEFAULT_COLLOQUIAL_PATH) -> "ColloquialRules":
        path = Path(path)
        if not path.exists():
            return cls()
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        return cls(
            replace=dict(raw.get("replace", {})),
            fix=dict(raw.get("fix", {})),
            flag=list(raw.get("flag", [])),
        )


@lru_cache(maxsize=1)
def _rules() -> ColloquialRules:
    return ColloquialRules.load()


def _apply_map(text: str, mapping: dict[str, str], word_boundary: bool = True) -> str:
    # بلندترین عبارت‌ها اول جایگزین شوند
    for src in sorted(mapping, key=len, reverse=True):
        dst = mapping[src]
        if word_boundary and not src.endswith(" "):
            text = re.sub(rf"(?<!\w){re.escape(src)}(?!\w)", dst, text)
        else:
            text = text.replace(src, dst)
    return text


def to_colloquial(text: str, rules: ColloquialRules | None = None) -> str:
    """متن رسمی را به محاوره معیار تبدیل می‌کند (قطعی و امن)."""
    if not text:
        return text
    rules = rules or _rules()

    # ۱) صفت + «است» → «...ه»
    text = _YE_AST.sub(lambda m: m.group(1) + "ه", text)
    # ۲) تبدیل‌های رسمی → گفتاری
    text = _apply_map(text, rules.replace)
    # ۳) اصلاح شکل‌های بیش‌ازحد عامیانه
    text = _apply_map(text, rules.fix)
    return text


def find_over_colloquial(text: str, rules: ColloquialRules | None = None) -> list[str]:
    """شکل‌های بیش‌ازحد عامیانه یا ممنوع را برای گزارش QA برمی‌گرداند (§۱۷)."""
    rules = rules or _rules()
    found: list[str] = []
    for form in rules.flag:
        if re.search(rf"(?<!\w){re.escape(form)}(?!\w)", text):
            found.append(form)
    # شکل‌های عامیانه‌ای که در fix هستند اگر باقی مانده باشند هم گزارش شوند
    for bad in rules.fix:
        if re.search(rf"(?<!\w){re.escape(bad)}(?!\w)", text):
            found.append(bad)
    return list(dict.fromkeys(found))
