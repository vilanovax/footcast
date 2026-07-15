"""تست‌های فرهنگ واژگان فوتبال (نرمال‌سازی + تلفظ)."""

from footcast.glossary import load_glossary
from footcast.pronunciation import PronunciationDictionary
from footcast.tts_clean import clean_for_tts


def test_normalize_counterattack():
    g = load_glossary()
    assert g.normalize("فرانسه روی کانتر اتک خطرناکه") == "فرانسه روی ضدحمله خطرناکه"
    assert g.normalize("یک کانتراتک سریع") == "یک ضدحمله سریع"


def test_normalize_cross_and_header():
    g = load_glossary()
    assert "سانتر" in g.normalize("یک کراس بلند")
    assert "ضربه سر" in g.normalize("با یک هدر گل زد")


def test_normalize_keeps_natural_terms():
    g = load_glossary()
    # اصطلاح جاافتاده نباید تغییر کند
    text = "تیم توی ترنزیشن حمله سریعه"
    assert g.normalize(text) == text


def test_normalize_longer_match_first():
    g = load_glossary()
    # «کانتر اتک» باید کامل جایگزین شود، نه فقط «کانتر»
    assert g.normalize("کانتر اتک") == "ضدحمله"


def test_glossary_feeds_pronunciation():
    pron = PronunciationDictionary.load()
    res = pron.apply("تیم کام‌بک کرد و VAR بررسی شد")
    # اصطلاح به شکل تلفظ درست تبدیل می‌شود
    assert "کام‌بَک" in res.text
    # VAR به شکل فارسی تبدیل و دیگر هشدار لاتین نمی‌دهد
    assert "VAR" not in res.text
    assert "وی اِی آر" in res.text


def test_tts_clean_pronounces_football_terms():
    out = clean_for_tts("اسپانیا با های‌پرس شروع کرد و کلین‌شیت کرد",
                        pronunciation=PronunciationDictionary.load())
    assert "های پِرِس" in out.text
    assert "کِلین شیت" in out.text


def test_var_not_flagged_as_unknown():
    out = clean_for_tts("داور بعد از VAR تصمیم گرفت",
                        pronunciation=PronunciationDictionary.load())
    # VAR در فرهنگ هست، پس نباید به‌عنوان نام ناشناخته هشدار بدهد
    assert "VAR" not in out.pronunciation_warnings
