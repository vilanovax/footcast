"""تبدیل تاریخ میلادی به شمسی و قالب‌بندی گفتاری آن (برای امضای برنامه).

تاریخ به وقت تهران (UTC+3:30، بدون ساعت تابستانی) محاسبه می‌شود.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .persian_num import integer_to_words

TEHRAN_TZ = timezone(timedelta(hours=3, minutes=30))

# نمایه بر اساس datetime.weekday(): دوشنبه=۰ ... یک‌شنبه=۶
_WEEKDAYS = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یک‌شنبه"]

_MONTHS = ["", "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
           "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]

# روزِ ماه به‌صورت ترتیبی (۱ تا ۳۱)
_DAY_ORDINAL = [
    "", "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم",
    "یازدهم", "دوازدهم", "سیزدهم", "چهاردهم", "پانزدهم", "شانزدهم", "هفدهم",
    "هجدهم", "نوزدهم", "بیستم", "بیست‌ویکم", "بیست‌ودوم", "بیست‌وسوم",
    "بیست‌وچهارم", "بیست‌وپنجم", "بیست‌وششم", "بیست‌وهفتم", "بیست‌وهشتم",
    "بیست‌ونهم", "سی‌ام", "سی‌ویکم",
]


def gregorian_to_jalali(gy: int, gm: int, gd: int) -> tuple[int, int, int]:
    """تبدیل تاریخ میلادی به شمسی (الگوریتم استاندارد)."""
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    if gy > 1600:
        jy = 979
        gy -= 1600
    else:
        jy = 0
        gy -= 621
    gy2 = gy + 1 if gm > 2 else gy
    days = (365 * gy + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400
            - 80 + gd + g_d_m[gm - 1])
    jy += 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31
        jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30
        jd = 1 + (days - 186) % 30
    return jy, jm, jd


def now_tehran() -> datetime:
    """اکنون به وقت تهران."""
    return datetime.now(tz=timezone.utc).astimezone(TEHRAN_TZ)


def format_persian_date(dt: datetime, with_weekday: bool = True, with_year: bool = False) -> str:
    """تاریخ شمسی گفتاری، مثل «دوشنبه، بیست‌ودوم تیر».

    طبق راهنما، سال فقط در صورت نیاز (اپیزود اول سال، مناسبت خاص یا ابهام) گفته شود.
    """
    local = dt.astimezone(TEHRAN_TZ)
    _, jm, jd = gregorian_to_jalali(local.year, local.month, local.day)
    day_month = f"{_DAY_ORDINAL[jd]} {_MONTHS[jm]}"

    if with_weekday:
        result = f"{_WEEKDAYS[local.weekday()]}، {day_month}"
    else:
        result = day_month

    if with_year:
        jy, _, _ = gregorian_to_jalali(local.year, local.month, local.day)
        result += f" {integer_to_words(jy)}"
    return result
