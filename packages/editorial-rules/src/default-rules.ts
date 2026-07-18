export interface EditorialRuleDefinition {
  code: string;
  titleFa: string;
  descriptionFa: string;
  severity: 'hard' | 'soft';
  enabled: boolean;
}

export const DEFAULT_EDITORIAL_RULES: EditorialRuleDefinition[] = [
  {
    code: 'official_transfer_priority',
    titleFa: 'اولویت انتقال رسمی',
    descriptionFa: 'انتقال رسمی بالاترین اولویت را دارد.',
    severity: 'hard',
    enabled: true,
  },
  {
    code: 'no_confirmed_from_talks',
    titleFa: 'مذاکره برابر انتقال قطعی نیست',
    descriptionFa: 'مذاکره معتبر نباید به‌عنوان انتقال قطعی اعلام شود.',
    severity: 'hard',
    enabled: true,
  },
  {
    code: 'block_single_source_rumor',
    titleFa: 'شایعه تک‌منبعی',
    descriptionFa: 'شایعه تک‌منبعی نباید وارد پادکست اصلی شود.',
    severity: 'hard',
    enabled: true,
  },
  {
    code: 'club_official_over_repost',
    titleFa: 'اولویت خبر رسمی باشگاه',
    descriptionFa: 'خبر رسمی باشگاه نسبت به بازنشر رسانه‌ها اولویت دارد.',
    severity: 'soft',
    enabled: true,
  },
  {
    code: 'duplicate_only_on_update',
    titleFa: 'تکراری فقط با تحول',
    descriptionFa: 'خبر تکراری فقط در صورت به‌روزرسانی مهم دوباره نمایش داده شود.',
    severity: 'soft',
    enabled: true,
  },
  {
    code: 'drop_low_value_results',
    titleFa: 'حذف نتایج کم‌اهمیت',
    descriptionFa: 'نتایج بازی‌های کم‌اهمیت حذف شوند.',
    severity: 'soft',
    enabled: true,
  },
  {
    code: 'key_injury_boost',
    titleFa: 'وزن مصدومیت کلیدی',
    descriptionFa: 'مصدومیت بازیکن کلیدی امتیاز بالاتری دریافت کند.',
    severity: 'soft',
    enabled: true,
  },
  {
    code: 'esteghlal_persepolis_weight',
    titleFa: 'وزن استقلال و پرسپولیس',
    descriptionFa: 'خبرهای مرتبط با استقلال و پرسپولیس در ایران وزن بیشتری داشته باشند.',
    severity: 'soft',
    enabled: true,
  },
  {
    code: 'national_team_priority',
    titleFa: 'اهمیت تیم ملی',
    descriptionFa: 'خبرهای تیم ملی ایران اهمیت ملی دارند.',
    severity: 'soft',
    enabled: true,
  },
  {
    code: 'drop_clickbait',
    titleFa: 'حذف کلیک‌خور',
    descriptionFa: 'خبر تبلیغاتی یا کلیک‌خور حذف شود.',
    severity: 'hard',
    enabled: true,
  },
  {
    code: 'drop_stale_without_update',
    titleFa: 'حذف قدیمی بدون تحول',
    descriptionFa: 'خبر قدیمی بدون تحول جدید حذف شود.',
    severity: 'soft',
    enabled: true,
  },
  {
    code: 'conflict_to_human',
    titleFa: 'تناقض به سردبیر',
    descriptionFa: 'در صورت تناقض منابع، موضوع به سردبیر انسانی ارجاع داده شود.',
    severity: 'hard',
    enabled: true,
  },
];

export function listEnabledRules(): EditorialRuleDefinition[] {
  return DEFAULT_EDITORIAL_RULES.filter((rule) => rule.enabled);
}
