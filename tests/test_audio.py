"""تست‌های فاز F: مونتاژ و کنترل Loudness."""

import pytest

from footcast.audio import assemble, find_ffmpeg
from footcast.providers import MockTtsProvider

ffmpeg_available = find_ffmpeg() is not None
requires_ffmpeg = pytest.mark.skipif(not ffmpeg_available, reason="ffmpeg در دسترس نیست")


def _make_segments(tmp_path, n=3):
    provider = MockTtsProvider()
    paths = []
    for i in range(n):
        audio = provider.synthesize(f"این بخش شماره {i} است و متنی دارد.", "v", "m", {})
        p = tmp_path / f"seg-{i}.wav"
        p.write_bytes(audio)
        paths.append(p)
    return paths


@requires_ffmpeg
def test_assemble_produces_master_and_publish(tmp_path):
    segs = _make_segments(tmp_path)
    report = assemble(segs, tmp_path, "ep-test", target_lufs=-16.0)
    assert report.normalized is True
    assert (tmp_path / "ep-test.audio-master.wav").exists()
    assert (tmp_path / "ep-test.audio-publish.mp3").exists()


@requires_ffmpeg
def test_assemble_hits_target_loudness(tmp_path):
    segs = _make_segments(tmp_path)
    report = assemble(segs, tmp_path, "ep-loud", target_lufs=-16.0)
    # خروجی باید نزدیک هدف باشد (±۲ LUFS)
    assert report.output_lufs is not None
    assert abs(report.output_lufs - (-16.0)) < 2.0


@requires_ffmpeg
def test_assemble_measures_duration(tmp_path):
    segs = _make_segments(tmp_path, n=2)
    report = assemble(segs, tmp_path, "ep-dur")
    assert report.duration_ms > 0


@requires_ffmpeg
def test_assemble_respects_true_peak_limit(tmp_path):
    segs = _make_segments(tmp_path)
    report = assemble(segs, tmp_path, "ep-tp", max_true_peak_db=-1.0)
    assert report.true_peak_db is not None
    # نباید به‌طور معنادار از حد فراتر رود
    assert report.true_peak_db <= 0.0


def test_report_to_dict_has_expected_keys(tmp_path):
    from footcast.audio import AudioReport
    d = AudioReport().to_dict()
    for key in ("masterPath", "publishPath", "targetLufs", "normalized", "warnings"):
        assert key in d
