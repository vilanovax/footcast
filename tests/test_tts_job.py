"""تست‌های فاز E: Provider، سگمنت‌بندی و تولید ایدمپوتنت."""

from footcast.providers import MockTtsProvider, MockAsrProvider
from footcast.segments import build_segments
from footcast.tts_job import (
    concat_segments,
    job_key,
    synthesize_segments,
)


def test_segments_are_deterministic():
    text = "جمله اول.\n\nجمله دوم اینجاست.\n\nپاراگراف سوم."
    a = build_segments(text, max_chars=50)
    b = build_segments(text, max_chars=50)
    assert [s.segment_key for s in a] == [s.segment_key for s in b]


def test_segment_never_splits_mid_sentence():
    text = "این یک جمله نسبتاً بلند فارسی است که باید کامل بماند."
    segs = build_segments(text, max_chars=1000)
    assert segs[0].text == text


def test_job_key_changes_with_text():
    k1 = job_key("ep", "hashA", "mock", "v1", "m1", {})
    k2 = job_key("ep", "hashB", "mock", "v1", "m1", {})
    assert k1 != k2


def test_job_key_stable_for_same_inputs():
    args = ("ep", "hashA", "mock", "v1", "m1", {"stability": 0.5})
    assert job_key(*args) == job_key(*args)


def test_mock_tts_produces_valid_bytes():
    audio = MockTtsProvider().synthesize("سلام دنیا", "v", "m", {})
    assert audio[:4] == b"RIFF"
    assert len(audio) > 100


def test_idempotent_generation_skips_second_run(tmp_path):
    text = "بخش اول اینجاست.\n\nبخش دوم اینجاست.\n\nبخش سوم اینجاست."
    provider = MockTtsProvider()
    common = dict(
        provider=provider, text=text, out_dir=tmp_path, episode_id="ep-test",
        approved_text_sha256="abc123", voice_id="v", model_id="m", max_chars=30,
    )
    r1 = synthesize_segments(**common)
    assert r1["generated"] > 0
    assert r1["skipped"] == 0

    # اجرای دوم با همان ورودی → همه از قبل موجودند (ایدمپوتنت)
    r2 = synthesize_segments(**common)
    assert r2["generated"] == 0
    assert r2["skipped"] == r1["generated"]


def test_changed_text_regenerates(tmp_path):
    provider = MockTtsProvider()
    base = dict(provider=provider, out_dir=tmp_path, episode_id="ep2",
                approved_text_sha256="h", voice_id="v", model_id="m", max_chars=30)
    r1 = synthesize_segments(text="متن اولیه اینجاست.", **base)
    # متن عوض شد → هش سگمنت فرق می‌کند → دوباره تولید می‌شود
    r2 = synthesize_segments(text="متن کاملاً متفاوت دیگری.", **base)
    assert r2["generated"] > 0


def test_concat_produces_single_file(tmp_path):
    text = "الف اینجاست.\n\nب اینجاست.\n\nج اینجاست."
    r = synthesize_segments(
        provider=MockTtsProvider(), text=text, out_dir=tmp_path, episode_id="ep3",
        approved_text_sha256="h", voice_id="v", model_id="m", max_chars=20,
    )
    out = concat_segments(r["manifest"], tmp_path / "final.audio")
    assert out.exists()
    assert out.stat().st_size > 0


def test_mock_asr_reads_reference(tmp_path):
    audio = tmp_path / "ep.mp3"
    audio.write_bytes(b"fake")
    (tmp_path / "ep.tts.txt").write_text("متن مرجع", encoding="utf-8")
    result = MockAsrProvider().transcribe(str(audio))
    assert result.text == "متن مرجع"
