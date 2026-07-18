# ADR-005 — Coverage Intelligence برای مخزن روز

## وضعیت

پذیرفته‌شده — ۱۴۰۵/۰۴/۲۷ (2026-07-18)

## زمینه

Wave و DailyRundown وجود دارند ولی سردبیر نمی‌بیند امروز از هر تیم/لیگ/تورنمنت چند خبر استخراج، واجد شرایط، یا انتخاب شده است.

## تصمیم

1. تاکسونومی پایدار: `EditorialTeam`, `Competition`, `TrackedEvent` + junction با `NewsEvent`
2. سه شمارنده: discovered / eligible / selected (بر اساس NewsEvent یکتا)
3. `CoverageTarget` (عمدتاً SOFT) + `EditorialEntityWeight`
4. Recommendation فقط Rule-based؛ بدون تغییر خودکار Rundown
5. تاریخ: `editorialDate` + `Asia/Tehran`

## پیامدها

- Event قدیمی بدون junction از `eventSignature` + alias به‌صورت best-effort برچسب می‌خورد
- شمارش چندبعدی است؛ جمع تیم‌ها ≠ Scope
