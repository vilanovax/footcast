import {
  CoverageDimension,
  CoverageEnforcement,
  NewsCategory,
  RundownSection,
} from './enums.js';

export const DAILY_RUNDOWN_POLICY = {
  version: '1.0.0',
  timezone: 'Asia/Tehran',
  defaultDeadlineHour: 16,
  defaultDeadlineMinute: 0,
  targetDurationSeconds: 10 * 60,
  scoreGates: {
    skipBelow: 55,
    candidateMin: 55,
    shortlistMin: 70,
    shortlistCredibilityMin: 60,
  },
  durationBySection: {
    [RundownSection.LEAD]: 90,
    [RundownSection.MAIN]: 60,
    [RundownSection.BRIEF]: 30,
    [RundownSection.RESULTS]: 25,
    [RundownSection.WATCHLIST]: 20,
  } as Record<RundownSection, number>,
  utilityWeights: {
    finalScore: 0.45,
    freshness: 0.1,
    audienceRelevance: 0.15,
    developmentStrength: 0.1,
    coverageNeed: 0.15,
    editorPriority: 0.05,
  },
  coverageRules: [
    {
      dimension: CoverageDimension.SCOPE,
      key: 'IRAN',
      minTarget: 35,
      maxTarget: 50,
      unit: 'PERCENT_DURATION' as const,
      enforcement: CoverageEnforcement.SOFT,
      priority: 10,
    },
    {
      dimension: CoverageDimension.SCOPE,
      key: 'EUROPE',
      minTarget: 35,
      maxTarget: 50,
      unit: 'PERCENT_DURATION' as const,
      enforcement: CoverageEnforcement.SOFT,
      priority: 9,
    },
    {
      dimension: CoverageDimension.SECTION,
      key: RundownSection.LEAD,
      minTarget: 1,
      maxTarget: 1,
      unit: 'COUNT' as const,
      enforcement: CoverageEnforcement.HARD,
      priority: 20,
    },
    {
      dimension: CoverageDimension.CATEGORY,
      key: NewsCategory.TRANSFER,
      minTarget: 0,
      maxTarget: 35,
      unit: 'PERCENT_DURATION' as const,
      enforcement: CoverageEnforcement.SOFT,
      priority: 5,
    },
  ],
} as const;

export type CoverageRule = (typeof DAILY_RUNDOWN_POLICY.coverageRules)[number];

/** YYYY-MM-DD in Asia/Tehran */
export function editorialDateTehran(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_RUNDOWN_POLICY.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Deadline Date for an editorial day (Tehran wall clock → UTC Date) */
export function deadlineAtForEditorialDate(
  editorialDate: string,
  hour = DAILY_RUNDOWN_POLICY.defaultDeadlineHour,
  minute = DAILY_RUNDOWN_POLICY.defaultDeadlineMinute,
): Date {
  // Interpret wall time in Tehran via offset lookup at noon that day
  const probe = new Date(`${editorialDate}T12:00:00.000Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_RUNDOWN_POLICY.timezone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(probe);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+3:30';
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tzName);
  let offsetMin = 210; // Asia/Tehran default +03:30
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    offsetMin = sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  }
  const [y, mo, d] = editorialDate.split('-').map(Number);
  const utcMs =
    Date.UTC(y, mo - 1, d, hour, minute, 0) - offsetMin * 60_000;
  return new Date(utcMs);
}

export function estimateDurationSeconds(
  section: RundownSection | string | null | undefined,
): number {
  const key = (section ?? RundownSection.MAIN) as RundownSection;
  return (
    DAILY_RUNDOWN_POLICY.durationBySection[key] ??
    DAILY_RUNDOWN_POLICY.durationBySection[RundownSection.MAIN]
  );
}

export function suggestSection(finalScore: number | null | undefined): RundownSection {
  const s = finalScore ?? 0;
  if (s >= 85) return RundownSection.LEAD;
  if (s >= 70) return RundownSection.MAIN;
  if (s >= 60) return RundownSection.BRIEF;
  return RundownSection.WATCHLIST;
}

export function waveLabelForTime(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DAILY_RUNDOWN_POLICY.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `موج ${hour}:${minute}`;
}

export type UtilityInput = {
  finalScore: number;
  freshnessScore: number;
  audienceRelevance?: number;
  developmentStrength?: number;
  coverageNeed?: number;
  editorPriority?: number;
  redundancyPenalty?: number;
};

export function selectionUtility(input: UtilityInput): number {
  const w = DAILY_RUNDOWN_POLICY.utilityWeights;
  const raw =
    input.finalScore * w.finalScore +
    input.freshnessScore * w.freshness +
    (input.audienceRelevance ?? 50) * w.audienceRelevance +
    (input.developmentStrength ?? 50) * w.developmentStrength +
    (input.coverageNeed ?? 50) * w.coverageNeed +
    (input.editorPriority ?? 50) * w.editorPriority -
    (input.redundancyPenalty ?? 0);
  return Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
}

export type CoverageBucket = {
  key: string;
  label: string;
  count: number;
  durationSeconds: number;
  percentDuration: number;
};

export type ActiveRundownItem = {
  scope: string | null;
  category: string | null;
  section: string;
  estimatedDurationSeconds: number;
  isLeadStory?: boolean;
};

const SCOPE_LABELS: Record<string, string> = {
  IRAN: 'ایران',
  EUROPE: 'اروپا',
  BOTH: 'ایران و اروپا',
  OTHER: 'سایر',
  EPL: 'لیگ انگلیس',
  LALIGA: 'لالیگا',
  SERIE_A: 'سری‌آ',
  BUNDESLIGA: 'بوندسلیگا',
  LIGUE_1: 'لیگ ۱',
  UCL: 'لیگ قهرمانان',
};

export function summarizeCoverage(items: ActiveRundownItem[]): {
  byScope: CoverageBucket[];
  byCategory: CoverageBucket[];
  totalDurationSeconds: number;
  totalCount: number;
  softViolations: string[];
} {
  const active = items.filter((i) => i.estimatedDurationSeconds > 0);
  const totalDurationSeconds = active.reduce(
    (s, i) => s + i.estimatedDurationSeconds,
    0,
  );
  const byScopeMap = new Map<string, { count: number; duration: number }>();
  const byCatMap = new Map<string, { count: number; duration: number }>();

  for (const item of active) {
    const scope = item.scope ?? 'OTHER';
    const cat = item.category ?? 'OTHER';
    const s = byScopeMap.get(scope) ?? { count: 0, duration: 0 };
    s.count += 1;
    s.duration += item.estimatedDurationSeconds;
    byScopeMap.set(scope, s);
    const c = byCatMap.get(cat) ?? { count: 0, duration: 0 };
    c.count += 1;
    c.duration += item.estimatedDurationSeconds;
    byCatMap.set(cat, c);
  }

  const toBuckets = (
    map: Map<string, { count: number; duration: number }>,
  ): CoverageBucket[] =>
    [...map.entries()]
      .map(([key, v]) => ({
        key,
        label: SCOPE_LABELS[key] ?? key,
        count: v.count,
        durationSeconds: v.duration,
        percentDuration:
          totalDurationSeconds > 0
            ? Math.round((v.duration / totalDurationSeconds) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds);

  const softViolations: string[] = [];
  const leadCount = active.filter(
    (i) => i.section === RundownSection.LEAD || i.isLeadStory,
  ).length;
  if (leadCount !== 1 && active.length > 0) {
    softViolations.push(
      leadCount === 0
        ? 'خبر Lead مشخص نشده'
        : `بیش از یک Lead (${leadCount})`,
    );
  }

  for (const rule of DAILY_RUNDOWN_POLICY.coverageRules) {
    if (rule.unit !== 'PERCENT_DURATION' || rule.dimension !== CoverageDimension.SCOPE) {
      continue;
    }
    const bucket = byScopeMap.get(rule.key);
    const pct =
      totalDurationSeconds > 0 && bucket
        ? (bucket.duration / totalDurationSeconds) * 100
        : 0;
    if (active.length >= 3 && pct < rule.minTarget) {
      softViolations.push(
        `پوشش ${SCOPE_LABELS[rule.key] ?? rule.key} زیر هدف (${pct.toFixed(0)}٪ < ${rule.minTarget}٪)`,
      );
    }
    if (pct > rule.maxTarget) {
      softViolations.push(
        `پوشش ${SCOPE_LABELS[rule.key] ?? rule.key} بالای سقف (${pct.toFixed(0)}٪ > ${rule.maxTarget}٪)`,
      );
    }
  }

  return {
    byScope: toBuckets(byScopeMap),
    byCategory: toBuckets(byCatMap),
    totalDurationSeconds,
    totalCount: active.length,
    softViolations,
  };
}

export function coverageNeedForScope(
  scope: string | null | undefined,
  summary: ReturnType<typeof summarizeCoverage>,
): number {
  const key = scope ?? 'OTHER';
  const bucket = summary.byScope.find((b) => b.key === key);
  const pct = bucket?.percentDuration ?? 0;
  const rule = DAILY_RUNDOWN_POLICY.coverageRules.find(
    (r) => r.dimension === CoverageDimension.SCOPE && r.key === key,
  );
  if (!rule || rule.unit !== 'PERCENT_DURATION') return 50;
  if (pct < rule.minTarget) return 80;
  if (pct > rule.maxTarget) return 25;
  return 50;
}
