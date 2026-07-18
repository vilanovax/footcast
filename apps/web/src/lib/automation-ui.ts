/** UI helpers for Auto Editorial Selection (ADR-007). */

export type LastAutomationMeta = {
  at?: string;
  highlightBadge?: string | null;
  suggestKind?: 'ADD' | 'REPLACE' | string | null;
  autoAddAllowed?: boolean;
  autoAddBlocked?: string[];
  profileMode?: string;
};

export type AutomationBadge = {
  key: string;
  label: string;
  tone: 'neutral' | 'warn' | 'ok' | 'danger' | 'accent';
};

const HIGHLIGHT_FA: Record<string, string> = {
  LEAD: 'تیتر مهم',
  IMPORTANT: 'مهم',
  RUNDOWN_CANDIDATE: 'نامزد Today',
  NEEDS_REVIEW: 'نیاز به بررسی',
  LOW_PRIORITY: 'اولویت پایین',
};

export function labelHighlightBadge(badge?: string | null): string {
  if (!badge) return '—';
  return HIGHLIGHT_FA[badge] ?? badge;
}

export function readLastAutomation(
  metadata?: Record<string, unknown> | null,
): LastAutomationMeta | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata.lastAutomation;
  if (!raw || typeof raw !== 'object') return null;
  return raw as LastAutomationMeta;
}

/** Badges for inbox card — recommendation + automation hint. */
export function inboxAutomationBadges(input: {
  recommendation?: string | null;
  metadata?: Record<string, unknown> | null;
  inToday?: boolean;
}): AutomationBadge[] {
  const badges: AutomationBadge[] = [];
  const auto = readLastAutomation(input.metadata);
  const rec = input.recommendation;
  const highlight = auto?.highlightBadge;

  if (highlight === 'LEAD' || rec === 'LEAD_STORY') {
    badges.push({ key: 'lead', label: 'تیتر مهم', tone: 'ok' });
  } else if (highlight === 'IMPORTANT' || rec === 'INCLUDE_IN_MAIN_PODCAST') {
    badges.push({ key: 'important', label: 'مهم', tone: 'accent' });
  } else if (highlight === 'RUNDOWN_CANDIDATE' || rec === 'INCLUDE_AS_BRIEF') {
    badges.push({ key: 'candidate', label: 'نامزد Today', tone: 'warn' });
  }

  if (auto?.suggestKind === 'ADD') {
    badges.push({ key: 'suggest-add', label: 'پیشنهاد سیستم', tone: 'accent' });
  } else if (auto?.suggestKind === 'REPLACE') {
    badges.push({
      key: 'suggest-replace',
      label: 'پیشنهاد جایگزینی',
      tone: 'warn',
    });
  }

  if (auto?.autoAddAllowed) {
    badges.push({ key: 'auto-add', label: 'انتقال خودکار', tone: 'ok' });
  }

  if (input.inToday) {
    badges.push({ key: 'in-today', label: 'در Today', tone: 'neutral' });
  }

  return badges;
}

export function labelAddedMode(mode?: string | null): string {
  switch (mode) {
    case 'AUTO':
      return 'خودکار';
    case 'SUGGESTED_ACCEPTED':
      return 'پیشنهاد پذیرفته';
    case 'MANUAL':
      return 'دستی';
    default:
      return mode ?? '—';
  }
}

export function labelReviewStatus(status?: string | null): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'نیاز به تأیید';
    case 'ACCEPTED':
      return 'تأیید شد';
    case 'DISMISSED':
      return 'رد شد';
    default:
      return status ?? '';
  }
}
