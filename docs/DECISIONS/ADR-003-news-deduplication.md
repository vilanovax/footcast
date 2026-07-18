# ADR-003 — تشخیص خبر تکراری چندلایه

## وضعیت

پذیرفته‌شده — به‌روز شده 2026-07-18 (Clustering v2 / PR-B evaluation)

## زمینه

بازنشر گسترده اخبار فوتبال. حذف کور باعث از دست رفتن به‌روزرسانی مهم می‌شود؛ عدم dedup باعث نویز سردبیر.
صندوق Event-based است؛ مسئله دقت تفکیک `EXACT_DUPLICATE` / `NEAR_DUPLICATE` / `SAME_EVENT` / `NEW_DEVELOPMENT` است.

## تصمیم

Pipeline ترتیبی (incremental روی `@footcast/event-clustering` + `cluster-event` worker):

1. **Exact** — content fingerprint / URL hash  
2. **Near-duplicate** — title + claim + fingerprint (جدا از same-event)  
3. **Event Signature** — `eventType` + `action` + primary/secondary entities (normalized names؛ ID اختیاری)  
4. **Candidate retrieval** — entity مشترک + category سازگار + پنجره زمانی per category  
5. **Structured similarity** با breakdown:

```text
eventSimilarity =
  entity×0.30 + eventType×0.15 + action×0.15
  + semantic×0.20 + title×0.10 + time×0.10
```

6. **Thresholds** — `CLUSTERING_POLICY` نسخهٔ `2.1.0` (false-merge aversion):
   - `>= 0.90` → auto attach + classify relationship  
   - `0.74–0.90` → AI boundary فقط اگر `CLUSTER_AI_JUDGE_ENABLED` و گیت‌های entity/category برقرار؛ وگرنه prefer create  
   - `< 0.74` → create new event  
   - AI failure یا confidence `< 0.80` → Create / Needs Review (نه Auto Merge)

7. **Timeline** — `EventTimelineItem` برای PRIMARY و NEW_DEVELOPMENT (نه exact/near dup)

8. **Roles ذخیره‌شده:** `PRIMARY | SUPPORTING | EXACT_DUPLICATE | NEAR_DUPLICATE | NEW_DEVELOPMENT | CONFLICTING | BACKGROUND`  
   Decision `SAME_EVENT` → معمولاً `SUPPORTING`. Exact/Near روی تعداد منبع مستقل اثر نمی‌گذارند.

9. **PR-B tooling:** `ClusterDecisionLog`, `ClusteringEvaluation`, Metrics، Entity Alias سبک، Merge (`MERGED` + `mergedIntoEventId`) / Split دستی، UI `/admin/clustering-evaluation`. جزئیات: [`CLUSTERING_EVALUATION.md`](../CLUSTERING_EVALUATION.md).

پنجره‌های زمانی: `CATEGORY_TIME_WINDOWS_HOURS` در `@footcast/shared` (`event-clustering-policy.ts`).

Embedding پشت `EmbeddingProvider` (`mock` یا `openai`)؛ mock در production با `EMBEDDING_ALLOW_MOCK=false` fail-fast. pgvector بعدی بدون بازنویسی domain.

## پیامدها

- دقت بالاتر با هزینه محاسباتی کنترل‌شده در candidate filter  
- تنظیم آستانه فقط با نسخهٔ Policy + ارزیابی انسانی  
- AI Judge واقعی پشت Feature Flag تا Metrics کافی جمع شود  

## جایگزین ردشده

فقط embedding یا فقط URL — هر دو به‌تنهایی نرخ false positive/negative بالا دارند.
بازنویسی معماری صندوق Article-based — رد شد؛ صندوق Event می‌ماند.
