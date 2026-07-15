"""ارکستراسیون کامل پایپلاین: جمع‌آوری → انتخاب → تولید → بازبینی → صوت."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from .approval import check_text_approval
from .asr_diff import diff_asr
from .audio import assemble
from .branding import apply_branding
from .colloquial import to_colloquial
from .config import Config, load_config
from .generate import generate_script
from .glossary import load_glossary
from .persian_date import now_tehran
from .ingest import fetch_all
from .models import ReviewResult, Script
from .outputs import build_qa_report, build_show_notes
from .pronunciation import PronunciationDictionary
from .story import build_stories, select_for_episode
from .providers import get_asr_provider, get_tts_provider
from .review import review_script
from .select import select_top
from .ssml import build_ssml
from .tts_clean import clean_for_tts
from .tts_job import concat_segments, synthesize_segments


def _stamp() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y%m%d-%H%M")


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _script_to_markdown(
    script: Script,
    review: ReviewResult | None = None,
    pron: "PronunciationDictionary | None" = None,
) -> str:
    # نسخه تحریریه: نام‌های خارجی با شکل انگلیسی همراه می‌شوند (§۱، §۱۵)
    def ann(text: str) -> str:
        return pron.annotate(text, style="editorial") if pron else text

    lines = [f"# {script.show_name}", f"تاریخ: {script.date}", ""]
    if review is not None:
        status = "✅ تأیید شد" if review.approved else "⚠️ نیازمند بازبینی دستی"
        lines += [f"**وضعیت بازبینی:** {status} (امتیاز: {review.score}/100)", ""]
        if review.passes:
            lines.append("**بازبینی سه‌مرحله‌ای:**")
            for p in review.passes:
                mark = "✅" if p.approved else "⚠️"
                lines.append(f"- {mark} Pass {p.pass_number} ({p.name}) — {p.score}/100"
                             + (f" — {len(p.issues)} ایراد" if p.issues else ""))
            lines.append("")
        if review.issues:
            lines.append("**ایرادها:**")
            lines += [f"- {i}" for i in review.issues]
            lines.append("")
        if review.notes:
            lines += [f"**یادداشت ویراستار:** {review.notes}", ""]
    lines += ["## مقدمه", ann(script.intro), ""]
    for idx, seg in enumerate(script.segments, 1):
        lines += [f"## {idx}. {ann(seg.headline)}", ann(seg.body)]
        if seg.source:
            lines.append(f"> منبع: {seg.source} — {seg.link}")
        lines.append("")
    lines += ["## جمع‌بندی", ann(script.outro), ""]
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

    print("\n[۲.۵] ساخت لایه Story (ادغام تکراری، Tier، وضعیت، امتیاز §۸) ...")
    stories = build_stories(top)
    stories = select_for_episode(stories)
    used_stories = [s for s in stories if s.used_in_episode]
    _sec = lambda name: sum(1 for s in used_stories if s.section == name)  # noqa: E731
    print(f"     {len(stories)} رویداد یکتا، {len(used_stories)} در اپیزود "
          f"({_sec('MAIN_STORY')} اصلی، {_sec('IRAN_FOOTBALL')} ایران، "
          f"{_sec('WORLD_ROUNDUP')} جهان، {_sec('RUMOR_RADAR')} شایعه).")

    print("\n[۳/۴] تولید محتوای نوشتاری ...")
    script = generate_script(top, config)

    print("\n[۴/۵] بازبینی کامل محتوا ...")
    review = review_script(script, config)
    final_script = review.revised_script or script

    # اعمال امضای ثابت برنامه (شروع و پایان یکسان؛ فقط تاریخ و تیترها متغیر)
    when = now_tehran()
    apply_branding(final_script, used_stories, when, config.content)

    # نرمال‌سازی واژگان فوتبالی (شکل مصنوعی → فارسی طبیعی) + بازنویسی محاوره معیار
    glossary = load_glossary()

    def _polish(text: str) -> str:
        return to_colloquial(glossary.normalize(text))

    final_script.intro = _polish(final_script.intro)
    final_script.outro = _polish(final_script.outro)
    for seg in final_script.segments:
        seg.headline = _polish(seg.headline)
        seg.body = _polish(seg.body)

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
    ssml_path = base.with_suffix(".ssml")

    # نسخه TTS (بدون انگلیسی، تلفظ‌شده) و نسخه SSML (با مکث)
    tts_path.write_text(clean.text, encoding="utf-8")
    ssml_path.write_text(build_ssml(final_script, pron), encoding="utf-8")

    # اتصال متن اجرا به Storyها (نسخه گفتاری هر خبر) برای هماهنگی سه خروجی
    for story, seg in zip(used_stories, final_script.segments):
        story.spoken_version = seg.body

    # خروجی دوم و سوم: شونوت و کنترل کیفیت (§۱۸)
    notes_path = base.with_suffix(".show-notes.md")
    qa_path = base.with_suffix(".qa-report.json")
    notes_path.write_text(
        build_show_notes(stories, config.content.show_name, final_script.date, pron),
        encoding="utf-8",
    )
    qa = build_qa_report(stories, final_script.to_speech_text(), clean.issues)
    qa_path.write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")

    json_path.write_text(
        json.dumps(
            {
                "script": final_script.model_dump(),
                "review": review.model_dump(exclude={"revised_script"}),
                "stories": [s.model_dump() for s in stories],
                "tts_clean": {
                    "text": clean.text,
                    "sha256": _sha256(clean.text),
                    "issues": clean.issues,
                    "pronunciation_warnings": clean.pronunciation_warnings,
                    "unverified_names": clean.unverified_names,
                    "path": str(tts_path),
                },
                "qa_report": qa,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    md_path.write_text(_script_to_markdown(final_script, review, pron), encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"  پیش‌نویس آماده شد.")
    print(f"  تحریریه (MD):   {md_path}")
    print(f"  متن TTS:        {tts_path}")
    print(f"  SSML:           {ssml_path}")
    print(f"  شونوت/انتشار:   {notes_path}")
    print(f"  کنترل کیفیت:    {qa_path}")
    print(f"  داده (JSON):    {json_path}")
    status = "تأیید خودکار شد ✅" if review.approved else "نیازمند بازبینی دستی ⚠️"
    print(f"  وضعیت بازبینی: {status} — امتیاز {review.score}/100")
    print(f"  طول متن: {qa['wordCount']} کلمه (~{qa['estimatedMinutes']} دقیقه) | "
          f"آماده انتشار: {'بله' if qa['readyToPublish'] else 'خیر'}")
    if review.issues:
        print("  ایرادها:")
        for i in review.issues:
            print(f"    - {i}")
    print("=" * 60)

    return {
        "json_path": json_path,
        "md_path": md_path,
        "notes_path": notes_path,
        "qa_path": qa_path,
        "tts_path": tts_path,
        "ssml_path": ssml_path,
        "tts_text": clean.text,
        "audio_path": base.with_suffix(".mp3"),
        "script": final_script,
        "review": review,
        "stories": stories,
        "qa_report": qa,
    }


def load_draft(json_path: str | Path) -> tuple[Script, str]:
    """اسکریپت و متن پاک TTS را از فایل JSON پیش‌نویس بازمی‌خواند."""
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    script = Script(**data["script"])
    tts_text = (data.get("tts_clean") or {}).get("text", "") or script.to_speech_text()
    return script, tts_text


def synthesize_draft(
    json_path: str | Path,
    config: Config,
    out_path: str | Path | None = None,
    require_approval: bool = True,
) -> Path:
    """از روی پیش‌نویس تأییدشده، صوت را سگمنت‌محور و ایدمپوتنت می‌سازد.

    طبق قانون سند، بدون تأیید معتبر متن، تولید صوت مجاز نیست.
    """
    json_path = Path(json_path)
    if require_approval:
        ok, reason = check_text_approval(json_path)
        if not ok:
            raise RuntimeError(f"تولید صوت مجاز نیست: {reason}")

    _script, tts_text = load_draft(json_path)
    out_path = Path(out_path) if out_path else json_path.with_suffix(".mp3")

    provider = get_tts_provider(config)
    episode_id = json_path.stem
    settings = {"stability": 0.5, "similarity_boost": 0.75}

    print(f"  → تولید صوت با Provider «{provider.name}» (سگمنت‌محور، ایدمپوتنت) ...")
    result = synthesize_segments(
        provider=provider,
        text=tts_text,
        out_dir=json_path.parent,
        episode_id=episode_id,
        approved_text_sha256=_sha256(tts_text),
        voice_id=config.elevenlabs_voice_id,
        model_id=config.elevenlabs_model_id,
        settings=settings,
    )
    print(f"     {result['generated']} بخش تولید شد، {result['skipped']} بخش از قبل موجود بود.")

    # مونتاژ + کنترل Loudness با ffmpeg
    seg_paths = [Path(s["audioPath"]) for s in sorted(result["manifest"]["segments"], key=lambda s: s["order"])]
    print("  → مونتاژ اینترو/گفتار/اوترو و نرمال‌سازی Loudness ...")
    report = assemble(
        segment_paths=seg_paths,
        out_dir=json_path.parent,
        episode_id=episode_id,
        intro_path=Path(config.audio.intro_path) if config.audio.intro_path else None,
        outro_path=Path(config.audio.outro_path) if config.audio.outro_path else None,
        target_lufs=config.audio.target_lufs,
        max_true_peak_db=config.audio.max_true_peak_db,
        sample_rate=config.audio.sample_rate,
    )

    qa_path = json_path.with_suffix(".audio-qa-report.json")
    qa_path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")

    if report.normalized:
        print(f"     Loudness: {report.output_lufs} LUFS (هدف {report.target_lufs}), "
              f"True Peak: {report.true_peak_db} dBTP, مدت: {report.duration_ms/1000:.1f}s")
        final_audio = Path(report.publish_path)
    else:
        # بازگشت: بدون ffmpeg، هم‌چسباندن ساده
        for w in report.warnings:
            print(f"     ⚠️  {w}")
        final_audio = concat_segments(result["manifest"], out_path)

    # فایل مرجع متن کنار صوت برای QA/ASR
    Path(final_audio).with_suffix(".tts.txt").write_text(tts_text, encoding="utf-8")
    print(f"  ✅ فایل صوتی: {final_audio}")

    # مرحله QA صوت با ASR: صوت را دوباره متن کن و با متن تأییدشده مقایسه کن
    print("  → کنترل کیفیت صوت با ASR (مقایسه متن/صوت) ...")
    asr = get_asr_provider(config)
    asr_result = asr.transcribe(str(final_audio))
    diff = diff_asr(tts_text, asr_result.text)
    diff_path = json_path.with_suffix(".asr-diff.json")
    diff_path.write_text(json.dumps(diff.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"     تطابق متن/صوت: {diff.match_ratio:.0%}"
          + (f" — {diff.blocker_count} بلاکر، {diff.major_count} مهم" if diff.items else " — بدون اختلاف"))
    if diff.blocker_count:
        print("     ⚠️  اختلاف بلاکر شناسایی شد — پیش از تأیید صوت بررسی کن.")

    return Path(final_audio)


def run_full(config: Config) -> dict:
    """پایپلاین را تا مرحله تأیید متن اجرا می‌کند و همان‌جا متوقف می‌شود.

    طبق سند، تولید صوت فقط پس از «تأیید صریح انسانی» مجاز است؛ بنابراین این
    فرمان صوت نمی‌سازد و مسیر تأیید را نمایش می‌دهد.
    """
    result = build_draft(config)
    json_path = result["json_path"]
    print(
        "\n📋 مراحل بعدی (دو دروازه تأیید انسانی):\n"
        f"  ۱) متن را بررسی کن:      {result['md_path']}\n"
        f"  ۲) تأیید متن:            python -m footcast approve-text {json_path}\n"
        f"  ۳) تولید صوت:            python -m footcast synthesize {json_path}\n"
        f"  ۴) تأیید صوت:            python -m footcast approve-audio {json_path}"
    )
    return result
