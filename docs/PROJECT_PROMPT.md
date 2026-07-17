# پرامپت اولیه پروژه — Football Newsroom

این فایل + `.cursor/rules/football-newsroom.mdc` تعریف رسمی پروژه از **نقطه صفر** هستند.

## دستور اجرا برای Cursor

1. ابتدا تمام مستندات `/docs` را بساز/به‌روز کن (قبل از قابلیت پیچیده).
2. دامنهٔ فعلی پیاده‌سازی: **فاز صفر (Foundation)** فقط.
3. فازهای crawler / AI extraction / editorial / podcast را فقط با پرامپت جداگانه شروع کن.
4. بدون API Key واقعی در سورس؛ Adapter + Mock برای سرویس خارجی.
5. TypeScript strict؛ Modular Monolith؛ NestJS + Sequelize + Postgres + Redis + BullMQ؛ Next.js PWA RTL.

## نقشهٔ اسناد (متن کامل الزامات)

| سند | معادل بخش‌های پرامپت |
|-----|----------------------|
| PRODUCT_OVERVIEW.md | ۱–۶ معرفی، کاربران، UI، صفحات |
| PRD.md | ۲، ۷، ۲۴، ۲۹، معیار پذیرش |
| ARCHITECTURE.md | ۸–۱۰، ۱۷، جریان داده، صف‌ها |
| DATA_MODEL.md | ۱۲، ۱۵، ۱۶، ERD |
| AI_PIPELINE.md | ۱۱، ۲۱، ۲۲، ۲۳ |
| EDITORIAL_RULES.md | ۶.۵، ۱۳، ۱۴ |
| API_SPEC.md | ۲۰ |
| SECURITY.md | ۱۸ |
| OBSERVABILITY.md | ۱۹ |
| DEPLOYMENT.md | زیرساخت و اجرا |
| ROADMAP.md | ۲۷، معیار هر فاز |
| FOUNDATION_BRIEF.md | خلاصه ۱–۱۲ مورد انتظار پس از مستندات |
| DECISIONS/ADR-001..003 | تصمیم معماری / AI / dedup |

## خروجی مرحله اول (انجام‌شده در Foundation)

- [x] مستندات و ADRها
- [x] Monorepo `apps/*` + `packages/*`
- [x] Docker Compose (Postgres `55432`, Redis `56379`)
- [x] NestJS API + Next.js web + worker/crawler stubs
- [x] Health / Auth JWT+RBAC / Swagger
- [x] Source + RawArticle + migration + seed
- [x] تست‌های پایه امتیازدهی و قوانین

جزئیات اجرا: `README.md` و `DEPLOYMENT.md`.
