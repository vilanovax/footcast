"""تولید صوت سگمنت‌محور، ایدمپوتنت و با Retry کنترل‌شده.

اصول سند:
- Job Key قطعی از (اپیزود + هش متن تأییدشده + provider + voice + model + settings).
- اگر Job با همین کلید کامل شده باشد، هیچ صوت جدیدی ساخته نمی‌شود.
- اگر ناقص باشد، فقط Segmentهای ناقص تولید می‌شوند.
- Retry فقط برای خطاهای موقت (حداکثر ۳ بار، Backoff نمایی).
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

from .providers.base import TtsProvider, TtsProviderError
from .segments import TtsSegment, build_segments


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def settings_hash(settings: dict) -> str:
    return _sha(json.dumps(settings, sort_keys=True, ensure_ascii=False))


def job_key(
    episode_id: str,
    approved_text_sha256: str,
    provider: str,
    voice_id: str,
    model_id: str,
    settings: dict,
) -> str:
    """کلید قطعی Job برای ایدمپوتنسی."""
    material = "|".join([
        episode_id, approved_text_sha256, provider, voice_id, model_id,
        settings_hash(settings),
    ])
    return _sha(material)


def _validate_audio(path: Path, min_bytes: int = 64) -> bool:
    return path.exists() and path.stat().st_size >= min_bytes


def synthesize_segments(
    provider: TtsProvider,
    text: str,
    out_dir: Path,
    episode_id: str,
    approved_text_sha256: str,
    voice_id: str,
    model_id: str,
    settings: dict | None = None,
    max_chars: int = 1500,
    max_retries: int = 3,
) -> dict:
    """صوت را سگمنت‌به‌سگمنت تولید می‌کند و Manifest را برمی‌گرداند/به‌روزرسانی می‌کند."""
    settings = settings or {"stability": 0.5, "similarity_boost": 0.75}
    out_dir = Path(out_dir)
    seg_dir = out_dir / f"{episode_id}-segments"
    seg_dir.mkdir(parents=True, exist_ok=True)

    key = job_key(episode_id, approved_text_sha256, provider.name, voice_id, model_id, settings)
    manifest_path = seg_dir / "manifest.json"

    segments: list[TtsSegment] = build_segments(text, max_chars=max_chars)

    # بارگذاری Manifest قبلی (در صورت وجود) برای ایدمپوتنسی
    manifest = {"jobKey": key, "episodeId": episode_id, "provider": provider.name,
                "voiceId": voice_id, "modelId": model_id, "segments": []}
    prev_by_key: dict[str, dict] = {}
    if manifest_path.exists():
        prev = json.loads(manifest_path.read_text(encoding="utf-8"))
        if prev.get("jobKey") == key:
            prev_by_key = {s["segmentKey"]: s for s in prev.get("segments", [])}

    generated, skipped = 0, 0
    seg_records: list[dict] = []
    for seg in segments:
        audio_path = seg_dir / f"{seg.segment_key}.audio"
        prev_rec = prev_by_key.get(seg.segment_key)

        # ایدمپوتنسی: اگر قبلاً با همین هش تولید و فایل معتبر است، رد شو
        if (prev_rec and prev_rec.get("status") == "COMPLETED"
                and prev_rec.get("textSha256") == seg.text_sha256
                and _validate_audio(audio_path)):
            seg_records.append(prev_rec)
            skipped += 1
            continue

        audio = _synthesize_with_retry(provider, seg, voice_id, model_id, settings, max_retries)
        audio_path.write_bytes(audio)
        seg_records.append({
            "segmentKey": seg.segment_key,
            "order": seg.order,
            "textSha256": seg.text_sha256,
            "audioPath": str(audio_path),
            "audioSha256": _sha_bytes(audio),
            "bytes": len(audio),
            "status": "COMPLETED",
        })
        generated += 1

    manifest["segments"] = seg_records
    manifest["status"] = "COMPLETED"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    return {"manifest": manifest, "manifest_path": manifest_path,
            "generated": generated, "skipped": skipped, "seg_dir": seg_dir}


def _synthesize_with_retry(provider, seg, voice_id, model_id, settings, max_retries) -> bytes:
    attempt = 0
    while True:
        try:
            audio = provider.synthesize(seg.text, voice_id, model_id, settings)
            if not audio or len(audio) < 64:
                raise TtsProviderError("خروجی صوتی خالی یا خیلی کوچک بود.", retryable=True)
            return audio
        except TtsProviderError as exc:
            attempt += 1
            if not exc.retryable or attempt > max_retries:
                raise
            backoff = 2 ** attempt
            print(f"      Retry بخش {seg.segment_key} (تلاش {attempt}) پس از {backoff}s ...")
            time.sleep(min(backoff, 8))


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def concat_segments(manifest: dict, out_path: Path) -> Path:
    """بایت‌های Segmentها را به ترتیب در یک فایل خروجی به‌هم می‌چسباند."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    segs = sorted(manifest["segments"], key=lambda s: s["order"])
    with out_path.open("wb") as out:
        for s in segs:
            out.write(Path(s["audioPath"]).read_bytes())
    return out_path
