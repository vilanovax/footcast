"""مونتاژ صوت و کنترل Loudness با ffmpeg.

خروجی‌ها:
- audio-master.wav  (۴۸ کیلوهرتز)
- audio-publish.mp3 (۱۹۲ kbps)
گزارش اندازه‌گیری در audio-qa-report.json ذخیره می‌شود.

از ffmpeg سیستمی یا باندل‌شده‌ی imageio-ffmpeg استفاده می‌کند. بدون ffmpeg،
به هم‌چسباندن ساده‌ی بایت‌ها برمی‌گردد (بدون نرمال‌سازی).
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path


def find_ffmpeg() -> str | None:
    """مسیر ffmpeg را پیدا می‌کند (سیستمی یا imageio-ffmpeg)."""
    system = shutil.which("ffmpeg")
    if system:
        return system
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001
        return None


@dataclass
class AudioReport:
    master_path: str = ""
    publish_path: str = ""
    duration_ms: int = 0
    input_lufs: float | None = None
    output_lufs: float | None = None
    true_peak_db: float | None = None
    target_lufs: float = -16.0
    max_true_peak_db: float = -1.0
    normalized: bool = False
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "masterPath": self.master_path,
            "publishPath": self.publish_path,
            "durationMs": self.duration_ms,
            "inputLufs": self.input_lufs,
            "outputLufs": self.output_lufs,
            "truePeakDb": self.true_peak_db,
            "targetLufs": self.target_lufs,
            "maxTruePeakDb": self.max_true_peak_db,
            "normalized": self.normalized,
            "warnings": self.warnings,
        }


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


def _write_concat_list(segment_paths: list[Path], list_path: Path) -> None:
    lines = [f"file '{p.resolve()}'" for p in segment_paths]
    list_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _measure_loudnorm(ffmpeg: str, path: Path, target_lufs: float, max_tp: float) -> dict | None:
    """پاس اول loudnorm: اندازه‌گیری مقادیر ورودی (JSON روی stderr)."""
    cmd = [
        ffmpeg, "-hide_banner", "-i", str(path),
        "-af", f"loudnorm=I={target_lufs}:TP={max_tp}:LRA=11:print_format=json",
        "-f", "null", "-",
    ]
    proc = _run(cmd)
    match = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", proc.stderr, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _duration_ms(ffmpeg: str, path: Path) -> int:
    proc = _run([ffmpeg, "-hide_banner", "-i", str(path)])
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", proc.stderr)
    if not m:
        return 0
    h, mnt, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return int((h * 3600 + mnt * 60 + s) * 1000)


def assemble(
    segment_paths: list[Path],
    out_dir: Path,
    episode_id: str,
    intro_path: Path | None = None,
    outro_path: Path | None = None,
    target_lufs: float = -16.0,
    max_true_peak_db: float = -1.0,
    sample_rate: int = 48000,
) -> AudioReport:
    """Segmentها را به master.wav و publish.mp3 نرمال‌شده تبدیل می‌کند."""
    out_dir = Path(out_dir)
    master = out_dir / f"{episode_id}.audio-master.wav"
    publish = out_dir / f"{episode_id}.audio-publish.mp3"
    report = AudioReport(
        master_path=str(master), publish_path=str(publish),
        target_lufs=target_lufs, max_true_peak_db=max_true_peak_db,
    )

    ffmpeg = find_ffmpeg()
    if ffmpeg is None:
        report.warnings.append("ffmpeg در دسترس نیست — نرمال‌سازی انجام نشد.")
        return report

    # ترتیب نهایی: اینترو + گفتار + اوترو
    ordered: list[Path] = []
    if intro_path and Path(intro_path).exists():
        ordered.append(Path(intro_path))
    ordered.extend(segment_paths)
    if outro_path and Path(outro_path).exists():
        ordered.append(Path(outro_path))

    # ۱) هم‌چسباندن با یکسان‌سازی نرخ نمونه (concat filter برای فرمت‌های ناهمگون امن‌تر است)
    combined = out_dir / f"{episode_id}.combined.wav"
    inputs: list[str] = []
    for p in ordered:
        inputs += ["-i", str(p)]
    n = len(ordered)
    filtergraph = (
        "".join(f"[{i}:a]aresample={sample_rate},aformat=channel_layouts=mono[a{i}];" for i in range(n))
        + "".join(f"[a{i}]" for i in range(n))
        + f"concat=n={n}:v=0:a=1[out]"
    )
    concat_cmd = [ffmpeg, "-hide_banner", "-y", *inputs,
                  "-filter_complex", filtergraph, "-map", "[out]",
                  "-ar", str(sample_rate), "-ac", "1", str(combined)]
    proc = _run(concat_cmd)
    if proc.returncode != 0 or not combined.exists():
        report.warnings.append(f"هم‌چسباندن ناموفق بود: {proc.stderr[-200:]}")
        return report

    report.duration_ms = _duration_ms(ffmpeg, combined)

    # ۲) اندازه‌گیری Loudness ورودی (پاس اول)
    measured = _measure_loudnorm(ffmpeg, combined, target_lufs, max_true_peak_db)
    if measured:
        report.input_lufs = _to_float(measured.get("input_i"))
        report.true_peak_db = _to_float(measured.get("input_tp"))

    # ۳) اعمال نرمال‌سازی (پاس دوم با مقادیر اندازه‌گیری‌شده) → master.wav
    if measured:
        af = (
            f"loudnorm=I={target_lufs}:TP={max_true_peak_db}:LRA=11:"
            f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
            f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
            f"offset={measured.get('target_offset', 0)}:linear=true"
        )
    else:
        af = f"loudnorm=I={target_lufs}:TP={max_true_peak_db}:LRA=11"

    norm_cmd = [ffmpeg, "-hide_banner", "-y", "-i", str(combined),
                "-af", af, "-ar", str(sample_rate), "-ac", "1",
                "-c:a", "pcm_s16le", str(master)]
    proc = _run(norm_cmd)
    if proc.returncode != 0 or not master.exists():
        report.warnings.append(f"نرمال‌سازی ناموفق بود: {proc.stderr[-200:]}")
        return report
    report.normalized = True

    # ۴) اندازه‌گیری خروجی نهایی
    out_measured = _measure_loudnorm(ffmpeg, master, target_lufs, max_true_peak_db)
    if out_measured:
        report.output_lufs = _to_float(out_measured.get("input_i"))
        report.true_peak_db = _to_float(out_measured.get("input_tp"))

    # ۵) کدگذاری MP3 برای انتشار (۱۹۲ kbps)
    mp3_cmd = [ffmpeg, "-hide_banner", "-y", "-i", str(master),
               "-c:a", "libmp3lame", "-b:a", "192k", str(publish)]
    proc = _run(mp3_cmd)
    if proc.returncode != 0 or not publish.exists():
        report.warnings.append(f"کدگذاری MP3 ناموفق بود: {proc.stderr[-200:]}")

    # فایل موقت
    combined.unlink(missing_ok=True)

    # بررسی هدف True Peak
    if report.true_peak_db is not None and report.true_peak_db > max_true_peak_db + 0.5:
        report.warnings.append(
            f"True Peak خروجی ({report.true_peak_db} dBTP) از حد ({max_true_peak_db}) بالاتر است."
        )
    return report


def _to_float(val) -> float | None:
    try:
        return round(float(val), 2)
    except (TypeError, ValueError):
        return None
