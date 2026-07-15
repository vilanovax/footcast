"""Providerهای بیرونی (TTS و ASR) پشت اینترفیس مشترک.

انتخاب Provider از طریق متغیرهای محیطی انجام می‌شود تا سیستم بدون کلید API
با Mock Provider کامل اجرا شود.
"""

from .base import AsrProvider, AsrResult, TtsProvider
from .asr_mock import MockAsrProvider
from .tts_elevenlabs import ElevenLabsTtsProvider
from .tts_mock import MockTtsProvider


def get_tts_provider(config) -> TtsProvider:
    """Provider مناسب TTS را بر اساس تنظیمات برمی‌گرداند."""
    name = (config.tts_provider or "mock").lower()
    if name == "elevenlabs":
        return ElevenLabsTtsProvider(
            api_key=config.elevenlabs_api_key or "",
            model_id=config.elevenlabs_model_id,
        )
    return MockTtsProvider()


def get_asr_provider(config) -> AsrProvider:
    """Provider مناسب ASR را بر اساس تنظیمات برمی‌گرداند."""
    name = (config.asr_provider or "mock").lower()
    # Whisper در نسخه بعدی؛ فعلاً Mock
    return MockAsrProvider()


__all__ = [
    "TtsProvider",
    "AsrProvider",
    "AsrResult",
    "MockTtsProvider",
    "ElevenLabsTtsProvider",
    "MockAsrProvider",
    "get_tts_provider",
    "get_asr_provider",
]
