# امنیت — Football Newsroom

## احراز هویت

- JWT Access Token (کوتاه‌عمر، مثلاً ۱۵ دقیقه)
- Refresh Token Rotation (ذخیره hash در DB، ابطال در logout/reuse detection)
- رمز عبور با bcrypt/argon2
- عدم نگهداری plain secret در log

## مجوزدهی (RBAC)

نقش‌ها: `system_admin`, `editor`, `reporter`, `content_manager`  
Permissionهای دانه‌ریز روی resource:action (مثلاً `sources:write`, `articles:read`, `settings:write`).

## حفاظت API

- Rate limiting (عمومی + login سخت‌گیرانه‌تر)
- Validation و Sanitization ورودی
- Helmet
- CORS محدود به originهای مجاز
- CSRF در صورت cookie-based session (ترجیح Bearer برای SPA/PWA)
- Pagination اجباری برای لیست‌ها

## اسرار و کلید مدل

- API Keyهای Provider رمزنگاری در rest (AES-GCM با کلید از env `SECRETS_ENCRYPTION_KEY`)
- هرگز به Frontend ارسال نشوند
- فقط از Environment / Secret Manager
- امکان Vault در آینده

## داده حساس

- محدودیت نقش برای `/articles/:id/raw-content`
- Audit Log برای تصمیم‌های سردبیری و تغییر تنظیمات/کلیدها
- عدم لاگ کردن متن کامل مقاله و کلیدها به‌صورت پیش‌فرض

## تهدیدات مرتبط با دامنه

| تهدید | کنترل |
|-------|--------|
| SSRF از URL منبع | Allowlist scheme، block private IP در fetch |
| HTML injection در UI | sanitize نمایش |
| Prompt injection از مقاله | جداسازی system/user، schema validation، عدم اجرای دستور از محتوا |
| Replay job مخرب | RBAC + idempotency + audit |

## چک‌لیست فاز صفر

- [x] JWT + refresh  
- [x] RBAC guards  
- [x] Validation pipes  
- [x] Helmet + CORS  
- [ ] رمزنگاری کلید Provider (فاز ۳)  
- [ ] SSRF guard کامل (فاز ۱ crawler)  
