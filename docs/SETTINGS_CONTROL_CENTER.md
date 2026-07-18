# مرکز کنترل تنظیمات (Settings Control Center)

تنظیمات ماژول اصلی عملیاتی است — نه فقط فرم API Key. از این نقطه مدل‌ها، قواعد سردبیری، زمان‌بندی، هزینه و ممیزی کنترل می‌شوند بدون Hardcode در کد.

## منو

```text
تنظیمات
├── عمومی
├── مدل‌ها و Providerها          (Admin)
├── تخصیص مدل‌ها به Pipeline     (Admin)
├── Promptها
├── ممیزی هوش مصنوعی             (Admin)
├── قواعد سردبیری
├── وزن تیم‌ها و لیگ‌ها
├── اهداف پوشش
├── زمان‌بندی موج‌ها
├── هزینه و بودجه                (Admin)
├── آستانه‌های کیفیت
├── TTS و تلفظ                   (Admin)
├── اعلان‌ها
├── انتشار
├── Feature Flags                (Admin)
├── Safe Mode                    (Admin)
├── Audit Logs                   (Admin)
└── Test Center                  (Admin)
```

دسترسی: `settings:read` برای مشاهده؛ `settings:write` (system_admin) برای کلیدها و تغییر سیاست‌ها. سردبیر قواعد/وزن/پوشش را می‌بیند؛ کلید خام فقط Admin.

## ذخیره‌سازی

کلیدهای `AppSetting` با پیشوند `control.*` (JSON). API Key هر Provider جدا و AES-GCM (`SECRETS_ENCRYPTION_KEY`)؛ در پاسخ فقط `configured` + `last4`.

| Key | محتوا |
|-----|--------|
| `control.ai.providers` | فهرست Provider |
| `control.ai.pipeline` | نگاشت مرحله → مدل |
| `control.ai.audit_policies` | سیاست ممیزی |
| `control.editorial.rules` | آستانه‌های سردبیری |
| `control.scheduling` | موج‌ها + قفل |
| `control.cost` | بودجه |
| `control.quality` | کیفیت |
| `control.tts` | صوت + تلفظ |
| `control.notifications` | اعلان‌ها |
| `control.publishing` | انتشار |
| `control.feature_flags` | فلگ‌ها |
| `control.safe_mode` | حالت امن |
| `control.ai.provider.{id}.api_key` | راز رمزنگاری‌شده |

Defaults: `packages/shared/src/settings-control.ts`

## API

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/settings/control` | کل مرکز کنترل (رازها ماسک) |
| PATCH | `/settings/control/:section` | به‌روزرسانی یک بخش |
| POST | `/settings/control/providers/:id/test` | تست اتصال (Admin) |
| POST | `/settings/control/providers/:id/key` | تنظیم/پاک کردن کلید |

## اصول ممیزی AI

- مدل ممیز ≠ مدل تولیدکننده (ترجیحاً)
- حالت: `OFF` | `SAMPLE` | `ALL`
- `blocking=true` روی اسکریپت پادکست → بدون ممیزی موفق، انتشار ممنوع

## Safe Mode

فعال‌سازی دستی یا با عبور از سقف هزینه: بدون مدل گران، بدون AI merge، انتشار فقط با تأیید کامل انسانی.

## فازبندی

1. **الان:** UI مرکز کنترل + persistence JSON + کلید رمزنگاری + تست mock
2. **بعد:** worker/pipeline واقعاً از `control.ai.pipeline` بخواند
3. **بعد:** اجرای AuditPolicy در صف‌ها + Test Center واقعی
