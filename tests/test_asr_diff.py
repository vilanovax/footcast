"""تست‌های فاز G: نرمال‌سازی و مقایسه ASR."""

from footcast.asr_diff import (
    BLOCKER,
    NUMBER_MISMATCH,
    WORD_INSERTION,
    WORD_OMISSION,
    diff_asr,
    normalize_persian,
)


def test_normalize_unifies_ye_and_ke():
    assert normalize_persian("مﻻقات كرد") == normalize_persian("مﻻقات کرد")
    assert "ي" not in normalize_persian("ايران")
    assert "ك" not in normalize_persian("كشور")


def test_normalize_removes_punctuation_and_zwnj():
    out = normalize_persian("تیم‌ملی، برنده شد!")
    assert "،" not in out and "!" not in out


def test_identical_text_perfect_match():
    text = "پرسپولیس دو بر یک برنده شد و صعود کرد."
    report = diff_asr(text, text)
    assert report.match_ratio == 1.0
    assert report.items == []


def test_empty_asr_flags_section_missing():
    report = diff_asr("متن کامل اینجاست و طولانی است.", "")
    assert report.blocker_count >= 1


def test_number_mismatch_is_blocker():
    approved = "نتیجه بازی دو بر یک شد"
    heard = "نتیجه بازی سه بر یک شد"
    report = diff_asr(approved, heard)
    types = [i.type for i in report.items]
    assert NUMBER_MISMATCH in types
    assert report.blocker_count >= 1


def test_word_omission_detected():
    approved = "تیم ملی ایران اردو برگزار کرد"
    heard = "تیم ملی اردو برگزار کرد"
    report = diff_asr(approved, heard)
    assert any(i.type in (WORD_OMISSION, "SECTION_MISSING") for i in report.items)


def test_word_insertion_detected():
    approved = "پرسپولیس برنده شد"
    heard = "پرسپولیس قطعاً برنده شد"
    report = diff_asr(approved, heard)
    assert any(i.type == WORD_INSERTION for i in report.items)


def test_report_to_dict_structure():
    report = diff_asr("یک دو سه", "یک دو چهار")
    d = report.to_dict()
    assert "matchRatio" in d and "items" in d and "blockerCount" in d
