"""اینترفیس‌های مشترک Provider."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class TtsProviderError(RuntimeError):
    """خطای Provider تبدیل متن به گفتار."""

    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


class TtsProvider(ABC):
    """اینترفیس تبدیل متن به گفتار."""

    name: str = "base"

    @abstractmethod
    def synthesize(
        self,
        text: str,
        voice_id: str,
        model_id: str,
        settings: dict,
    ) -> bytes:
        """متن یک بخش را به بایت‌های صوتی تبدیل می‌کند."""
        raise NotImplementedError


@dataclass
class AsrResult:
    text: str
    segments: list[dict] = field(default_factory=list)


class AsrProvider(ABC):
    """اینترفیس تبدیل گفتار به متن (برای QA صوت)."""

    name: str = "base"

    @abstractmethod
    def transcribe(self, audio_path: str) -> AsrResult:
        raise NotImplementedError
