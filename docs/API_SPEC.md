# مشخصات API — Football Newsroom

Base path: `/api/v1`  
Auth: `Authorization: Bearer <access_token>`  
مستند تعاملی: Swagger UI در `/api/docs`

## قرارداد پاسخ

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "pageSize": 20, "total": 100 },
  "error": null,
  "requestId": "uuid"
}
```

خطا:

```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "human readable",
    "details": []
  },
  "requestId": "uuid"
}
```

## فاز صفر (پیاده‌سازی فعلی)

| Method | Path | توضیح |
|--------|------|--------|
| POST | `/auth/login` | دریافت access + refresh |
| POST | `/auth/refresh` | چرخش refresh |
| POST | `/auth/logout` | ابطال refresh |
| GET | `/auth/me` | کاربر فعلی + roles |
| GET | `/health` | health aggregate |
| GET | `/health/live` | liveness |
| GET | `/health/ready` | readiness |
| GET/POST | `/users` | مدیریت کاربر (admin) |
| GET | `/roles` | لیست نقش‌ها |
| CRUD | `/sources` | مدیریت منابع |
| GET | `/sources/:id/feeds` | فیدهای منبع |
| GET | `/sources/:id/health` | سلامت منبع |
| GET | `/sources/:id/runs` | تاریخچه CrawlRun |
| GET | `/sources/:id/runs/:runId` | جزئیات یک اجرا |
| POST | `/sources/:id/crawl` | تریگر دستی crawl |
| CRUD | `/articles` | RawArticle (لیست/جزئیات) |
| GET | `/articles/:id/content` | متن پارس‌شده |
| POST | `/articles/:id/reprocess` | fetch مجدد + parse |
| POST | `/articles/:id/parse` | parse از HTML ذخیره‌شده |
| POST | `/articles/:id/extract` | استخراج AI کارت خبر |
| GET | `/articles/:id/extraction` | آخرین کارت استخراج‌شده |
| GET | `/ai/prompts` | نسخه‌های Prompt |
| GET | `/ai/usage` | مصرف توکن/هزینه |
| GET | `/events` | لیست رویدادهای خبری |
| GET | `/events/:id` | جزئیات رویداد + مقالات/conflictها |
| GET | `/events/:id/articles` | مقالات لینک‌شده به رویداد |
| GET | `/events/conflicts` | conflictهای باز/حل‌شده |
| POST | `/events/:id/merge` | ادغام دستی رویداد مبدأ در هدف |
| POST | `/events/:id/split` | جدا کردن یک مقاله به رویداد جدید |
| POST | `/events/conflicts/:id/resolve` | resolve conflict |
| POST | `/articles/:id/cluster` | تریگر دستی cluster/dedup |
| GET | `/editorial/inbox` | صندوق ورودی با فیلتر |
| GET | `/editorial/selected` | رویدادهای تأییدشده |
| GET | `/editorial/rules` | قوانین سردبیری |
| GET | `/editorial/decisions` | تاریخچه تصمیم‌ها |
| GET | `/editorial/events/:id` | جزئیات برای review |
| POST | `/editorial/events/:id/score` | امتیازدهی (`?sync=1` همزمان) |
| POST | `/editorial/events/:id/score-override` | override دستی امتیاز نهایی |
| DELETE | `/editorial/events/:id/score-override` | لغو override فعال |
| POST | `/editorial/events/:id/approve` | تأیید |
| POST | `/editorial/events/:id/reject` | رد |
| POST | `/editorial/events/:id/decide` | approve/reject یکپارچه |
| POST | `/editorial/events/:id/notes` | یادداشت سردبیر |
| GET | `/editorial/coverage/today` | Coverage Intelligence امروز |
| GET | `/editorial/days/:editorialDate/coverage` | پوشش یک روز سردبیری |
| GET | `/editorial/rundowns/:rundownId/coverage` | پوشش یک DailyRundown |
| POST | `/sources/crawl-all` | خزش فوری همه منابع فعال |
| GET | `/waves` | موج‌های استخراج روز |
| POST | `/waves/open` | باز کردن / گرفتن موج RUNNING |
| POST | `/waves/backfill` | پر کردن موج از خبرهای باز صندوق |
| GET | `/waves/:id/inbox` | صندوق دلتای موج (`tab=unseen\|new\|…`) |
| POST | `/waves/observations/mark-seen` | علامت دیده‌شده |
| POST | `/waves/:id/complete` | اتمام موج |
| GET | `/rundown/today` | سبد امروز (+ coverage) |
| POST | `/rundown/today/items` | افزودن Event به سبد |
| PATCH | `/rundown/items/:id` | Pin / Lead / section / `reviewStatus` (ACCEPTED\|DISMISSED برای AUTO) |
| POST | `/rundown/items/:id/undo-auto` | Undo ورود خودکار (`addedMode=AUTO`) → REMOVED + `revertedAt` روی decision |
| DELETE | `/rundown/items/:id` | حذف نرم از سبد (REMOVED) |
| POST | `/rundown/today/lock` | قفل سردبیری ۱۶:۰۰ |
| POST | `/rundown/today/reopen` | بازگشایی با دلیل |
| GET | `/rundown/today/replace-suggestions` | پیشنهاد REPLACE |
| POST | `/rundown/today/replace` | اعمال جایگزینی |

### فیلترهای Inbox

`status`, `scope`, `category`, `officialStatus`, `q`, `from`, `to`,  
`sourceId` (contains: NewsEvent→Article→Source),  
`minFinalScore` / `minImportance` (legacy), `minCredibilityScore`,  
`recommendation`, `hasManualOverride=true`,  
`automation=important|suggested` (فیلتر اتوماسیون / recommendation)
| GET | `/podcasts` | لیست اپیزودها |
| POST | `/podcasts` | ساخت اپیزود (+ eventIds اختیاری) |
| GET | `/podcasts/:id` | جزئیات اپیزود / items / scripts |
| POST | `/podcasts/:id/items` | افزودن اخبار APPROVED/SELECTED |
| PUT | `/podcasts/:id/items/reorder` | ترتیب اخبار |
| DELETE | `/podcasts/:id/items/:eventId` | حذف خبر از اپیزود |
| POST | `/podcasts/:id/generate-script` | تولید اسکریپت |
| GET | `/podcasts/:id/script` | آخرین نسخه اسکریپت |
| POST | `/podcasts/:id/approve-script` | تأیید اسکریپت |
| POST | `/podcasts/:id/approve` | تأیید اپیزود برای TTS |
| GET | `/settings` | AppSetting |
| GET | `/settings/workspace` | تنظیمات محصول/تم/AI خلاصه |
| GET | `/settings/control` | مرکز کنترل (Providers، Pipeline، Audit، Automation، …) |
| PATCH | `/settings/control/automation` | Policy اتوماسیون انتخاب خبر (`control.editorial.automation`) |
| PATCH | `/settings/control/:section` | به‌روزرسانی یک بخش کنترل |
| POST | `/settings/control/providers/:id/key` | تنظیم/پاک کردن کلید Provider (رمزنگاری) |
| POST | `/settings/control/providers/:id/test` | تست اتصال Provider |
| PATCH | `/settings/:key` | به‌روزرسانی تنظیم |

| GET | `/dashboard` | آمار پایه فاز صفر |

## نقشه کامل نسخه اول (طراحی)

```
/auth
/users
/roles
/permissions
/sources
/sources/:id/feeds
/sources/:id/runs
/sources/:id/health
/articles
/articles/:id
/articles/:id/reprocess
/articles/:id/raw-content
/events
/events/:id
/events/:id/articles
/events/:id/approve
/events/:id/reject
/events/:id/merge
/events/:id/split
/events/:id/score
/editorial/inbox
/editorial/selected
/editorial/rules
/editorial/decisions
/podcasts
/podcasts/:id
/podcasts/:id/items
/podcasts/:id/generate-script
/podcasts/:id/fact-check
/podcasts/:id/generate-audio
/podcasts/:id/audio
/podcasts/:id/audio/file   (public stream)
/podcasts/:id/publish
/podcasts/rss.xml          (public RSS)
/ai/providers
/ai/models
/ai/pipelines
/ai/usage
/ai/costs
/jobs
/jobs/:id
/jobs/:id/retry
/dashboard
/reports
/reports/models
/reports/sources
/reports/editorial
/reports/episodes
/notifications
/notifications/unread-count
/notifications/read-all
/notifications/:id/read
/ai/usage?days=
/settings
/health
```

همه endpointها باید DTO، class-validator، و دکوراتور Swagger داشته باشند.

## فیلترهای صندوق ورودی (طراحی)

`status, officialStatus, scope, league, club, category, sourceId, from, to, minImportance, q`

## Pagination

Query: `page`, `pageSize` (max 100), `sortBy`, `sortOrder`.
