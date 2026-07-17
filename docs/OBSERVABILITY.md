# Observability — Football Newsroom

## لاگ

- Structured JSON
- فیلدهای استاندارد: `timestamp`, `level`, `message`, `service`, `requestId`, `jobId`, `traceId`, `userId?`
- عدم ثبت secret و ترجیحاً عدم ثبت HTML خام کامل

## شناسه‌های همبستگی

| ID | تولید | انتشار |
|----|--------|--------|
| requestId | API middleware | پاسخ + لاگ |
| jobId | BullMQ job | worker logs |
| traceId | از header یا جدید | بین سرویس‌ها |

## Health

`GET /health`:

```json
{
  "status": "healthy",
  "timestamp": "ISO_DATE",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "crawler": "unknown",
    "worker": "unknown",
    "storage": "unknown"
  }
}
```

همچنین:

- `/health/live` — فرآیند زنده است
- `/health/ready` — DB + Redis آماده
- `/metrics` — شمارنده‌های پایه (فازهای بعدی Prometheus)

## متریک‌های دامنه

- زمان پاسخ مدل
- مصرف توکن و هزینه
- خطای Provider و تعداد Retry
- نرخ خطای crawler
- عمق صف‌ها
- latency pipeline per stage

## خطا

- Error Tracking متمرکز (Sentry یا معادل — اختیاری فاز صفر)
- JobError و CrawlError در DB برای پنل

## داشبورد صف

در فازهای بعدی: UI وضعیت BullMQ (waiting/active/failed/delayed) + manual retry.
