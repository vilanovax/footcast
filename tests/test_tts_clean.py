"""تست‌های فاز A: عدد فارسی، فرهنگ تلفظ و متن پاک TTS."""

from footcast.persian_num import integer_to_words, number_to_words, normalize_digits
from footcast.pronunciation import PronunciationDictionary, PronunciationEntry
from footcast.tts_clean import clean_for_tts


# --- عدد به حروف ---
def test_integer_to_words_basic():
    assert integer_to_words(0) == "صفر"
    assert integer_to_words(1) == "یک"
    assert integer_to_words(15) == "پانزده"
    assert integer_to_words(21) == "بیست و یک"
    assert integer_to_words(100) == "صد"
    assert integer_to_words(275) == "دویست و هفتاد و پنج"


def test_integer_to_words_large():
    assert integer_to_words(1000) == "یک هزار"
    assert integer_to_words(1_500_000) == "یک میلیون و پانصد هزار"


def test_number_to_words_decimal():
    assert "ممیز" in number_to_words("3.5")


def test_normalize_digits():
    assert normalize_digits("۲۰۲۶") == "2026"


# --- فرهنگ تلفظ ---
def _dict():
    return PronunciationDictionary([
        PronunciationEntry("Real Madrid", "رئال مادرید", "رِآل مادرید", "TEAM", True),
        PronunciationEntry("Real", "رئال", "رِآل", "TEAM", True),
    ])


def test_pronunciation_prefers_longer_match():
    res = _dict().apply("امشب Real Madrid بازی دارد")
    assert "رِآل مادرید" in res.text
    assert "Real" not in res.text


def test_pronunciation_flags_unknown_latin():
    res = _dict().apply("بازیکن Foobar گل زد")
    assert "Foobar" in res.warnings


# --- متن پاک TTS ---
def test_clean_strips_markdown_and_url():
    out = clean_for_tts("**مهم** ببینید [اینجا](https://x.com) و https://y.com")
    assert "*" not in out.text
    assert "http" not in out.text


def test_clean_converts_score():
    out = clean_for_tts("نتیجه بازی 2-1 شد")
    assert "دو بر یک" in out.text
    assert "2-1" not in out.text


def test_clean_converts_time():
    out = clean_for_tts("بازی ساعت 17:30 است")
    assert "هفده و نیم" in out.text


def test_clean_converts_standalone_number():
    out = clean_for_tts("او 275 بازی انجام داد")
    assert "دویست و هفتاد و پنج" in out.text
    assert "275" not in out.text


def test_clean_removes_latin_in_parens():
    out = clean_for_tts("امباپه (Mbappe) گل زد")
    assert "Mbappe" not in out.text


def test_clean_reports_long_sentence():
    long_sentence = " ".join(["کلمه"] * 30)
    out = clean_for_tts(long_sentence, max_sentence_words=25)
    assert any("کلمه" in i for i in out.issues)


def test_clean_no_digits_remain():
    out = clean_for_tts("۳ گل در ۹۰ دقیقه")
    assert not any(ch.isdigit() for ch in out.text)
