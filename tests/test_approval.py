"""تست‌های فاز D: دروازه‌های تأیید با قفل هش."""

import json

import pytest

from footcast.approval import (
    approve_audio,
    approve_text,
    check_text_approval,
    revoke_text_approval,
    sha256_text,
)


def _write_draft(tmp_path, tts_text="سلام. این یک متن پاک آزمایشی است.", issues=None):
    draft = tmp_path / "footcast-test.json"
    draft.write_text(
        json.dumps({
            "script": {"show_name": "x", "date": "d", "segments": []},
            "tts_clean": {
                "text": tts_text,
                "sha256": sha256_text(tts_text),
                "issues": issues or [],
                "path": str(tmp_path / "footcast-test.tts.txt"),
            },
        }, ensure_ascii=False),
        encoding="utf-8",
    )
    return draft


def test_synthesis_blocked_without_approval(tmp_path):
    draft = _write_draft(tmp_path)
    ok, _ = check_text_approval(draft)
    assert ok is False


def test_approve_text_then_valid(tmp_path):
    draft = _write_draft(tmp_path)
    approve_text(draft)
    ok, _ = check_text_approval(draft)
    assert ok is True


def test_editing_text_invalidates_approval(tmp_path):
    draft = _write_draft(tmp_path)
    approve_text(draft)
    assert check_text_approval(draft)[0] is True

    # ویرایش متن پس از تأیید → هش عوض می‌شود → تأیید باطل
    data = json.loads(draft.read_text(encoding="utf-8"))
    data["tts_clean"]["text"] = "متن عوض شده است."
    draft.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    ok, reason = check_text_approval(draft)
    assert ok is False
    assert "تغییر" in reason


def test_editing_tts_file_invalidates_approval(tmp_path):
    # رگرسیون #3: ویرایش دستی فایل .tts.txt باید تأیید را باطل کند
    draft = _write_draft(tmp_path)
    tts_file = tmp_path / "footcast-test.tts.txt"
    tts_file.write_text("متن پاک آزمایشی برای تأیید.", encoding="utf-8")

    approve_text(draft)
    assert check_text_approval(draft)[0] is True

    # ویرایش فایل قابل‌ویرایش → تأیید باطل
    tts_file.write_text("متن ویرایش‌شده توسط بازبین.", encoding="utf-8")
    ok, reason = check_text_approval(draft)
    assert ok is False
    assert "تغییر" in reason


def test_tts_file_is_source_of_truth(tmp_path):
    # متن از .tts.txt خوانده می‌شود، نه کپی JSON
    from footcast.approval import read_tts_text
    draft = _write_draft(tmp_path)
    tts_file = tmp_path / "footcast-test.tts.txt"
    tts_file.write_text("متن واقعی از فایل.", encoding="utf-8")
    assert read_tts_text(draft) == "متن واقعی از فایل."


def test_blocker_issue_prevents_approval(tmp_path):
    draft = _write_draft(tmp_path, issues=["هنوز عدد رقمی در متن TTS باقی مانده است."])
    with pytest.raises(RuntimeError):
        approve_text(draft)


def test_revoke_text_approval(tmp_path):
    draft = _write_draft(tmp_path)
    approve_text(draft)
    revoke_text_approval(draft)
    ok, _ = check_text_approval(draft)
    assert ok is False


def test_audio_approval_requires_text_approval(tmp_path):
    draft = _write_draft(tmp_path)
    audio = tmp_path / "footcast-test.mp3"
    audio.write_bytes(b"fake-audio-bytes")
    # بدون تأیید متن، تأیید صوت ممنوع
    with pytest.raises(RuntimeError):
        approve_audio(draft, audio)
    # با تأیید متن، مجاز
    approve_text(draft)
    path = approve_audio(draft, audio)
    assert path.exists()
