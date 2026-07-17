# خلاصه اجرایی فاز صفر

## ۱. خلاصه محصول

Football Newsroom (اتاق خبر فوتبال) یک PWA سردبیری هوشمند است که اخبار فوتبال ایران و اروپا را از منابع تعریف‌شده جمع می‌کند، پالایش و امتیازدهی می‌کند، تحت کنترل سردبیر انسانی قرار می‌دهد و متن پادکست ۸–۱۲ دقیقه‌ای (+ TTS) تولید می‌کند.

## ۲. فرضیات

- یک سازمان داخلی (نه multi-tenant SaaS در v1)
- اپراتور فارسی‌زبان؛ محتوای FA/EN
- حداقل ۲۰ منبع در افق v1
- نتایج مسابقه از منبع ساختاریافته رسمی
- TTS و LLM از Adapter + Mock

## ۳. ابهام‌ها

برندینگ نهایی، Provider پیش‌فرض TTS، SSO سازمانی، hosting ابری هدف — موقت در PRODUCT_OVERVIEW.

## ۴. ریسک‌ها

Block منابع، توهم مدل، هزینه مدل گران، vendor lock-in، نویز بازنشر — کنترل‌ها در PRODUCT_OVERVIEW و ADRها.

## ۵. تصمیم‌های معماری

Modular Monolith؛ NestJS + Sequelize + Postgres + Redis + BullMQ؛ Next.js PWA؛ AI abstraction؛ dedup چندلایه. نکاه: ADR-001..003.

## ۶. ERD

`DATA_MODEL.md` (Mermaid)

## ۷. جریان داده

`ARCHITECTURE.md` (Mermaid pipeline)

## ۸. ساختار پوشه‌ها

`apps/{web,api,worker,crawler}` + `packages/{shared,database,ai,editorial-rules,validation,logger,config,ui}`

## ۹. APIهای اصلی فاز صفر

`/auth/*`, `/health*`, `/users`, `/roles`, `/sources`, `/articles`, `/settings`, `/dashboard`

## ۱۰. مدل Queueها

جدول صف‌ها در `ARCHITECTURE.md` — فعال‌سازی کامل از فاز ۱

## ۱۱. Roadmap

`ROADMAP.md` — فاز صفر تا هشت با معیار پذیرش

## ۱۲. معیار پذیرش فاز صفر

چک‌لیست `PRD.md` بخش ۱۱
