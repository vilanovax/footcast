# -*- coding: utf-8 -*-
"""ساخت کاملِ یک اپیزود نمونه + تولید فایل صوتی با ElevenLabs.

روی سیستم خودت (که به ElevenLabs دسترسی دارد) اجرا کن:

    python examples/make_real_episode.py

پیش‌نیازها در فایل .env:
    ELEVENLABS_API_KEY=...            # کلید تو
    ELEVENLABS_VOICE_ID=pqHfZKP75CvOlQylNhV4
    ELEVENLABS_MODEL_ID=eleven_v3     # یا eleven_multilingual_v2 اگر v3 در دسترس نبود
    TTS_PROVIDER=elevenlabs

خروجی: output/real-episode.audio-publish.mp3  (به‌همراه master.wav و گزارش‌ها)

اخبار این نمونه از جستجوی وب جمع‌آوری شده‌اند و باید پیش از انتشار
صحت‌سنجی انسانی شوند.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path

from footcast.audio import assemble
from footcast.branding import apply_branding
from footcast.colloquial import to_colloquial
from footcast.config import load_config
from footcast.glossary import load_glossary
from footcast.models import NewsItem, Script, Segment
from footcast.pronunciation import PronunciationDictionary
from footcast.providers import get_tts_provider
from footcast.review import review_script
from footcast.story import build_stories, select_for_episode
from footcast.tts_clean import clean_for_tts
from footcast.tts_job import synthesize_segments

cfg = load_config()
WHEN = datetime(2026, 7, 15, 12, tzinfo=timezone.utc)
OUT = Path("output"); OUT.mkdir(exist_ok=True)
EPISODE_ID = "real-episode"


def _news():
    N = lambda t, src, r, w, sc, summ: NewsItem(
        title=t, summary=summ, source=src, region=r, source_weight=w, score=sc,
        link=f"https://example.com/{abs(hash(t)) % 10000}",
        published=datetime.now(tz=timezone.utc))
    return [
        N("پرسپولیس فعال‌ترین تیم بازار تابستان؛ ویرا کارش را شروع کرد", "ورزش سه", "iran", 8, 40,
          "پرسپولیس بیشترین خرید تابستان را انجام داده و به بستن فهرستش نزدیک است؛ تیکدری رسما پیوست و ویرا اولین مصاحبه‌اش را انجام داد."),
        N("رامین رضاییان با پیشنهاد اروپایی؛ احتمال جدایی از استقلال", "خبرورزشی", "iran", 7, 33,
          "رضاییان پس از جام جهانی پیشنهاد اروپایی گرفته و احتمال جدایی‌اش از استقلال بالاست."),
        N("رئال مادرید دنزل دومفریس را رسما از اینتر خرید", "Goal", "europe", 9, 31,
          "رئال مادرید با فعال‌کردن بند فسخ بیست میلیون یورویی، دومفریس را با قرارداد چهارساله جذب کرد."),
        N("فنرباغچه در آستانه جذب میسون گرینوود از مارسی", "ESPN", "europe", 7, 24,
          "فنرباغچه بر سر انتقال گرینوود با مارسی به توافقی حدود چهل‌ودو میلیون یورو رسیده اما رسمی نشده."),
    ]


def build_episode() -> tuple[Script, str, PronunciationDictionary]:
    stories = select_for_episode(build_stories(_news()))
    used = [s for s in stories if s.used_in_episode]
    seg = lambda h, b, src: Segment(headline=h, body=b, source=src, link="")
    script = Script(
        show_name=cfg.content.show_name, date="2026-07-15",
        cold_hook="پرسپولیس شده پرخریدترین تیم بازار؛ ولی این‌همه بازیکن جدید، تیم می‌سازه یا فقط فهرست؟",
        segments=[
            seg("داستان اصلی؛ پرسپولیسِ پرخرید",
                "پرسپولیس شده فعال‌ترین تیم بازار و داره فهرستش رو می‌بنده. تیکدری رسما اضافه شده و "
                "ویرا اولین مصاحبه‌اش رو انجام داده. خرید زیاد یعنی جدیت؛ ولی همیشه تیم قوی نمی‌سازه. "
                "حالا کار ویراست که از این بازیکن‌ها یک تیم منسجم بسازه.", "ورزش سه"),
            seg("رادار فوتبال ایران؛ رضاییان",
                "رامین رضاییان بعد از جام جهانی پیشنهاد اروپایی گرفته و احتمال جدایی‌اش از استقلال بالا رفته. "
                "باید دید باشگاه چطور با این وضعیت کنار میاد.", "خبرورزشی"),
            seg("جهان در سه پاس",
                "توی اسپانیا، رئال مادرید دنزل دومفریس رو رسما از اینتر خرید؛ با فعال‌کردن بند فسخ بیست "
                "میلیون یورویی و قرارداد چهارساله.", "Goal"),
            seg("دماسنج شایعات؛ گرینوود",
                "فنرباغچه سر انتقال میسون گرینوود با مارسی به توافقی حدود چهل‌ودو میلیون یورو رسیده؛ "
                "دمای این خبر چهار از پنجه، توافق گزارش شده ولی تا اعلام رسمی مونده.", "ESPN"),
        ],
        question="به‌نظرت خرید زیادِ پرسپولیس نقطه‌ی قوته یا ریسک؟",
        outro="",
    )
    review = review_script(script, cfg)
    final = review.revised_script or script
    apply_branding(final, used, WHEN, cfg.content)
    glossary = load_glossary()
    polish = lambda t: to_colloquial(glossary.normalize(t))
    final.intro = polish(final.intro); final.outro = polish(final.outro)
    for s in final.segments:
        s.headline = polish(s.headline); s.body = polish(s.body)
    pron = PronunciationDictionary.load()
    clean = clean_for_tts(final.to_speech_text(), pronunciation=pron)
    return final, clean.text, pron


def _synthesize(tts_text, model_id):
    provider = get_tts_provider(cfg)
    if provider.name != "elevenlabs":
        raise SystemExit(
            "❌ Provider روی ElevenLabs نیست. در .env بگذار: TTS_PROVIDER=elevenlabs "
            "و ELEVENLABS_API_KEY=... ."
        )
    print(f"→ تولید صوت با model={model_id} voice={cfg.elevenlabs_voice_id} ...")
    settings = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0}
    return synthesize_segments(
        provider=provider, text=tts_text, out_dir=OUT, episode_id=EPISODE_ID,
        approved_text_sha256=hashlib.sha256((tts_text + model_id).encode()).hexdigest(),
        voice_id=cfg.elevenlabs_voice_id, model_id=model_id, settings=settings,
    )


def main() -> None:
    final, tts_text, _ = build_episode()
    (OUT / f"{EPISODE_ID}.tts.txt").write_text(tts_text, encoding="utf-8")
    print(f"متن TTS آماده شد ({len(tts_text.split())} کلمه).")

    # تلاش با مدل تنظیم‌شده؛ اگر شکست خورد (مثلاً v3 در دسترس نبود) به مدل پایدار برگرد
    model = cfg.elevenlabs_model_id
    try:
        res = _synthesize(tts_text, model)
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  خطا با مدل «{model}»: {exc}")
        if model != "eleven_multilingual_v2":
            print("↩︎  تلاش دوباره با مدل پایدار eleven_multilingual_v2 ...")
            try:
                res = _synthesize(tts_text, "eleven_multilingual_v2")
            except Exception as exc2:  # noqa: BLE001
                raise SystemExit(f"❌ تولید صوت ناموفق بود: {exc2}")
        else:
            raise SystemExit(f"❌ تولید صوت ناموفق بود: {exc}")
    print(f"  {res['generated']} بخش تولید شد، {res['skipped']} از قبل موجود.")

    seg_paths = [Path(s["audioPath"]) for s in sorted(res["manifest"]["segments"], key=lambda s: s["order"])]

    from footcast.audio import find_ffmpeg
    if find_ffmpeg() is None:
        # بدون ffmpeg هم حداقل بخش‌ها را به هم بچسبان تا فایلی داشته باشی
        from footcast.tts_job import concat_segments
        out = concat_segments(res["manifest"], OUT / f"{EPISODE_ID}.mp3")
        print(f"⚠️  ffmpeg نصب نیست (نرمال‌سازی انجام نشد). فایل خام: {out.resolve()}")
        return

    report = assemble(
        seg_paths, OUT, EPISODE_ID,
        intro_path=Path(cfg.audio.intro_path) if cfg.audio.intro_path else None,
        outro_path=Path(cfg.audio.outro_path) if cfg.audio.outro_path else None,
        target_lufs=cfg.audio.target_lufs, max_true_peak_db=cfg.audio.max_true_peak_db,
        sample_rate=cfg.audio.sample_rate,
    )
    mp3 = Path(report.publish_path)
    if report.normalized and mp3.exists():
        print(f"\n✅ فایل صوتی ساخته شد: {mp3.resolve()}")
        print(f"   Loudness: {report.output_lufs} LUFS | True Peak: {report.true_peak_db} dBTP | مدت: {report.duration_ms/1000:.1f}s")
    else:
        print("⚠️ مونتاژ/نرمال‌سازی کامل نشد:", "؛ ".join(report.warnings) or "نامشخص")
        # فایل‌های بخش‌ها همچنان موجودند
        print("بخش‌های صوتی خام در:", (OUT / f"{EPISODE_ID}-segments").resolve())


if __name__ == "__main__":
    main()
