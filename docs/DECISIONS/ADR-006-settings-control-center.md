# ADR-006 — Settings Control Center

## وضعیت

پذیرفته — ۲۰۲۶-۰۷-۱۸

## زمینه

کلید AI و چند AppSetting برای محصول کافی نیست. مدل‌ها، ممیزی، قواعد، زمان‌بندی و هزینه باید از یک نقطه بدون تغییر کد کنترل شوند.

## تصمیم

1. تنظیمات = مرکز کنترل عملیاتی با بخش‌های جدا (Providers، Pipeline، Audit، Editorial، …).
2. کانفیگ در `AppSetting` با کلیدهای `control.*` و تایپ در `@footcast/shared`.
3. رازها AES-GCM؛ هرگز plaintext به کلاینت.
4. مدل ممیز مستقل از مدل تولید؛ سیاست `OFF|SAMPLE|ALL` + `blocking`.
5. RBAC: کلید/Provider/Cost فقط `settings:write`؛ سردبیر قواعد و پوشش را می‌بیند.

## پیامدها

- UI `/settings?section=` چندبخشی
- Worker باید به‌تدریج از env به `control.*` مهاجرت کند
- Audit تغییر کلید و Override در `audit_logs`
