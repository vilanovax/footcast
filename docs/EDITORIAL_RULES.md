# قوانین سردبیری — Football Newsroom

قوانین از پنل مدیریت قابل تنظیم‌اند (`EditorialRule`). نسخهٔ پیش‌فرض زیر به‌عنوان seed منطقی استفاده می‌شود.

## قوانین سیاستی (نمونه‌های الزامی)

1. انتقال رسمی بالاترین اولویت را دارد.
2. مذاکره معتبر نباید به‌عنوان انتقال قطعی اعلام شود.
3. شایعه تک‌منبعی وارد پادکست اصلی نشود.
4. خبر رسمی باشگاه بر بازنشر رسانه‌ها اولویت دارد.
5. خبر تکراری فقط با به‌روزرسانی مهم دوباره نمایش داده شود.
6. نتایج بازی‌های کم‌اهمیت حذف شوند.
7. مصدومیت بازیکن کلیدی امتیاز بالاتری بگیرد.
8. استقلال و پرسپولیس در پوشش ایران وزن بیشتر دارند.
9. خبر تیم ملی ایران اهمیت ملی دارد.
10. خبر تبلیغاتی/کلیک‌خور حذف شود.
11. خبر قدیمی بدون تحول جدید حذف شود.
12. تناقض منابع → ارجاع به سردبیر انسانی.

## مدل امتیازدهی Hybrid MVP (۰–۱۰۰)

سیاست متمرکز در `packages/shared/src/scoring-policy.ts` (`MVP_SCORING_POLICY` v1.0.0).

### سه امتیاز پایه

| امتیاز | نقش |
|--------|-----|
| `credibilityScore` | اعتماد به ادعا (seed منابع + وضعیت رسمی + منابع مستقل + شواهد) |
| `importanceScore` | اثر ورزشی / مخاطب / تازگی / novelty |
| `podcastValueScore` | تناسب برای اپیزود (جذابیت، روایت، explainability) |

### فرمول نهایی

`rawFinal = 0.45·importance + 0.35·credibility + 0.20·podcastValue`  
`finalScore = clamp(rawFinal + bonuses − penalties)`  
`effectiveFinalScore` = final خودکار یا override دستی سردبیر  
فیلد legacy `NewsEvent.importanceScore` برای سازگاری = `effectiveFinalScore` گردشده.

### اعتبار منبع (`Source.credibilitySeed`)

در فرمول استفاده می‌شود: `highestTrusted×0.60 + avgOthers×0.40`؛ منبع رسمی باشگاه/فدراسیون کف ۹۰.

### پیشنهاد پادکست (`recommendation`)

| کد | معنی |
|----|------|
| `LEAD_STORY` | تیتر اول |
| `INCLUDE_IN_MAIN_PODCAST` | پادکست اصلی |
| `INCLUDE_AS_BRIEF` | خبر کوتاه |
| `NEEDS_EDITOR_REVIEW` | نیاز به بررسی |
| `REJECT_OR_ARCHIVE` | رد / بایگانی |

آستانه‌ها در `MVP_SCORING_POLICY.thresholds`. اعتبار زیر ۴۰ → همیشه `NEEDS_EDITOR_REVIEW`.

### جریمه‌ها / بونوس‌ها (نمونه)

| کد | اثر تقریبی |
|----|------------|
| `SINGLE_SOURCE_RUMOR` | −۲۰ |
| `CLICKBAIT` / `ADVERTISEMENT` | −۱۵ / −۳۰ |
| `OLD_WITHOUT_NEW_DEVELOPMENT` | −۲۰ |
| `MAJOR_SOURCE_CONFLICT` | −۱۵ |
| باشگاه بزرگ ایران / تیم ملی | بونوس |

### ترکیب Rule + AI + Override

- AI فقط hint می‌دهد (`importanceScore` / `credibilityScore` کارت استخراج)
- ریاضیات و سیاست در backend (`@footcast/editorial-rules`)
- Override دستی: `POST/DELETE /editorial/events/:id/score-override` + AuditLog

## تشخیص تکراری (چندلایه)

1. URL Canonical  
2. Content Hash  
3. Title Similarity  
4. Entity Matching  
5. Time Proximity  
6. Embedding Similarity  
7. AI Confirmation برای موارد مشکوک  

مشابه → اتصال به Event نه حذف کور. جزئیات: `ADR-003-news-deduplication.md`.

## وضعیت اعتبار

`OFFICIAL | CONFIRMED | RELIABLE_REPORT | MULTI_SOURCE_REPORT | UNVERIFIED | RUMOR | DISPUTED | FALSE`

## اولویت روایت پادکست (پیشنهاد مدل)

1. خبر فوری/رسمی با اثر بالا  
2. ایران (استقلال/پرسپولیس/تیم ملی اولویت)  
3. اروپا اثرگذار  
4. نقل‌وانتقال قطعی  
5. نتایج مهم  
6. کوتاه‌ها  

سردبیر می‌تواند با drag & drop ترتیب را عوض کند.
