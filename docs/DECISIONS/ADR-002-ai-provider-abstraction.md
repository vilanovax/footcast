# ADR-002 — Abstraction لایه AI Provider

## وضعیت

پذیرفته‌شده — 2026-07-17

## زمینه

چندین Provider (Anthropic, OpenAI, Google, DeepSeek, OpenRouter, Local, Custom) و نیاز به تعویض مدل per pipeline stage بدون تغییر business logic. هزینه و vendor lock-in ریسک اصلی است.

## تصمیم

1. پکیج `@footcast/ai` با رابط `AiProvider` یکسان.
2. انتخاب Provider/Model از DB (`AIPipeline` / settings) نه hard-code.
3. `MockAiProvider` برای تست و توسعه آفلاین.
4. هر فراخوانی → `AIRequest` + usage/cost + `promptVersionId`.
5. خروجی structured با JSON Schema validation قبل از persist.
6. مدل گران فقط روی کارت‌های خلاصه در مرحله editorial.

## پیامدها

- تعویض مدل بدون deploy منطق دامنه
- هزینه قابل‌ردیابی per stage
- تأخیر اولیه برای پیاده‌سازی adapterها — قابل قبول

## جایگزین ردشده

فراخوانی مستقیم SDK در سرویس‌های دامنه — باعث lock-in و تست سخت می‌شود.
