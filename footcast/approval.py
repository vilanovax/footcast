"""دروازه‌های تأیید با قفل هش (متن و صوت).

قوانین کلیدی سند:
- بدون تأیید متن، تولید TTS ممنوع است.
- هر تغییر در متن پاک TTS پس از تأیید، تأیید را باطل می‌کند (عدم تطابق هش).
- بدون تأیید صوت، ورود به مرحله انتشار ممنوع است.

تأییدها به‌صورت artifactهای JSON کنار فایل پیش‌نویس ذخیره می‌شوند
(بدون نیاز به دیتابیس در این نسخه).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _episode_id(draft_json: Path) -> str:
    return draft_json.stem  # مثل footcast-20260715-0831


def _load_draft_json(draft_json: str | Path) -> dict:
    return json.loads(Path(draft_json).read_text(encoding="utf-8"))


def _text_approval_path(draft_json: Path) -> Path:
    return draft_json.with_suffix(".text-approval.json")


def _tts_text_path(draft_json: Path) -> Path:
    return draft_json.with_suffix(".tts.txt")


def read_tts_text(draft_json: str | Path) -> str:
    """متن پاک TTS را از فایل قابل‌ویرایش .tts.txt می‌خواند (منبع حقیقت).

    اگر فایل نبود، به کپی داخل JSON برمی‌گردد. این تضمین می‌کند ویرایش دستی
    فایل .tts.txt هم در تولید صوت اثر بگذارد و هم تأیید را باطل کند.
    """
    draft_json = Path(draft_json)
    tts_file = _tts_text_path(draft_json)
    if tts_file.exists():
        return tts_file.read_text(encoding="utf-8")
    data = _load_draft_json(draft_json)
    return (data.get("tts_clean") or {}).get("text", "")


def _audio_approval_path(draft_json: Path) -> Path:
    return draft_json.with_suffix(".audio-approval.json")


# ---------------------------------------------------------------------------
# تأیید متن
# ---------------------------------------------------------------------------
def approve_text(draft_json: str | Path, approved_by: str = "USER") -> Path:
    """متن پاک TTS پیش‌نویس را تأیید می‌کند و artifact تأیید را می‌نویسد."""
    draft_json = Path(draft_json)
    data = _load_draft_json(draft_json)
    tts = data.get("tts_clean") or {}
    # متن از فایل قابل‌ویرایش .tts.txt خوانده می‌شود (نه کپی JSON)
    text = read_tts_text(draft_json)
    if not text:
        raise RuntimeError("متن پاک TTS در پیش‌نویس یافت نشد.")

    # اگر ایراد بلاکر (عدد رقمی، URL، مارک‌داون) هست، اجازه تأیید نده
    blocking = [
        i for i in tts.get("issues", [])
        if ("عدد رقمی" in i) or ("URL" in i) or ("Markdown" in i)
    ]
    if blocking:
        raise RuntimeError(
            "متن TTS ایراد بلاکر دارد و قابل تأیید نیست:\n  - " + "\n  - ".join(blocking)
        )

    approval = {
        "episodeId": _episode_id(draft_json),
        "approvalType": "TEXT",
        "status": "APPROVED",
        "artifactPath": str(_tts_text_path(draft_json)),
        "artifactSha256": sha256_text(text),
        "approvedBy": approved_by,
        "approvedAt": _now(),
        "revokedAt": None,
    }
    path = _text_approval_path(draft_json)
    path.write_text(json.dumps(approval, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def check_text_approval(draft_json: str | Path) -> tuple[bool, str]:
    """بررسی می‌کند آیا متن پاک TTS تأیید معتبر (هش منطبق) دارد."""
    draft_json = Path(draft_json)
    approval_path = _text_approval_path(draft_json)
    if not approval_path.exists():
        return False, "تأیید متن وجود ندارد. ابتدا approve-text را اجرا کن."

    approval = json.loads(approval_path.read_text(encoding="utf-8"))
    if approval.get("status") != "APPROVED" or approval.get("revokedAt"):
        return False, "تأیید متن باطل شده است."

    current_text = read_tts_text(draft_json)
    current_hash = sha256_text(current_text)
    if current_hash != approval.get("artifactSha256"):
        return False, (
            "متن TTS پس از تأیید تغییر کرده — تأیید باطل است. "
            "دوباره approve-text را اجرا کن."
        )
    return True, "تأیید متن معتبر است."


def revoke_text_approval(draft_json: str | Path) -> None:
    """تأیید متن را باطل می‌کند (مثلاً پس از ویرایش دستی متن)."""
    approval_path = _text_approval_path(Path(draft_json))
    if not approval_path.exists():
        return
    approval = json.loads(approval_path.read_text(encoding="utf-8"))
    approval["status"] = "REVOKED"
    approval["revokedAt"] = _now()
    approval_path.write_text(json.dumps(approval, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# تأیید صوت
# ---------------------------------------------------------------------------
def approve_audio(draft_json: str | Path, audio_path: str | Path, approved_by: str = "USER") -> Path:
    """فایل صوتی تولیدشده را تأیید می‌کند (پیش‌نیاز انتشار)."""
    draft_json = Path(draft_json)
    audio_path = Path(audio_path)
    if not audio_path.exists():
        raise RuntimeError(f"فایل صوتی یافت نشد: {audio_path}")

    # تأیید صوت مستلزم تأیید متن معتبر است
    ok, reason = check_text_approval(draft_json)
    if not ok:
        raise RuntimeError(f"تأیید صوت ممکن نیست چون تأیید متن معتبر نیست: {reason}")

    approval = {
        "episodeId": _episode_id(draft_json),
        "approvalType": "AUDIO",
        "status": "APPROVED",
        "artifactPath": str(audio_path),
        "artifactSha256": sha256_file(audio_path),
        "approvedBy": approved_by,
        "approvedAt": _now(),
        "revokedAt": None,
    }
    path = _audio_approval_path(draft_json)
    path.write_text(json.dumps(approval, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
