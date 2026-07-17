# Football Newsroom / اتاق خبر فوتبال

سیستم سردبیری هوشمند فوتبال — جمع‌آوری، پالایش، امتیازدهی و تولید پادکست خبری.

> دامنهٔ فعلی: **مستندات کامل + فاز صفر (Foundation)**  
> پرامپت اولیه: [`docs/PROJECT_PROMPT.md`](docs/PROJECT_PROMPT.md) · قانون Cursor: `.cursor/rules/football-newsroom.mdc`

## شروع سریع

```bash
cp .env.example .env
pnpm install
pnpm docker:up
pnpm -r build
pnpm db:migrate
pnpm db:seed
pnpm dev:api
# ترمینال دیگر:
pnpm dev:web
```

- Web: http://localhost:3000  
- API: http://localhost:3001/api/v1  
- Swagger: http://localhost:3001/api/docs  
- Admin seed: `admin@football-newsroom.local` / `ChangeMeAdmin123!`

## ساختار

```text
apps/web api worker crawler
packages/shared database ai editorial-rules validation logger config ui
docs/
infra/docker/
```

## مستندات

ببینید [`docs/FOUNDATION_BRIEF.md`](docs/FOUNDATION_BRIEF.md) و فهرست کامل در [`docs/`](docs/).

## تست

```bash
pnpm --filter @footcast/shared test
pnpm --filter @footcast/editorial-rules test
pnpm --filter @footcast/api test
```
