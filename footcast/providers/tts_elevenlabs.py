"""Provider واقعی ElevenLabs پشت اینترفیس مشترک."""

from __future__ import annotations

import requests

from .base import TtsProvider, TtsProviderError

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

# کدهای وضعیتی که Retry روی آن‌ها بی‌فایده است
_NON_RETRYABLE = {400, 401, 403, 422}


class ElevenLabsTtsProvider(TtsProvider):
    name = "elevenlabs"

    def __init__(self, api_key: str, model_id: str, timeout: int = 120):
        self.api_key = api_key
        self.model_id = model_id
        self.timeout = timeout

    def synthesize(self, text: str, voice_id: str, model_id: str, settings: dict) -> bytes:
        if not self.api_key:
            raise TtsProviderError("ELEVENLABS_API_KEY تنظیم نشده است.", retryable=False)

        url = ELEVENLABS_TTS_URL.format(voice_id=voice_id)
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text,
            "model_id": model_id or self.model_id,
            "voice_settings": settings or {"stability": 0.5, "similarity_boost": 0.75},
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        except requests.RequestException as exc:
            raise TtsProviderError(f"خطای شبکه ElevenLabs: {exc}", retryable=True) from exc

        if resp.status_code == 200:
            return resp.content

        # ۴۰۳ با بدنه‌ی HTML معمولاً یعنی بلاک جغرافیایی/آی‌پی (نه مشکل مدل یا کلید)
        body = resp.text[:200]
        if resp.status_code == 403 and ("<html" in body.lower() or "forbidden" in body.lower()):
            raise TtsProviderError(
                "دسترسی به ElevenLabs مسدود است (۴۰۳). به‌احتمال زیاد آی‌پی/کشورت "
                "بلاک شده — با VPN به یک کشور پشتیبانی‌شده (مثل آمریکا یا اروپا) وصل شو "
                "و دوباره اجرا کن. این خطا ربطی به مدل v3 یا کلید ندارد.",
                retryable=False,
            )

        retryable = resp.status_code not in _NON_RETRYABLE
        raise TtsProviderError(
            f"خطای ElevenLabs {resp.status_code}: {body}",
            retryable=retryable,
        )
