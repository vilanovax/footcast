"""تست‌های فاز B: بازبینی سه‌مرحله‌ای (مسیر پایه، بدون کلید API)."""

from footcast.config import ContentConfig, SelectionConfig, Config, Source
from footcast.models import Script, Segment
from footcast.review import review_script, _basic_checks, _formal_language_check


def _cfg() -> Config:
    # بدون کلید API → مسیر بازبینی پایه
    return Config(
        sources=[Source(name="s", url="x")],
        selection=SelectionConfig(),
        content=ContentConfig(),
    )


def _good_script() -> Script:
    return Script(
        show_name="فوت‌کست", date="2026-07-15",
        intro="سلام. امروز با مهم‌ترین خبرها همراهتون هستیم.",
        segments=[
            Segment(headline="پیروزی پرسپولیس",
                    body="پرسپولیس در بازی دیشب به پیروزی رسید و صعود کرد."),
        ],
        outro="تا بسته بعدی مراقب خودتون باشین.",
    )


def test_review_returns_three_passes():
    result = review_script(_good_script(), _cfg())
    assert len(result.passes) == 3
    numbers = [p.pass_number for p in result.passes]
    assert numbers == [1, 2, 3]


def test_review_approves_clean_script():
    result = review_script(_good_script(), _cfg())
    assert result.approved is True


def test_basic_checks_flags_short_body():
    script = Script(show_name="x", date="d",
                    segments=[Segment(headline="تیتر", body="کوتاه")])
    issues = _basic_checks(script)
    assert any("کوتاه" in i or "خالی" in i for i in issues)


def test_formal_language_flagged_in_pass2():
    script = Script(
        show_name="x", date="d",
        segments=[Segment(headline="خبر", body="این انتقال مورد تأیید قرار گرفت و انجام خواهد شد.")],
    )
    issues = _formal_language_check(script)
    assert any("رسمی" in i for i in issues)


def test_review_score_is_average_of_passes():
    result = review_script(_good_script(), _cfg())
    expected = sum(p.score for p in result.passes) // len(result.passes)
    assert result.score == expected
