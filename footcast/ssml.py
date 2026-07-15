"""تولید نسخه SSML متن TTS با مکث‌های طبیعی بین بخش‌ها (§۶، §۸).

اگر موتور TTS از SSML پشتیبانی کند (مثل ElevenLabs با <break/>)، این نسخه
مکث‌ها را دقیق‌تر کنترل می‌کند. نسخه متنی ساده هم همچنان تولید می‌شود.
"""

from __future__ import annotations

from .models import Script
from .pronunciation import PronunciationDictionary
from .tts_clean import clean_for_tts

# مکث‌های پیشنهادی (§۶)
PAUSE_AFTER_INTRO_MS = 900       # پیش از داستان اصلی
PAUSE_BETWEEN_SEGMENTS_MS = 700  # میان بخش‌ها
PAUSE_HEADLINE_BODY_MS = 400     # میان تیتر و متن
PAUSE_BEFORE_OUTRO_MS = 1000     # پیش از سؤال روز و پایان


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _clean(text: str, pron: PronunciationDictionary | None) -> str:
    return _escape(clean_for_tts(text, pronunciation=pron).text)


def _break(ms: int) -> str:
    return f'  <break time="{ms}ms"/>'


def build_ssml(script: Script, pronunciation: PronunciationDictionary | None = None) -> str:
    """اسکریپت را به SSML با مکث‌های بخش‌بندی‌شده تبدیل می‌کند."""
    pron = pronunciation or PronunciationDictionary.load()
    lines = ["<speak>"]

    if script.intro:
        lines.append("  " + _clean(script.intro, pron))
        lines.append(_break(PAUSE_AFTER_INTRO_MS))

    for i, seg in enumerate(script.segments):
        if seg.headline:
            lines.append("  " + _clean(seg.headline, pron))
            lines.append(_break(PAUSE_HEADLINE_BODY_MS))
        if seg.body:
            lines.append("  " + _clean(seg.body, pron))
        if i < len(script.segments) - 1:
            lines.append(_break(PAUSE_BETWEEN_SEGMENTS_MS))

    if script.outro:
        lines.append(_break(PAUSE_BEFORE_OUTRO_MS))
        lines.append("  " + _clean(script.outro, pron))

    lines.append("</speak>")
    return "\n".join(lines)
