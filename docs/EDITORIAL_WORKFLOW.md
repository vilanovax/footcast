# Editorial Workflow — Clustering & Inbox

## جریان اصلی

1. Crawl کنترل‌شده → Parse → Extract → **Cluster** → Score  
2. Inbox Event-based (`/inbox`) — نه لیست خام مقالات  
3. سردبیر: Approve / Reject / Note / Score override  
4. اصلاح دستی clustering: Merge / Split روی جزئیات Event  
5. ارزیابی کیفیت clustering: `/admin/clustering-evaluation`

## Merge دستی

- مقصد = Primary؛ Eventهای انتخاب‌شده = Secondary (`MERGED` + `mergedIntoEventId`)
- انتقال article links (بدون duplicate)، timeline، resolve conflicts
- Audit: `events.merge` + re-score صف
- Confirmation در UI اجباری است

## Split دستی

- انتخاب ≥۱ مقاله؛ حداقل یک مقاله روی Event مبدأ می‌ماند
- Event جدید با `NEEDS_REVIEW`؛ Audit `events.split` + re-score هر دو

## ارزیابی انسانی

صف Decision Logهای بدون Evaluation → ثبت verdict/relationship → Metrics  
هدف: False Merge ≤ ۳٪ قبل از شل کردن threshold.

## سبد روزانه و موج استخراج

طبق [ADR-004](./DECISIONS/ADR-004-daily-rundown.md) و [DAILY_RUNDOWN.md](./DAILY_RUNDOWN.md):

1. هر استخراج در یک **IntakeWave** ثبت می‌شود
2. تغییرات Event به‌صورت **WaveEventObservation** (چندبه‌چند)
3. صندوق موج فقط دلتا / تحول مهم
4. **DailyRundown** مستقل از `APPROVED` تا قفل ۱۶:۰۰
5. توازن پوشش بر زمان تخمینی + پیشنهاد REPLACE

## Podcast Portfolio

الگوریتم utility کامل و سهمیه‌های پیشرفته روی DailyRundown سوار می‌شود؛ هستهٔ مدل در ADR-004 پیاده شده است.

## اتوماسیون انتخاب

- اسکما + تنظیمات: فاز ۱  
- Engine: `@footcast/editorial-automation` → `evaluateAutomationPolicy`  
- Worker: بعد از `score-event` → `applyEditorialAutomationAfterScore`  
  - persist در `editorial_automation_decisions`  
  - hint در `NewsEvent.metadata.lastAutomation`  
  - AUTO_ADD فقط اگر flag روشن و گاردها OK → `DailyRundownItem` با `addedMode=AUTO`  
- UI: inbox badge/فیلتر؛ Today تفکیک خودکار + تأیید/رد (`reviewStatus`)  

پیش‌فرض ASSISTED (Auto Add خاموش). جزئیات: [AUTO_EDITORIAL_SELECTION.md](./AUTO_EDITORIAL_SELECTION.md).
