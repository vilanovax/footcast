"""تبدیل عدد به حروف فارسی برای متن آماده گفتار (TTS).

TTS نباید اعداد رقمی را ببیند؛ باید به حروف خوانده شوند.
"""

from __future__ import annotations

_ONES = [
    "", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه",
    "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده",
    "هفده", "هجده", "نوزده",
]
_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"]
_HUNDREDS = [
    "", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد",
    "هشتصد", "نهصد",
]
_SCALES = ["", "هزار", "میلیون", "میلیارد", "بیلیون"]

# نگاشت ارقام فارسی/عربی به لاتین
_DIGIT_MAP = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_digits(text: str) -> str:
    """ارقام فارسی/عربی را به ارقام لاتین تبدیل می‌کند."""
    return text.translate(_DIGIT_MAP)


def _three_digits_to_words(n: int) -> str:
    """تبدیل عددی بین ۰ تا ۹۹۹ به حروف."""
    parts: list[str] = []
    hundreds = n // 100
    rem = n % 100
    if hundreds:
        parts.append(_HUNDREDS[hundreds])
    if rem:
        if rem < 20:
            parts.append(_ONES[rem])
        else:
            tens = rem // 10
            ones = rem % 10
            if ones:
                parts.append(f"{_TENS[tens]} و {_ONES[ones]}")
            else:
                parts.append(_TENS[tens])
    return " و ".join(parts)


def integer_to_words(n: int) -> str:
    """تبدیل یک عدد صحیح به حروف فارسی."""
    if n == 0:
        return "صفر"
    negative = n < 0
    n = abs(n)

    # عدد را به گروه‌های سه‌رقمی از راست تقسیم می‌کنیم
    groups: list[int] = []
    while n > 0:
        groups.append(n % 1000)
        n //= 1000

    words: list[str] = []
    for idx in range(len(groups) - 1, -1, -1):
        group = groups[idx]
        if group == 0:
            continue
        chunk = _three_digits_to_words(group)
        scale = _SCALES[idx] if idx < len(_SCALES) else ""
        words.append(f"{chunk} {scale}".strip())

    result = " و ".join(words)
    return f"منفی {result}" if negative else result


def number_to_words(token: str) -> str:
    """رشته‌ای که ممکن است عدد صحیح یا اعشاری باشد را به حروف تبدیل می‌کند."""
    token = normalize_digits(token).strip()
    token = token.replace(",", "").replace("،", "")
    if not token:
        return token

    if "." in token:
        int_part, frac_part = token.split(".", 1)
        int_words = integer_to_words(int(int_part)) if int_part else "صفر"
        # بخش اعشاری رقم‌به‌رقم خوانده می‌شود
        frac_words = " ".join(_ONES[int(d)] if int(d) else "صفر" for d in frac_part)
        return f"{int_words} ممیز {frac_words}"

    try:
        return integer_to_words(int(token))
    except ValueError:
        return token
