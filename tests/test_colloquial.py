"""تست‌های بازنویسی «محاوره معیار»."""

from footcast.colloquial import find_over_colloquial, to_colloquial


def test_future_formal_becomes_colloquial():
    assert to_colloquial("این بازی روز سه‌شنبه برگزار خواهد شد") == \
        "این بازی روز سه‌شنبه برگزار می‌شه"


def test_common_verbs():
    assert to_colloquial("این تیم می‌تواند برنده شود") == "این تیم می‌تونه برنده شود"
    assert to_colloquial("آن‌ها بازیکن خوبی دارند") == "اون‌ها بازیکن خوبی دارن"


def test_present_perfect_drops_ast():
    assert to_colloquial("باشگاه قرارداد را تأیید کرده است") == \
        "باشگاه قرارداد رو تأیید کرده"


def test_adjective_ast_merges():
    assert to_colloquial("فرانسه تیم خطرناکی است") == "فرانسه تیم خطرناکیه"


def test_administrative_phrases():
    assert "درباره" in to_colloquial("در خصوص این بازیکن")
    assert to_colloquial("مدیر باشگاه اظهار داشت") == "مدیر باشگاه گفت"


def test_ra_becomes_ro():
    assert to_colloquial("این بازیکن را دیدم") == "این بازیکن رو دیدم"
    # نباید داخل کلمات دیگر مثل «برای» یا «چرا» اثر بگذارد
    assert to_colloquial("برای تیم") == "برای تیم"


def test_fix_over_colloquial_forms():
    assert to_colloquial("تیم واسه قهرمانی می‌خاد تلاش کنه") == \
        "تیم برای قهرمانی می‌خواد تلاش کنه"


def test_does_not_break_negated_verb():
    # «ندارد» نباید از «دارد» متأثر شود
    assert to_colloquial("این تیم مهاجم ندارد") == "این تیم مهاجم نداره"


def test_find_over_colloquial_flags_forbidden():
    flags = find_over_colloquial("این بازیکن ترکوند و آخه چی بگم")
    assert "ترکوند" in flags
    assert "آخه" in flags


def test_clean_text_has_no_forbidden():
    assert find_over_colloquial("این بازی سه‌شنبه برگزار می‌شه") == []


def test_multiword_before_singleword():
    # «برگزار خواهد شد» کامل جایگزین شود، نه فقط «خواهد شد»
    assert to_colloquial("مسابقه برگزار خواهد شد") == "مسابقه برگزار می‌شه"
