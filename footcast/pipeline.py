"""ارکستراسیون کامل پایپلاین: جمع‌آوری → انتخاب → تولید → بازبینی → صوت."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .config import Config, load_config
from .generate import generate_script
from .ingest import fetch_all
from .models import ReviewResult, Script
from .review import review_script
from .select import select_top
from .tts import synthesize


def _stamp() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y%m%d-%H%M")


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

    print("\n[۴/۴] بازبینی کامل محتوا ...")
    review = review_script(script, config)
    final_script = review.revised_script or script

    # ذخیره خروجی‌ها
    base = out_dir / f"footcast-{stamp}"
    json_path = base.with_suffix(".json")
    md_path = base.with_suffix(".md")

    json_path.write_text(
        json.dumps(
            {
                "script": final_script.model_dump(),
                "review": review.model_dump(exclude={"revised_script"}),
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
        "audio_path": base.with_suffix(".mp3"),
        "script": final_script,
        "review": review,
    }


def load_draft(json_path: str | Path) -> Script:
    """اسکریپت را از فایل JSON پیش‌نویس بازمی‌خواند."""
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    return Script(**data["script"])


def synthesize_draft(json_path: str | Path, config: Config, out_path: str | Path | None = None) -> Path:
    """از روی پیش‌نویس تأییدشده فایل صوتی می‌سازد."""
    json_path = Path(json_path)
    script = load_draft(json_path)
    out_path = Path(out_path) if out_path else json_path.with_suffix(".mp3")
    return synthesize(script, config, out_path)


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

    print("\n[۵/۵] تبدیل به فایل صوتی با ElevenLabs ...")
    audio_path = synthesize(result["script"], config, result["audio_path"])
    result["audio_path"] = audio_path
    return result
