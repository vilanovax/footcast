"""تبدیل متن به گفتار با استفاده از ElevenLabs."""

from __future__ import annotations

from pathlib import Path

import requests

from .config import Config
from .models import Script

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

# ElevenLabs برای هر درخواست محدودیت طول دارد؛ متن‌های بلند را تکه‌تکه می‌کنیم.
MAX_CHARS_PER_REQUEST = 4500


def _chunk_text(text: str, max_chars: int = MAX_CHARS_PER_REQUEST) -> list[str]:
    """متن را در مرز پاراگراف‌ها به تکه‌های زیر حد مجاز تقسیم می‌کند."""
    paragraphs = [p for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            # اگر خود پاراگراف بلندتر از حد است، سخت‌بُرش می‌کنیم
            while len(para) > max_chars:
                chunks.append(para[:max_chars])
                para = para[max_chars:]
            current = para
    if current:
        chunks.append(current)
    return chunks


def synthesize(
    script: Script,
    config: Config,
    out_path: str | Path,
    text: str | None = None,
) -> Path:
    """اسکریپت را به یک فایل MP3 تبدیل می‌کند و مسیر آن را برمی‌گرداند.

    اگر `text` داده شود (متن پاک TTS)، همان استفاده می‌شود؛ در غیر این صورت از
    متن خام اسکریپت استفاده می‌شود.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    api_key = config.elevenlabs_api_key
    if not api_key:
        raise RuntimeError(
            "ELEVENLABS_API_KEY تنظیم نشده است. برای تولید فایل صوتی کلید را در .env قرار بده."
        )

    text = text if text is not None else script.to_speech_text()
    chunks = _chunk_text(text)
    print(f"  → تبدیل به صوت در {len(chunks)} بخش با صدای {config.elevenlabs_voice_id} ...")

    url = ELEVENLABS_TTS_URL.format(voice_id=config.elevenlabs_voice_id)
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    with out_path.open("wb") as out_file:
        for i, chunk in enumerate(chunks, 1):
            payload = {
                "text": chunk,
                "model_id": config.elevenlabs_model_id,
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=120)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"خطای ElevenLabs (بخش {i}): {resp.status_code} — {resp.text[:300]}"
                )
            out_file.write(resp.content)
            print(f"     بخش {i}/{len(chunks)} تولید شد.")

    print(f"  ✅ فایل صوتی ذخیره شد: {out_path}")
    return out_path
