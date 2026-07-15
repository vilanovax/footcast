"""Mock Provider تبدیل گفتار به متن — برای تست حلقه QA صوت بدون موتور واقعی.

چون Mock TTS صوت واقعی تولید نمی‌کند، Mock ASR متن مرجع را از فایل کناری
(هم‌نام با پسوند .tts.txt) می‌خواند تا مقایسه متن/صوت قابل آزمایش باشد.
"""

from __future__ import annotations

from pathlib import Path

from .base import AsrProvider, AsrResult


class MockAsrProvider(AsrProvider):
    name = "mock"

    def transcribe(self, audio_path: str) -> AsrResult:
        # به‌دنبال فایل متن مرجع کنار فایل صوتی می‌گردد
        audio = Path(audio_path)
        candidates = [
            audio.with_suffix(".tts.txt"),
            audio.with_suffix(".reference.txt"),
        ]
        for cand in candidates:
            if cand.exists():
                return AsrResult(text=cand.read_text(encoding="utf-8"))
        return AsrResult(text="")
