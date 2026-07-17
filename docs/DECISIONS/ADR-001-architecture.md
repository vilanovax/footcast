# ADR-001 — معماری Modular Monolith با NestJS + Sequelize

## وضعیت

پذیرفته‌شده — ۱۴۰۵/۰۴/۲۶ (2026-07-17)

## زمینه

نیاز به سیستم سردبیری فوتبال با چند process (web/api/worker/crawler) بدون پیچیدگی عملیاتی microservice کامل در نسخه اول.

## تصمیم

1. **Modular Monolith** با پکیج‌ها و اپ‌های جدا در monorepo pnpm.
2. **NestJS + TypeScript + REST + Swagger** برای API.
3. **PostgreSQL + Sequelize** به‌عنوان ORM (ترجیح پروژه نسبت به Prisma).
4. **Redis + BullMQ** برای صف و زمان‌بندی.
5. **Next.js App Router PWA** برای کلاینت Mobile-First RTL.
6. Processهای `worker` و `crawler` جدا برای مقیاس افقی آینده، با اشتراک کد دامنه از packages.

## پیامدها

### مثبت

- سرعت توسعه بالاتر از microservice
- مرز ماژول برای استخراج بعدی
- یک زبان (TS) در کل stack
- تست و توسعه محلی ساده با Docker Compose

### منفی / ریسک

- Sequelize نسبت به Prisma DX تایپ ضعیف‌تری دارد → مدل‌ها و DTOهای shared جبران می‌کنند
- خطر coupling اگر مرز ماژول رعایت نشود → lint/dependency rules بعدی

## جایگزین‌های ردشده

| گزینه | دلیل رد برای v1 |
|-------|------------------|
| Microservice کامل | پیچیدگی ops غیرضروری |
| Prisma | خلاف ترجیح صریح پروژه |
| Python monolith قبلی | بازنویسی از صفر طبق الزام محصول جدید |
