# Roadmap اجرایی — Football Newsroom

## فاز صفر: Foundation ← **انجام‌شده**

- Monorepo, env, Docker Compose, Postgres, Redis
- NestJS, Next.js, shared types, logger, config
- Health, Auth, RBAC, Swagger
- Source + RawArticle, migration, seed, base tests

**معیار پذیرش:** چک‌لیست بخش ۱۱ در `PRD.md`

## فاز یک: Source Management ← **انجام‌شده**

CRUD منابع، RSS/Sitemap، schedule، CrawlRun، health، logs، discovery، صف‌های `crawl-source` / `fetch-article`

**پذیرش:** منابع فعال با schedule، discover URL جدید، ثبت CrawlRun/Error، به‌روزرسانی SourceHealth

## فاز دو: Article Pipeline ← **انجام‌شده**

Fetch، parse HTML، normalize، raw storage، state machine، retry، failure، صف `parse-article`

**پذیرش:** مقاله از DISCOVERED تا PARSED پایدار؛ شکست قابل retry

## فاز سه: AI Extraction ← **انجام‌شده**

Provider abstraction، prompt management، extraction، schema validation، token/cost، mock

**پذیرش:** کارت JSON معتبر؛ هزینه ثبت؛ mock تست سبز

## فاز چهار: Dedup + Event Clustering ← **انجام‌شده**

Exact/semantic dup، embedding mock (JSONB + cosine در اپ)، event create/merge/split، conflict  
*(ستون/اکستنشن pgvector وقتی ایمیج registry در دسترس باشد قابل ارتقا است)*

**پذیرش:** تکراری واضح ادغام؛ conflict به review

## فاز پنج: Editorial Inbox ← **انجام‌شده**

لیست، فیلتر، جزئیات، approve/reject، scoring، notes، mobile UI

**پذیرش:** سردبیر جریان کامل review را روی موبایل انجام دهد

## فاز شش: Podcast Builder ← **دامنه بعدی**

Episode CRUD، select/sort، generate script، versioning، fact-check، approval

**پذیرش:** اسکریپت ۸–۱۲ دقیقه با منبع برای ادعاها

## فاز هفت: Audio + Publication

TTS adapter، audio job، storage، player، publication، RSS metadata export

**پذیرش:** AUDIO_READY و PUBLISHED با فایل قابل پخش

## فاز هشت: Reporting + Optimization

Cost/token dashboards، source/model performance، acceptance rate، latency

**پذیرش:** KPIهای اصلی در داشبورد قابل مشاهده

## پیشنهاد اجرای پرامپت

1. این پرامپت → مستندات + فاز صفر  
2. پرامپت جدا → فاز ۱–۲ (crawler/pipeline)  
3. پرامپت جدا → فاز ۳–۴ (AI + dedup)  
4. پرامپت جدا → فاز ۵–۷ (editorial + podcast + audio)  
5. پرامپت جدا → فاز ۸  
