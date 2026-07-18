# Daily Rundown — موج استخراج و سبد امروز

منبع حقیقت معماری: [ADR-004](./DECISIONS/ADR-004-daily-rundown.md)

## جریان

```text
خزش → IntakeWave → WaveEventObservation (دلتا)
  → صندوق موج → DailyRundown (سبد امروز)
  → توازن پوشش (زمان) → قفل ۱۶:۰۰ Asia/Tehran → ساخت متن پادکست
```

## چهار لایه

| لایه | جدول | نقش |
|------|------|-----|
| موج | `intake_waves` | ردیابی عملیات استخراج |
| مشاهده | `wave_event_observations` | NEW / DEVELOPMENT / CONFIRMATION / CONFLICT |
| سبد روز | `daily_rundowns` | COLLECTING → … → LOCKED |
| آیتم | `daily_rundown_items` | SHORTLISTED / REMOVED / FINAL_SELECTED |

## تفکیک مفاهیم

- `NewsEvent.APPROVED` = خبر معتبر است
- `DailyRundownItem.SHORTLISTED` = برای پادکست **امروز** نگه داشته شده
- `DailyRundownItem.addedMode=AUTO` = ورود خودکار با Policy (ADR-007)؛ هنوز `FINAL_SELECTED` نیست
- اپیزود پادکست از سبد قفل‌شده ساخته می‌شود (نه از کل APPROVED)

اتوماسیون انتخاب: [AUTO_EDITORIAL_SELECTION.md](./AUTO_EDITORIAL_SELECTION.md)

## API

- `GET/POST /waves/*` — موج‌ها و صندوق دلتا
- `GET/POST /rundown/*` — سبد امروز، پوشش، قفل، جایگزینی

## زمان

- منطقه: `Asia/Tehran`
- دeadline پیش‌فرض: ۱۶:۰۰ همان `editorialDate`
