# ADR-007 — Auto Editorial Selection (Policy Engine)

## وضعیت

پذیرفته — ۲۰۲۶-۰۷-۱۸ (فاز ۱–۶: اسکما + engine + worker + UI + Undo/Rule Audit + AI Audit)

## زمینه

امتیازدهی ترکیبی (`finalScore` / `credibilityScore` / `recommendation`) و Coverage Intelligence وجود دارد، ولی بعد از امتیاز هیچ Policy Engineی تصمیم نمی‌گیرد که خبر فقط علامت شود، به Today پیشنهاد شود، یا با گارد سخت وارد سبد امروز شود. سردبیر امروز همهٔ انتقال‌ها را دستی انجام می‌دهد.

## تصمیم

1. **سه قابلیت مستقل** (نه یک سوییچ):
   - `autoHighlightImportant` — badge / فیلتر / مرتب‌سازی / اعلان؛ **بدون** جابه‌جایی Event یا Rundown
   - `autoSuggestForRundown` — پیشنهاد ADD یا REPLACE با دلیل؛ بدون تغییر Rundown تا تأیید سردبیر
   - `autoAddToRundown` — فقط با گارد سخت؛ آیتم با `addedMode=AUTO` و `status=SHORTLISTED` (نه `FINAL_SELECTED`)

2. **Highlight روی `recommendation` موجود سوار می‌شود** (`LEAD_STORY` / `INCLUDE_IN_MAIN_PODCAST` / …) — enum موازی اهمیت ساخته نمی‌شود.

3. **حضور در Today ≠ `EventStatus.APPROVED`** (ADR-004). Auto Add فقط `DailyRundownItem` می‌سازد.

4. تنظیمات در `AppSetting` کلید `control.editorial.automation` + پروفایل‌های preset: `MANUAL` | `ASSISTED` | `CONTROLLED_AUTO`. پیش‌فرض MVP: **ASSISTED**.

5. هر تصمیم در `editorial_automation_decisions` لاگ می‌شود (idempotent؛ Auto Add تکراری برای یک Event در یک Rundown ممنوع).

6. در v1: **بدون** Auto Remove و **بدون** Auto Replace — فقط پیشنهاد جایگزینی.

7. کنترل نهایی و Undo همیشه با سردبیر است؛ Full Auto / autoFinalize در این فاز نیست.

## پیامدها

- Package: `@footcast/editorial-automation` — `evaluateAutomationPolicy` (بدون I/O)
- Worker: `applyEditorialAutomationAfterScore` بعد از score (persist + AUTO_ADD اختیاری)
- UI: inbox badges/فیلتر؛ Today با `addedMode` + تأیید/رد/Undo خودکار
- Migration: ستون‌های rundown + جدول تصمیمات (انجام‌شده)
- Rule Audit قبل از AUTO_ADD؛ Undo: `POST /rundown/items/:id/undo-auto`
- AI Audit: `runAutoAddAiAudit` (Mock/OpenAI-compatible) + `applyAiAuditGate`؛ fail-closed

## غیرهدف فعلی

- Full Auto / autoFinalize
- اجرای Auto Remove / Auto Replace
