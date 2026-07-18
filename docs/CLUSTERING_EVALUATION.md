# Clustering Evaluation (PR-B)

## هدف

ارزیابی واقعی موتور Event Clustering v2 روی دادهٔ crawlشده، ثبت Ground Truth انسانی، اندازه‌گیری Metrics، تنظیم Policy نسخه‌دار، و ابزار Merge/Split دستی — بدون ورود به الگوریتم انتخاب پادکست.

## روش ساخت Ground Truth

1. خزش کنترل‌شده از منابع متنوع (ورزش داخلی، خبرگزاری، فدراسیون/لیگ، باشگاه، رسانه خارجی، نقل‌وانتقال تخصصی، aggregator کم‌اعتبار) با Rate Limit و robots موجود.
2. هدف اولیه: ≥۳۰۰ مقاله ذخیره و cluster شده.
3. صف ارزیابی: `GET /api/v1/clustering/queue` — مقالاتی که `ClusterDecisionLog` دارند ولی هنوز `ClusteringEvaluation` ندارند.
4. UI داخلی: `/admin/clustering-evaluation` (RTL، موبایل‌فرندلی).
5. برای هر مقاله، reviewer یکی از اقدام‌ها را ثبت می‌کند:
   - تصمیم درست / باید Event جدید / باید با Event دیگر ادغام / Exact|Near|Same|NewDev|Related|Uncertain
6. در Missed Merge، Event صحیح از جست‌وجو انتخاب می‌شود (`expectedEventId`).
7. Export: `GET /clustering/evaluations/export?format=json|csv` برای تبدیل به fixture تست.

### مدل

```text
ClusteringEvaluation
- predicted* از Decision Log / لینک فعلی
- expectedEventId, expectedRelationship, verdict, reviewerId, note
```

`expectedRelationship`: `EXACT_DUPLICATE | NEAR_DUPLICATE | SAME_EVENT | NEW_DEVELOPMENT | RELATED_BUT_DIFFERENT | UNRELATED`  
`verdict`: `CORRECT | WRONG_MERGE | MISSED_MERGE | WRONG_RELATIONSHIP | UNCERTAIN`

## تعریف Metrics

سرویس: `GET /clustering/metrics` (+ فیلتر relationship / aiUsed / score / date)

| Metric | تعریف عملی |
|--------|------------|
| `*Precision` | CORRECT / predicted=relationship |
| `*Recall` | CORRECT / expected=relationship |
| `falseMergeRate` | WRONG_MERGE / evaluated |
| `missedMergeRate` | MISSED_MERGE / evaluated |
| `wrongRelationshipRate` | WRONG_RELATIONSHIP / evaluated |
| `aiBoundaryRate` | logs با `aiUsed` |
| `autoMergeRate` / `newEventRate` | decision attach/create |
| `averageCandidateCount` / `averageClusteringLatency` | از Decision Log |

گزارش خطای کیفی: `GET /clustering/error-report` پس از ≥۱۰۰ ارزیابی.

## آستانه‌های هدف (MVP)

```text
Exact Duplicate Recall >= 95%
Near Duplicate Recall >= 90%
Same Event Recall >= 85%
New Development Recall >= 80%
False Merge Rate <= 3%
```

**سیاست False Merge:** False Merge ریسک بالاتری از Missed Merge دارد. در بازهٔ مرزی بدون AI مطمئن، ترجیح با Create / Needs Review است نه Auto Merge.

## Policy نسخه‌دار

`CLUSTERING_POLICY` در `@footcast/shared` (`event-clustering-policy.ts`):

- `version: '2.1.0'`
- `autoMergeThreshold: 0.90`
- `aiBoundaryMin/Max: 0.74–0.90`
- وزن‌ها و `timeWindows`

هر `ClusterDecisionLog.thresholdPolicyVersion` نسخهٔ زمان تصمیم را نگه می‌دارد. تغییر Policy تصمیم‌های تاریخی را بازنویسی نمی‌کند.

### نحوه تغییر Policy

1. ثبت دلیل در ADR-003 / این سند
2. bump `CLUSTERING_POLICY.version`
3. اجرای مجدد fixtureهای `@footcast/event-clustering`
4. مقایسه Metrics قبل/بعد روی همان export ارزیابی
5. فقط سپس اعمال در worker

## Decision Log

`ClusterDecisionLog` برای هر تصمیم: selectedEvent، decision، relationship، similarity + breakdown، candidate snapshot، policy version، AI flags، latency.

## Entity Alias Registry (سبک)

جداول `entities` / `entity_aliases` — بدون Entity Master کامل.  
API: `GET/POST /clustering/entities`, `POST /clustering/entities/:id/aliases`  
نمونه seed: پرسپولیس / سرخ‌پوشان / Persepolis FC → یک canonical.

## Merge / Split دستی

- `POST /events/merge` `{ primaryEventId, secondaryEventIds, reason }` → ثانویه `status=MERGED`, `mergedIntoEventId`
- `POST /events/:id/split` `{ articleIds, reason, newHeadline? }` — حداقل یک مقاله روی مبدأ
- UI در جزئیات Event صندوق + confirmation
- AuditLog + re-score صف

## AI Boundary Judge

- Interface: `ClusterAiJudge` (+ `HttpClusterAiJudge`)
- Production فقط با `CLUSTER_AI_JUDGE_ENABLED=true` و کلید API
- شرط فراخوانی: similarity مرزی + primary entity مشترک + category سازگار + نه exact/near قطعی
- Schema JSON اعتبارسنجی می‌شود
- Failure یا `confidence < 0.80` → ممنوعیت Auto Merge → Create / Needs Review

**تصمیم فعلی:** AI Judge در production **خاموش** می‌ماند تا Metrics واقعی ≥۱۰۰ ارزیابی جمع شود.

## Embedding

- `EmbeddingProvider` + `OpenAiEmbeddingProvider`
- `EMBEDDING_PROVIDER=mock|openai`, `EMBEDDING_ALLOW_MOCK`
- Mock در production با `allowMock=false` fail-fast
- pgvector در این PR الزامی نیست

## ارزیابی نسخه جدید موتور

1. Export ارزیابی‌های فعلی (baseline)
2. Deploy موتور/Policy جدید
3. Re-cluster نمونه یا مقایسه روی fixtureهای مشتق از export
4. Metrics جدید vs هدف MVP
5. اگر False Merge بالا رفت → rollback threshold / وزن entity

## Podcast Portfolio

خارج از scope این PR — پس از پایدار شدن Metrics و Merge/Split.
