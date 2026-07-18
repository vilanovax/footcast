# Auto Editorial Selection — اتوماسیون انتخاب خبر

منبع حقیقت: [ADR-007](./DECISIONS/ADR-007-auto-editorial-selection.md)

## هدف

سیستم را از «لیست خبر» به **دستیار سردبیر** تبدیل کند: علامت‌گذاری مهم، پیشنهاد انتقال به Today، و در صورت فعال‌بودن، ورود کنترل‌شده به سبد امروز — بدون سلب کنترل نهایی از سردبیر.

## جریان امن

```text
استخراج → Cluster → Score
  → Policy Engine
      → HIGHLIGHT (badge روی recommendation)
      → SUGGEST_ADD / SUGGEST_REPLACE (صف پیشنهاد)
      → AUTO_ADD → DailyRundownItem (SHORTLISTED, addedMode=AUTO)
  → مرور سردبیر تا قفل ۱۶:۰۰
  → FINAL_SELECTED / LOCKED
```

## سه سطح

| سطح | Flag | پیش‌فرض ASSISTED | اثر |
|-----|------|------------------|-----|
| ۱ Highlight | `autoHighlightImportant` | ON | فقط UI / اعلان |
| ۲ Suggest | `autoSuggestForRundown` | ON | پیشنهاد؛ بدون تغییر Rundown |
| ۳ Auto Add | `autoAddToRundown` | OFF | `SHORTLISTED` + `addedMode=AUTO` |

پروفایل‌ها: `MANUAL` | `ASSISTED` | `CONTROLLED_AUTO` (Full Auto فعلاً نیست).

## نگاشت Highlight ↔ recommendation

| recommendation موجود | Badge UI (نمونه) |
|----------------------|------------------|
| `LEAD_STORY` | تیتر / مهم |
| `INCLUDE_IN_MAIN_PODCAST` | پیشنهاد پادکست |
| `INCLUDE_AS_BRIEF` | کوتاه |
| `NEEDS_EDITOR_REVIEW` | نیاز به بررسی |
| `REJECT_OR_ARCHIVE` | اولویت پایین |

آستانه‌های Highlight قابل تنظیم‌اند ولی خروجی به همان فیلد `NewsEvent.recommendation` (یا نمایش مشتق) وصل می‌شود — وضعیت Event عوض نمی‌شود.

## گاردهای اجباری Auto Add

- نه EXACT/NEAR duplicate
- نه REJECTED / ARCHIVED / MERGED
- نه conflict جدی (`blockOnConflict`)
- نه شایعه تک‌منبعی (`allowRumorAutoAdd=false`)
- `officialStatus` ∈ `allowedOfficialStatuses` (پیش‌فرض CONTROLLED: OFFICIAL, CONFIRMED)
- سقف تیم / لیگ / دسته / مدت اپیزود
- Rundown قفل نباشد
- `stopAutoAddBeforeDeadlineMinutes` تا قفل
- همان `newsEventId` قبلاً در Rundown نباشد
- حداکثر `maxAutoAddedItems` در روز

## مدل داده

### `control.editorial.automation` (AppSetting JSON)

تایپ: `EditorialAutomationConfig` در `@footcast/shared`.

### `editorial_automation_decisions`

لاگ تصمیم Policy: `HIGHLIGHT` | `SUGGEST_ADD` | `SUGGEST_REPLACE` | `AUTO_ADD` | `HOLD`  
+ `scoreSnapshot` / `coverageSnapshot` / `reasons` / `blockedReasons`  
+ `executedAt` / `revertedAt` برای Undo.

### `daily_rundown_items` (ستون‌های جدید)

| ستون | نقش |
|------|-----|
| `added_mode` | `MANUAL` \| `AUTO` \| `SUGGESTED_ACCEPTED` |
| `automation_decision_id` | FK به تصمیم |
| `review_status` | `PENDING_REVIEW` \| `ACCEPTED` \| `DISMISSED` |
| `reviewed_by` / `reviewed_at` | مرور سردبیر |
| `automation_reason` | خلاصهٔ قابل‌نمایش |
| `score_snapshot` | امتیاز لحظهٔ ورود |

## فازبندی

1. ~~Docs + ADR + migration + seed + تایپ settings~~  
2. ~~engine خالص + تست واحد~~ — `@footcast/editorial-automation`  
3. ~~hook بعد از score-event~~ — worker  
4. ~~UI Inbox / Today~~ — badge، فیلتر اتوماسیون، تأیید/رد ورود خودکار  
5. ~~Undo API + Rule Audit gate~~ — `POST /rundown/items/:id/undo-auto`؛ `ruleAuditAutoAdd` قبل از execute  
6. ~~AI Audit adapter~~ — `runAutoAddAiAudit` در `@footcast/ai` + `applyAiAuditGate`؛ فقط PASS با `aiAuditMinConfidence` اجرا می‌شود (fail-closed)

## غیرهدف v1

- `autoRemoveLowPriority` / `autoReplaceLowerUtilityItem` به‌صورت اجرا (فقط پیشنهاد)
- `autoFinalizeOfficialBreakingNews`
- تغییر مستقیم `EventStatus` برای Highlight
