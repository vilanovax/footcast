"""تست‌های استاندارد تولید TTS: سه نسخه نام + SSML."""

from footcast.models import Script, Segment
from footcast.pronunciation import PronunciationDictionary, PronunciationEntry
from footcast.ssml import build_ssml
from footcast.tts_clean import clean_for_tts


def _dict():
    return PronunciationDictionary([
        PronunciationEntry("Mikel Merino", "میکل مرینو", "میکل مِرینو", "PLAYER", True, "es"),
        PronunciationEntry("کرنر", "کرنر", "کُرنِر", "TERM", True),  # اصطلاح، نباید annotate شود
    ])


# --- سه نسخه نام (§۱، §۱۵) ---
def test_editorial_annotates_with_parens():
    out = _dict().annotate("گل را میکل مرینو زد", style="editorial")
    assert "میکل مرینو (Mikel Merino)" in out


def test_publish_annotates_with_dash():
    out = _dict().annotate("گل را میکل مرینو زد", style="publish")
    assert "میکل مرینو — Mikel Merino" in out


def test_annotation_only_first_mention():
    out = _dict().annotate("میکل مرینو ... و باز هم میکل مرینو", style="editorial")
    assert out.count("(Mikel Merino)") == 1


def test_terms_are_not_annotated():
    # اصطلاح فوتبالی (TERM) نباید با انگلیسی همراه شود
    out = _dict().annotate("یک کرنر خطرناک", style="editorial")
    assert "(" not in out


def test_tts_version_has_no_english():
    # نسخه TTS باید بدون انگلیسی و با تلفظ درست باشد
    res = clean_for_tts("گل را Mikel Merino زد", pronunciation=_dict())
    assert "Mikel" not in res.text
    assert "میکل مِرینو" in res.text


# --- SSML (§۸) ---
def _script():
    return Script(
        show_name="x", date="d",
        intro="سلام. من ساشا هستم.",
        segments=[Segment(headline="خبر اول", body="متن خبر اول اینجاست.")],
        outro="تا بسته بعدی.",
    )


def test_ssml_wraps_speak():
    out = build_ssml(_script(), _dict())
    assert out.startswith("<speak>")
    assert out.endswith("</speak>")


def test_ssml_has_breaks():
    out = build_ssml(_script(), _dict())
    assert "<break" in out


def test_ssml_escapes_special_chars():
    script = Script(show_name="x", date="d", intro="سلام & خوش آمدید",
                    segments=[Segment(headline="ت", body="م")], outro="پایان")
    out = build_ssml(script, _dict())
    assert "&amp;" in out
    assert "سلام &" not in out.replace("&amp;", "")
