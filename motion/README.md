# پست موشن اینستاگرام فوتبالیکا

هر اپیزود → یک ویدئوی ۳۰ تا ۴۰ ثانیه‌ای **۱۰۸۰×۱۳۵۰ (۴:۵، پست فید اینستاگرام)** + تصویر کاور.

محتوا فقط از یک فایل JSON می‌آید؛ برای پست هر روز کافی است یک JSON تازه بسازی و رندر بگیری.

```bash
cd motion
npm install                     # فقط بار اول (Playwright)
node render.cjs episodes/ep21.json
# → out/ep21.mp4  و  out/ep21-cover.jpg

# با موزیک پس‌زمینه (آخرش خودکار fade می‌شود):
node render.cjs episodes/ep21.json --audio music.mp3

# پیش‌نمایش سریع چند فریم به‌صورت PNG (ثانیه‌ها):
node render.cjs episodes/ep21.json --frames 2,7,12
```

پیش‌نمایش زنده: پوشه `motion` را با یک وب‌سرور ساده باز کن
(`python3 -m http.server` و بعد `http://localhost:8000/template.html?data=episodes/ep21.json`).
Space = توقف، ←/→ = جابه‌جایی.

## ساختار JSON

| فیلد | توضیح |
|------|-------|
| `brand`, `episode`, `date`, `handle` | هدر و فوتر ثابت |
| `scenes[]` | صحنه‌ها به ترتیب؛ هر کدام `type` و `duration` (ثانیه) دارد |

انواع صحنه:

| type | کاربرد | فیلدها |
|------|--------|--------|
| `intro` | لوگو + تاریخ + ۳ تیتر روز | `kicker`, `topics[]` |
| `stat` | «عدد امروز» با شمارنده بزرگ | `label`, `value`, `caption`, `sub` |
| `match` | اسکوربورد بازی اصلی + گلزن‌ها | `label`, `competition`, `home{name,team,score}`, `away{…}`, `scorers[]` |
| `results` | فهرست نتایج | `label`, `rows[{home,homeTeam,away,awayTeam,score:[h,a],note}]` |
| `table` | جدول با نمودار میله‌ای امتیاز | `label`, `rows[{name,team,pts}]` |
| `cards` | چند خبر کوتاه (مثلاً ایران) | `label`, `team`, `cards[{icon,tone,title,sub}]` |
| `fixtures` | بازی‌های پیش رو | `label`, `groups[{when, matches[{home,homeTeam,away,awayTeam}]}]` |
| `outro` | دعوت به فالو | `line1`, `line2`, `cta`, `signoff` |

- `team`: کلید پرچم/رنگ تیم (مثل `england`, `iran`, `esteghlal`؛ فهرست کامل در `FLAGS` داخل `template.html`). تیم ناشناخته یک نشان خنثی می‌گیرد.
- `icon`: `x`, `play`, `plus`, `trophy`, `alert`, `clock`, `bell` — `tone`: `bad`, `good`, `info`, `neutral`.
- هر صحنه می‌تواند `accent` (رنگ hex) اختصاصی داشته باشد.

**قاعده محتوا:** هر صحنه یک پیام؛ تیتر کوتاه (حداکثر ~۶ کلمه) و حداکثر یک خط توضیح. جزئیات ریز در پادکست می‌ماند.

فونت: Vazirmatn (SIL OFL) در `fonts/`.
