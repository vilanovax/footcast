# Coverage Intelligence

منبع: [ADR-005](./DECISIONS/ADR-005-coverage-intelligence.md)

## شمارنده‌ها

| شمارنده | معنی |
|---------|------|
| discoveredEventCount | NewsEvent یکتا با مشاهدهٔ معنادار موج امروز یا first/lastSeen در روز تهران |
| eligibleEventCount | final≥70 و credibility≥60 و نه REJECTED/ARCHIVED/MERGED |
| selectedEventCount | آیتم فعال DailyRundown امروز |

## وضعیت Bucket

`NO_AVAILABLE_NEWS` · `AVAILABLE_NOT_SELECTED` · `UNDER_TARGET` · `ON_TARGET` · `OVER_TARGET` · `NO_TARGET`

## دادهٔ قدیمی

Eventهای بدون junction با `tagNewsEventTaxonomy` از `eventSignature` + عنوان برچسب می‌خورند (best-effort). فیلد `untaggedEventCount` در پاسخ API تعداد باقی‌مانده را نشان می‌دهد.

## API

- `GET /editorial/coverage/today`
- `GET /editorial/days/:editorialDate/coverage`
- `GET /editorial/rundowns/:rundownId/coverage`

Recommendationها فقط پیشنهادی‌اند؛ Rundown را تغییر نمی‌دهند.
