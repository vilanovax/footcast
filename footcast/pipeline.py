"""ارکستراسیون کامل پایپلاین: جمع‌آوری → انتخاب → تولید → بازبینی → صوت."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from .config import Config, load_config
from .generate import generate_script
from .ingest import fetch_all
from .models import ReviewResult, Script
from .pronunciation import PronunciationDictionary
from .review import review_script
from .select import select_top
from .tts import synthesize
from .tts_clean import clean_for_tts


def _stamp() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y%m%d-%H%M")


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _script_to_markdown(script: Script, review: ReviewResult | None = None) -> str:
    lines = [f"# {script.show_name}", f"تاریخ: {script.date}", ""]
    if review is not None:
        status = "✅ تأیید شد" if review.approved else "⚠️ نیازمند بازبینی دستی"
        lines += [f"**وضعیت بازبینی:** {status} (امتیاز: {review.score}/100)", ""]
        if review.issues:
            lines.append("**ایرادها:**")
            lines += [f"- {i}" for i in review.issues]
            lines.append("")
        if review.notes:
            lines += [f"**یادداشت ویراستار:** {review.notes}", ""]
    lines += ["## مقدمه", script.intro, ""]
    for idx, seg in enumerate(script.segments, 1):
        lines += [f"## {idx}. {seg.headline}", seg.body]
        if seg.source:
            lines.append(f"> منبع: {seg.source} — {seg.link}")
        lines.append("")
    lines += ["## جمع‌بندی", script.outro, ""]
    return "\n".join(lines)


def build_draft(config: Config, out_dir: Path | None = None) -> dict:
    """مراحل جمع‌آوری تا بازبینی را اجرا می‌کند و پیش‌نویس را ذخیره می‌کند.

    فایل صوتی تولید نمی‌شود — این مرحله برای بازبینی و تأیید قبل از صوت است.
    خروجی: دیکشنری شامل مسیر فایل‌ها و نتیجه بازبینی.
    """
    out_dir = out_dir or config.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = _stamp()

    print("\n[۱/۴] جمع‌آوری اخبار از منابع RSS ...")
    items = fetch_all(config)

    print("\n[۲/۴] انتخاب مهم‌ترین اخبار ...")
    top = select_top(items, config)
    if not top:
        raise RuntimeError("هیچ خبری برای تولید محتوا یافت نشد.")

    print("\n[۳/۴] تولید محتوای نوشتاری ...")
    script = generate_script(top, config)

    print("\n[۴/۵] بازبینی کامل محتوا ...")
    review = review_script(script, config)
    final_script = review.revised_script or script

    print("\n[۵/۵] تولید متن پاک TTS (اعداد به حروف، حذف لاتین/مارک‌داون، تلفظ) ...")
    pron = PronunciationDictionary.load()
    clean = clean_for_tts(final_script.to_speech_text(), pronunciation=pron)
    if clean.issues:
        print(f"     {len(clean.issues)} نکته در متن TTS شناسایی شد.")
    if clean.pronunciation_warnings:
        print(f"     ⚠️  نام‌های بدون تلفظ: {', '.join(clean.pronunciation_warnings)}")

    # ذخیره خروجی‌ها
    base = out_dir / f"footcast-{stamp}"
    json_path = base.with_suffix(".json")
    md_path = base.with_suffix(".md")
    tts_path = base.with_suffix(".tts.txt")

    tts_path.write_text(clean.text, encoding="utf-8")

    json_path.write_text(
        json.dumps(
            {
                "script": final_script.model_dump(),
                "review": review.model_dump(exclude={"revised_script"}),
                "tts_clean": {
                    "text": clean.text,
                    "sha256": _sha256(clean.text),
                    "issues": clean.issues,
                    "pronunciation_warnings": clean.pronunciation_warnings,
                    "unverified_names": clean.unverified_names,
                    "path": str(tts_path),
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    md_path.write_text(_script_to_markdown(final_script, review), encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"  پیش‌نویس آماده شد.")
    print(f"  متن (Markdown): {md_path}")
    print(f"  داده (JSON):    {json_path}")
    status = "تأیید خودکار شد ✅" if review.approved else "نیازمند بازبینی دستی ⚠️"
    print(f"  وضعیت بازبینی: {status} — امتیاز {review.score}/100")
    if review.issues:
        print("  ایرادها:")
        for i in review.issues:
            print(f"    - {i}")
    print("=" * 60)

    return {
        "json_path": json_path,
        "md_path": md_path,
        "tts_path": tts_path,
        "tts_text": clean.text,
        "audio_path": base.with_suffix(".mp3"),
        "script": final_script,
        "review": review,
    }


def load_draft(json_path: str | Path) -> tuple[Script, str]:
    """اسکریپت و متن پاک TTS را از فایل JSON پیش‌نویس بازمی‌خواند."""
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    script = Script(**data["script"])
    tts_text = (data.get("tts_clean") or {}).get("text", "") or script.to_speech_text()
    return script, tts_text


def synthesize_draft(json_path: str | Path, config: Config, out_path: str | Path | None = None) -> Path:
    """از روی پیش‌نویس تأییدشده فایل صوتی می‌سازد (با متن پاک TTS)."""
    json_path = Path(json_path)
    script, tts_text = load_draft(json_path)
    out_path = Path(out_path) if out_path else json_path.with_suffix(".mp3")
    return synthesize(script, config, out_path, text=tts_text)


def run_full(config: Config, force: bool = False) -> dict:
    """کل پایپلاین را از ابتدا تا فایل صوتی اجرا می‌کند.

    اگر بازبینی تأیید نشده باشد و force=False باشد، پیش از تولید صوت متوقف می‌شود.
    """
    result = build_draft(config)
    review: ReviewResult = result["review"]

    if not review.approved and not force:
        print(
            "\n⚠️  محتوا در بازبینی خودکار تأیید نشد. "
            "متن را در فایل بالا بررسی و اصلاح کن، سپس دستور «synthesize» را اجرا کن، "
            "یا برای تولید اجباری از --force استفاده کن."
        )
        return result

    print("\n[صوت] تبدیل به فایل صوتی با ElevenLabs ...")
    audio_path = synthesize(
        result["script"], config, result["audio_path"], text=result["tts_text"]
    )
    result["audio_path"] = audio_path
    return result
