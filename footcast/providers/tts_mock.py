"""Mock Provider تبدیل متن به گفتار — برای توسعه و تست بدون کلید API.

بایت‌های تولیدشده قطعی (deterministic) هستند تا اجرای مجدد پایدار بماند.
"""

from __future__ import annotations

import hashlib
import struct

from .base import TtsProvider

# میانگین سرعت گفتار فارسی برای تخمین مدت (کلمه بر ثانیه)
_WORDS_PER_SECOND = 2.3
_SAMPLE_RATE = 48000


class MockTtsProvider(TtsProvider):
    name = "mock"

    def synthesize(self, text: str, voice_id: str, model_id: str, settings: dict) -> bytes:
        """یک WAV سکوت‌دار قطعی با مدت متناسب با تعداد کلمات می‌سازد."""
        words = max(len(text.split()), 1)
        seconds = max(words / _WORDS_PER_SECOND, 0.3)
        num_samples = int(seconds * _SAMPLE_RATE)

        # هدر WAV مونو ۱۶بیت
        seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
        data_size = num_samples * 2
        header = b"RIFF" + struct.pack("<I", 36 + data_size) + b"WAVE"
        header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, _SAMPLE_RATE,
                                        _SAMPLE_RATE * 2, 2, 16)
        header += b"data" + struct.pack("<I", data_size)

        # نمونه‌های شبه‌تصادفی کم‌دامنه و قطعی (نه سکوت کامل، تا کنترل «سکوت کامل» رد نشود)
        samples = bytearray()
        state = seed or 1
        for _ in range(num_samples):
            state = (1103515245 * state + 12345) & 0x7FFFFFFF
            val = (state % 2001) - 1000  # دامنه کوچک
            samples += struct.pack("<h", val)

        return bytes(header) + bytes(samples)
