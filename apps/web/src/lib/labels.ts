/** Persian labels for API enums — keep UI free of raw English status codes. */

const EVENT_STATUS: Record<string, string> = {
  NEW: 'جدید',
  NEEDS_REVIEW: 'نیاز به بررسی',
  VERIFIED: 'تأیید اولیه',
  CONFLICTED: 'تناقض',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  SELECTED: 'انتخاب‌شده',
  PUBLISHED: 'منتشرشده',
  ARCHIVED: 'بایگانی',
};

const EPISODE_STATUS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  NEWS_SELECTED: 'خبر انتخاب شد',
  SCRIPT_GENERATING: 'در حال نوشتن متن',
  SCRIPT_READY: 'متن آمادهٔ بازبینی',
  SCRIPT_REVIEWED: 'متن تأیید شد',
  AUDIO_GENERATING: 'در حال ساخت صدا',
  AUDIO_READY: 'صدا آماده',
  APPROVED: 'اپیزود تأیید شد',
  PUBLISHED: 'منتشر شده',
  ARCHIVED: 'بایگانی',
  FAILED: 'ناموفق',
};

const CATEGORY: Record<string, string> = {
  TRANSFER: 'انتقال',
  CONTRACT: 'قرارداد',
  COACH_CHANGE: 'تغییر مربی',
  INJURY: 'مصدومیت',
  SUSPENSION: 'محرومیت',
  MATCH_RESULT: 'نتیجه بازی',
  MATCH_PREVIEW: 'پیش‌بازی',
  LEGAL: 'حقوقی',
  DISCIPLINARY: 'انضباطی',
  MANAGEMENT: 'مدیریتی',
  OWNERSHIP: 'مالکیت',
  NATIONAL_TEAM: 'تیم ملی',
  TACTICAL: 'تاکتیکی',
  FINANCIAL: 'مالی',
  OFF_FIELD: 'خارج از زمین',
  OTHER: 'سایر',
};

const SCOPE: Record<string, string> = {
  IRAN: 'ایران',
  EUROPE: 'اروپا',
  BOTH: 'ایران و اروپا',
  OTHER: 'سایر',
  iran: 'ایران',
  europe: 'اروپا',
  both: 'ایران و اروپا',
  other: 'سایر',
};

const OFFICIAL: Record<string, string> = {
  OFFICIAL: 'رسمی',
  CONFIRMED: 'تأییدشده',
  RELIABLE_REPORT: 'گزارش معتبر',
  MULTI_SOURCE_REPORT: 'چندمنبعی',
  UNVERIFIED: 'تأییدنشده',
  RUMOR: 'شایعه',
  DISPUTED: 'مورد اختلاف',
  FALSE: 'نادرست',
};

const QUEUE_NAME: Record<string, string> = {
  'crawl-source': 'خزش منبع',
  'fetch-article': 'دریافت مقاله',
  'parse-article': 'پارس مقاله',
  'extract-article': 'استخراج AI',
  'cluster-event': 'خوشه‌بندی',
  'score-event': 'امتیازدهی',
  'generate-podcast': 'تولید اسکریپت',
  'fact-check-script': 'راستی‌آزمایی',
  'generate-audio': 'تولید صدا',
  'publish-episode': 'انتشار',
};

const HEALTH: Record<string, string> = {
  healthy: 'سالم',
  degraded: 'ضعیف',
  down: 'قطع',
  unknown: 'نامشخص',
};

export function labelEventStatus(status?: string | null): string {
  if (!status) return '—';
  return EVENT_STATUS[status] ?? status;
}

export function labelEpisodeStatus(status?: string | null): string {
  if (!status) return '—';
  return EPISODE_STATUS[status] ?? status;
}

export function labelCategory(value?: string | null): string {
  if (!value) return '—';
  return CATEGORY[value] ?? value;
}

export function labelScope(value?: string | null): string {
  if (!value) return '—';
  return SCOPE[value] ?? value;
}

export function labelOfficial(value?: string | null): string {
  if (!value) return '—';
  return OFFICIAL[value] ?? value;
}

const RECOMMENDATION: Record<string, string> = {
  LEAD_STORY: 'تیتر اول',
  INCLUDE_IN_MAIN_PODCAST: 'پادکست اصلی',
  INCLUDE_AS_BRIEF: 'خبر کوتاه',
  NEEDS_EDITOR_REVIEW: 'نیاز به بررسی',
  REJECT_OR_ARCHIVE: 'رد / بایگانی',
};

export function labelRecommendation(value?: string | null): string {
  if (!value) return '—';
  return RECOMMENDATION[value] ?? value;
}

export function credibilityTierLabel(seed?: number | null): string {
  if (seed == null) return '—';
  if (seed >= 85) return 'بسیار معتبر';
  if (seed >= 70) return 'معتبر';
  if (seed >= 50) return 'متوسط';
  if (seed >= 30) return 'ضعیف';
  return 'نامعتبر';
}

const ARTICLE_ROLE: Record<string, string> = {
  PRIMARY: 'اصلی',
  SUPPORTING: 'پشتیبان',
  EXACT_DUPLICATE: 'تکراری دقیق',
  NEAR_DUPLICATE: 'بازنشر',
  NEW_DEVELOPMENT: 'تحول جدید',
  CONFLICTING: 'تناقض',
  BACKGROUND: 'زمینه',
  primary: 'اصلی',
  duplicate: 'بازنشر',
  related: 'مرتبط',
};

export function labelArticleRole(value?: string | null): string {
  if (!value) return '—';
  return ARTICLE_ROLE[value] ?? ARTICLE_ROLE[value.toUpperCase()] ?? value;
}

export function labelQueue(name?: string | null): string {
  if (!name) return '—';
  return QUEUE_NAME[name] ?? name;
}

export function labelHealth(value?: string | null): string {
  if (!value) return '—';
  return HEALTH[value] ?? value;
}

/** Tone for status pills */
export function eventStatusTone(
  status?: string | null,
): 'neutral' | 'warn' | 'ok' | 'danger' | 'accent' {
  switch (status) {
    case 'CONFLICTED':
    case 'REJECTED':
      return 'danger';
    case 'NEEDS_REVIEW':
    case 'NEW':
      return 'warn';
    case 'APPROVED':
    case 'SELECTED':
    case 'VERIFIED':
    case 'PUBLISHED':
      return 'ok';
    default:
      return 'neutral';
  }
}

export function episodeStatusTone(
  status?: string | null,
): 'neutral' | 'warn' | 'ok' | 'danger' | 'accent' {
  switch (status) {
    case 'FAILED':
      return 'danger';
    case 'SCRIPT_GENERATING':
    case 'AUDIO_GENERATING':
    case 'SCRIPT_READY':
      return 'warn';
    case 'PUBLISHED':
    case 'AUDIO_READY':
    case 'APPROVED':
      return 'ok';
    case 'SCRIPT_REVIEWED':
      return 'accent';
    default:
      return 'neutral';
  }
}

export type PodcastStepId = 'script' | 'review' | 'approve' | 'audio' | 'publish';

export const PODCAST_STEPS: Array<{ id: PodcastStepId; label: string }> = [
  { id: 'script', label: 'نوشتن متن' },
  { id: 'review', label: 'تأیید متن' },
  { id: 'approve', label: 'تأیید اپیزود' },
  { id: 'audio', label: 'ساخت صدا' },
  { id: 'publish', label: 'انتشار' },
];

/** Map episode status → current step index (0–4) and next primary action. */
export function podcastProgress(status?: string | null): {
  stepIndex: number;
  done: boolean;
  nextAction: PodcastStepId | null;
  nextLabel: string | null;
  hint: string;
} {
  switch (status) {
    case 'PUBLISHED':
      return {
        stepIndex: 4,
        done: true,
        nextAction: null,
        nextLabel: null,
        hint: 'این اپیزود منتشر شده است.',
      };
    case 'AUDIO_READY':
      return {
        stepIndex: 4,
        done: false,
        nextAction: 'publish',
        nextLabel: 'انتشار اپیزود',
        hint: 'صدا آماده است — با انتشار در RSS قرار می‌گیرد.',
      };
    case 'APPROVED':
      return {
        stepIndex: 3,
        done: false,
        nextAction: 'audio',
        nextLabel: 'ساخت فایل صوتی',
        hint: 'اپیزود تأیید شد — حالا صدا را بسازید.',
      };
    case 'SCRIPT_REVIEWED':
      return {
        stepIndex: 2,
        done: false,
        nextAction: 'approve',
        nextLabel: 'تأیید نهایی اپیزود',
        hint: 'متن تأیید شد — اپیزود را برای ساخت صدا قفل کنید.',
      };
    case 'SCRIPT_READY':
      return {
        stepIndex: 1,
        done: false,
        nextAction: 'review',
        nextLabel: 'تأیید متن',
        hint: 'متن را بخوانید؛ اگر درست بود تأیید کنید.',
      };
    case 'SCRIPT_GENERATING':
      return {
        stepIndex: 0,
        done: false,
        nextAction: null,
        nextLabel: null,
        hint: 'در حال نوشتن متن… کمی صبر کنید.',
      };
    case 'AUDIO_GENERATING':
      return {
        stepIndex: 3,
        done: false,
        nextAction: null,
        nextLabel: null,
        hint: 'در حال ساخت صدا…',
      };
    case 'FAILED':
      return {
        stepIndex: 0,
        done: false,
        nextAction: 'script',
        nextLabel: 'تلاش دوباره: تولید متن',
        hint: 'خطایی رخ داد — از اول متن را دوباره بسازید.',
      };
    case 'DRAFT':
    case 'NEWS_SELECTED':
    default:
      return {
        stepIndex: 0,
        done: false,
        nextAction: 'script',
        nextLabel: 'تولید متن خبری',
        hint: 'اول متن اپیزود را از اخبار انتخاب‌شده بسازید.',
      };
  }
}
