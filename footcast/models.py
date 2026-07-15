"""مدل‌های داده مشترک در سراسر پایپلاین."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NewsItem(BaseModel):
    """یک خبر خام که از فید RSS استخراج شده است."""

    title: str
    summary: str = ""
    link: str = ""
    source: str = ""
    region: str = "world"  # iran | europe | world
    published: Optional[datetime] = None
    source_weight: int = 5

    # امتیاز اهمیت که در مرحله انتخاب محاسبه می‌شود
    score: float = 0.0

    def dedup_key(self) -> str:
        """کلید یکتا برای حذف موارد تکراری."""
        return (self.link or self.title).strip().lower()


class Segment(BaseModel):
    """یک بخش خبری تولیدشده (متن آماده خوانده‌شدن)."""

    headline: str
    body: str
    source: str = ""
    link: str = ""


class Script(BaseModel):
    """اسکریپت کامل یک قسمت که به صوت تبدیل می‌شود."""

    show_name: str
    date: str
    intro: str = ""
    segments: list[Segment] = Field(default_factory=list)
    outro: str = ""
    language: str = "fa"

    def to_speech_text(self) -> str:
        """کل اسکریپت را به صورت یک متن پیوسته برای TTS برمی‌گرداند."""
        parts: list[str] = []
        if self.intro:
            parts.append(self.intro)
        for seg in self.segments:
            parts.append(seg.headline)
            parts.append(seg.body)
        if self.outro:
            parts.append(self.outro)
        return "\n\n".join(p.strip() for p in parts if p.strip())


class ReviewResult(BaseModel):
    """نتیجه مرحله بازبینی کیفی محتوا."""

    approved: bool
    score: int = 0  # 0..100
    issues: list[str] = Field(default_factory=list)
    notes: str = ""
    # نسخه اصلاح‌شده اسکریپت (در صورت وجود اصلاحات)
    revised_script: Optional[Script] = None
