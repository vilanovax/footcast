"""تقسیم متن پاک TTS به Segmentهای قطعی (deterministic) با شناسه پایدار.

الگوریتم: ابتدا بر اساس پاراگراف، سپس جمله؛ جمله هرگز از وسط شکسته نمی‌شود.
هر Segment یک شناسه قطعی بر اساس ترتیب و هش متن دارد تا تولید ایدمپوتنت شود.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?؟])\s+")


@dataclass
class TtsSegment:
    segment_key: str
    order: int
    text: str
    text_sha256: str


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]


def build_segments(text: str, max_chars: int = 1500) -> list[TtsSegment]:
    """متن را به بخش‌های زیر حد مجاز تقسیم می‌کند بدون شکستن جمله."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    raw_chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if len(para) <= max_chars:
            candidate = f"{current}\n\n{para}" if current else para
            if len(candidate) <= max_chars:
                current = candidate
            else:
                if current:
                    raw_chunks.append(current)
                current = para
        else:
            # پاراگراف بزرگ را جمله‌به‌جمله بشکن
            if current:
                raw_chunks.append(current)
                current = ""
            sent_buf = ""
            for sent in _split_sentences(para):
                candidate = f"{sent_buf} {sent}".strip() if sent_buf else sent
                if len(candidate) <= max_chars:
                    sent_buf = candidate
                else:
                    if sent_buf:
                        raw_chunks.append(sent_buf)
                    # جمله‌ای بلندتر از حد: به‌ناچار به‌عنوان یک بخش نگه دار
                    sent_buf = sent
            if sent_buf:
                current = sent_buf
    if current:
        raw_chunks.append(current)

    segments: list[TtsSegment] = []
    for order, chunk in enumerate(raw_chunks, 1):
        h = _sha(chunk)
        segments.append(
            TtsSegment(
                segment_key=f"seg-{order:02d}-{h[:10]}",
                order=order,
                text=chunk,
                text_sha256=h,
            )
        )
    return segments
