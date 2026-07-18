import {
  CoverageBucketStatus,
  CoverageDimensionKey,
  CoverageEnforcement,
  CoverageRecommendationType,
  NewsCategory,
} from './enums.js';
import { DAILY_RUNDOWN_POLICY } from './daily-rundown-policy.js';
import { scopeBucketKey } from './normalize-scope.js';

export type CoverageEventRow = {
  id: string;
  scope: string | null;
  category: string | null;
  finalScore: number | null;
  credibilityScore: number | null;
  freshnessScore: number | null;
  status: string;
  teamKeys: string[];
  competitionKeys: string[];
  trackedEventKeys: string[];
  estimatedDurationSeconds?: number;
  title?: string;
};

export type CoverageTargetRow = {
  dimension: string;
  key: string;
  minSelectedCount: number | null;
  maxSelectedCount: number | null;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  priority: number;
  enforcement: string;
  label?: string | null;
};

export type CoverageDimensionBucket = {
  dimension: CoverageDimensionKey | string;
  key: string;
  label: string;
  discoveredEventCount: number;
  eligibleEventCount: number;
  selectedEventCount: number;
  estimatedDurationSeconds: number;
  averageScore: number | null;
  status: CoverageBucketStatus;
  eventIds: {
    discovered: string[];
    eligible: string[];
    selected: string[];
  };
};

export type CoverageRecommendation = {
  type: CoverageRecommendationType;
  dimension: string;
  key: string;
  message: string;
  eligibleCount: number;
  selectedCount: number;
  suggestedEventIds: string[];
  replaceEventId?: string | null;
  reasons: string[];
};

export type CoverageReport = {
  editorialDate: string;
  summary: {
    discoveredEventCount: number;
    eligibleEventCount: number;
    selectedEventCount: number;
    estimatedDurationSeconds: number;
    targetDurationSeconds: number;
    underCovered: string[];
    overCovered: string[];
  };
  scopes: CoverageDimensionBucket[];
  teams: CoverageDimensionBucket[];
  competitions: CoverageDimensionBucket[];
  categories: CoverageDimensionBucket[];
  trackedEvents: CoverageDimensionBucket[];
  recommendations: CoverageRecommendation[];
  note: string;
};

const REJECTED = new Set(['REJECTED', 'ARCHIVED', 'MERGED']);

export function isEligibleEvent(
  ev: CoverageEventRow,
  minFinal = DAILY_RUNDOWN_POLICY.scoreGates.shortlistMin,
  minCred = DAILY_RUNDOWN_POLICY.scoreGates.shortlistCredibilityMin,
): boolean {
  if (REJECTED.has(ev.status)) return false;
  const final = ev.finalScore ?? 0;
  const cred = ev.credibilityScore ?? 0;
  return final >= minFinal && cred >= minCred;
}

export function resolveCoverageStatus(input: {
  eligible: number;
  selected: number;
  minSelected: number | null;
  maxSelected: number | null;
}): CoverageBucketStatus {
  const { eligible, selected, minSelected, maxSelected } = input;
  if (minSelected == null && maxSelected == null) {
    if (eligible === 0 && selected === 0) return CoverageBucketStatus.NO_AVAILABLE_NEWS;
    if (eligible > 0 && selected === 0) return CoverageBucketStatus.AVAILABLE_NOT_SELECTED;
    return CoverageBucketStatus.NO_TARGET;
  }
  if (eligible === 0 && selected === 0) return CoverageBucketStatus.NO_AVAILABLE_NEWS;
  if (eligible > 0 && selected === 0 && (minSelected ?? 0) > 0) {
    return CoverageBucketStatus.AVAILABLE_NOT_SELECTED;
  }
  if (maxSelected != null && selected > maxSelected) {
    return CoverageBucketStatus.OVER_TARGET;
  }
  if (minSelected != null && selected < minSelected) {
    return eligible > 0
      ? selected === 0
        ? CoverageBucketStatus.AVAILABLE_NOT_SELECTED
        : CoverageBucketStatus.UNDER_TARGET
      : CoverageBucketStatus.UNDER_TARGET;
  }
  if (minSelected != null || maxSelected != null) {
    return CoverageBucketStatus.ON_TARGET;
  }
  return CoverageBucketStatus.NO_TARGET;
}

function avg(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function buildBucket(
  dimension: string,
  key: string,
  label: string,
  discovered: CoverageEventRow[],
  selectedIds: Set<string>,
  target: CoverageTargetRow | undefined,
  durationById: Map<string, number>,
): CoverageDimensionBucket {
  const eligible = discovered.filter((e) => isEligibleEvent(e));
  const selected = discovered.filter((e) => selectedIds.has(e.id));
  const estimatedDurationSeconds = selected.reduce(
    (s, e) => s + (durationById.get(e.id) ?? e.estimatedDurationSeconds ?? 60),
    0,
  );
  const status = resolveCoverageStatus({
    eligible: eligible.length,
    selected: selected.length,
    minSelected: target?.minSelectedCount ?? null,
    maxSelected: target?.maxSelectedCount ?? null,
  });
  return {
    dimension,
    key,
    label: target?.label ?? label,
    discoveredEventCount: discovered.length,
    eligibleEventCount: eligible.length,
    selectedEventCount: selected.length,
    estimatedDurationSeconds,
    averageScore: avg(
      discovered.map((e) => e.finalScore).filter((n): n is number => n != null),
    ),
    status,
    eventIds: {
      discovered: discovered.map((e) => e.id),
      eligible: eligible.map((e) => e.id),
      selected: selected.map((e) => e.id),
    },
  };
}

function keysFromEvents(
  events: CoverageEventRow[],
  pick: (e: CoverageEventRow) => string[],
): string[] {
  const set = new Set<string>();
  for (const e of events) for (const k of pick(e)) if (k) set.add(k);
  return [...set].sort();
}

export function buildCoverageReport(input: {
  editorialDate: string;
  events: CoverageEventRow[];
  selectedEventIds: string[];
  selectedDurations?: Record<string, number>;
  targets: CoverageTargetRow[];
  labels?: {
    scopes?: Record<string, string>;
    teams?: Record<string, string>;
    competitions?: Record<string, string>;
    trackedEvents?: Record<string, string>;
    categories?: Record<string, string>;
  };
  targetDurationSeconds?: number;
}): CoverageReport {
  const events = input.events.map((e) => ({
    ...e,
    scope: e.scope ? scopeBucketKey(e.scope) : null,
  }));
  const selectedIds = new Set(input.selectedEventIds);
  const durationById = new Map(
    Object.entries(input.selectedDurations ?? {}).map(([k, v]) => [k, v]),
  );
  const targetMap = new Map(
    input.targets.map((t) => [`${t.dimension}:${t.key}`, t]),
  );
  const labels = input.labels ?? {};

  const scopeKeys = [
    ...new Set([
      ...keysFromEvents(events, (e) => (e.scope ? [e.scope] : [])),
      'IRAN',
      'EUROPE',
    ]),
  ];
  const teamKeys = keysFromEvents(events, (e) => e.teamKeys);
  const competitionKeys = keysFromEvents(events, (e) => e.competitionKeys);
  const trackedKeys = keysFromEvents(events, (e) => e.trackedEventKeys);
  // Always include target keys even if empty
  for (const t of input.targets) {
    if (t.dimension === CoverageDimensionKey.TEAM) teamKeys.push(t.key);
    if (t.dimension === CoverageDimensionKey.COMPETITION) competitionKeys.push(t.key);
    if (t.dimension === CoverageDimensionKey.TRACKED_EVENT) trackedKeys.push(t.key);
  }
  const uniq = (arr: string[]) => [...new Set(arr)];

  const categoryKeys = uniq([
    ...keysFromEvents(events, (e) => (e.category ? [e.category] : [])),
    NewsCategory.TRANSFER,
    NewsCategory.MATCH_RESULT,
    NewsCategory.INJURY,
    NewsCategory.COACH_CHANGE,
    NewsCategory.MANAGEMENT,
  ]);

  const scopes = uniq(scopeKeys).map((key) =>
    buildBucket(
      CoverageDimensionKey.SCOPE,
      key,
      labels.scopes?.[key] ?? key,
      events.filter((e) => e.scope === key),
      selectedIds,
      targetMap.get(`${CoverageDimensionKey.SCOPE}:${key}`),
      durationById,
    ),
  );

  const teams = uniq(teamKeys).map((key) =>
    buildBucket(
      CoverageDimensionKey.TEAM,
      key,
      labels.teams?.[key] ?? key,
      events.filter((e) => e.teamKeys.includes(key)),
      selectedIds,
      targetMap.get(`${CoverageDimensionKey.TEAM}:${key}`),
      durationById,
    ),
  );

  const competitions = uniq(competitionKeys).map((key) =>
    buildBucket(
      CoverageDimensionKey.COMPETITION,
      key,
      labels.competitions?.[key] ?? key,
      events.filter((e) => e.competitionKeys.includes(key)),
      selectedIds,
      targetMap.get(`${CoverageDimensionKey.COMPETITION}:${key}`),
      durationById,
    ),
  );

  const trackedEvents = uniq(trackedKeys).map((key) =>
    buildBucket(
      CoverageDimensionKey.TRACKED_EVENT,
      key,
      labels.trackedEvents?.[key] ?? key,
      events.filter((e) => e.trackedEventKeys.includes(key)),
      selectedIds,
      targetMap.get(`${CoverageDimensionKey.TRACKED_EVENT}:${key}`),
      durationById,
    ),
  );

  const categories = categoryKeys.map((key) =>
    buildBucket(
      CoverageDimensionKey.CATEGORY,
      key,
      labels.categories?.[key] ?? key,
      events.filter((e) => e.category === key),
      selectedIds,
      targetMap.get(`${CoverageDimensionKey.CATEGORY}:${key}`),
      durationById,
    ),
  );

  const selectedEvents = events.filter((e) => selectedIds.has(e.id));
  const estimatedDurationSeconds = selectedEvents.reduce(
    (s, e) => s + (durationById.get(e.id) ?? e.estimatedDurationSeconds ?? 60),
    0,
  );

  const allBuckets = [...scopes, ...teams, ...competitions, ...trackedEvents, ...categories];
  const underCovered = allBuckets
    .filter(
      (b) =>
        b.status === CoverageBucketStatus.AVAILABLE_NOT_SELECTED ||
        b.status === CoverageBucketStatus.UNDER_TARGET,
    )
    .map((b) => b.label);
  const overCovered = allBuckets
    .filter((b) => b.status === CoverageBucketStatus.OVER_TARGET)
    .map((b) => b.label);

  const recommendations = buildRecommendations({
    buckets: allBuckets,
    events,
    selectedIds,
    targets: input.targets,
  });

  return {
    editorialDate: input.editorialDate,
    summary: {
      discoveredEventCount: events.length,
      eligibleEventCount: events.filter((e) => isEligibleEvent(e)).length,
      selectedEventCount: selectedIds.size,
      estimatedDurationSeconds,
      targetDurationSeconds:
        input.targetDurationSeconds ?? DAILY_RUNDOWN_POLICY.targetDurationSeconds,
      underCovered: underCovered.slice(0, 8),
      overCovered: overCovered.slice(0, 8),
    },
    scopes: scopes.sort((a, b) => b.discoveredEventCount - a.discoveredEventCount),
    teams: teams.sort((a, b) => b.discoveredEventCount - a.discoveredEventCount),
    competitions: competitions.sort(
      (a, b) => b.discoveredEventCount - a.discoveredEventCount,
    ),
    categories: categories.sort(
      (a, b) => b.discoveredEventCount - a.discoveredEventCount,
    ),
    trackedEvents: trackedEvents.sort(
      (a, b) => b.discoveredEventCount - a.discoveredEventCount,
    ),
    recommendations,
    note: 'تعداد رویدادها بر اساس برچسب است؛ یک خبر ممکن است هم‌زمان در چند دسته (مثلاً ایران + لیگ ایران + استقلال + نقل‌وانتقالات) شمرده شود.',
  };
}

function buildRecommendations(input: {
  buckets: CoverageDimensionBucket[];
  events: CoverageEventRow[];
  selectedIds: Set<string>;
  targets: CoverageTargetRow[];
}): CoverageRecommendation[] {
  const out: CoverageRecommendation[] = [];
  const byId = new Map(input.events.map((e) => [e.id, e]));

  for (const bucket of input.buckets) {
    const target = input.targets.find(
      (t) => t.dimension === bucket.dimension && t.key === bucket.key,
    );
    if (
      bucket.status === CoverageBucketStatus.NO_AVAILABLE_NEWS &&
      target &&
      (target.minSelectedCount ?? 0) > 0 &&
      target.enforcement !== CoverageEnforcement.ADVISORY
    ) {
      out.push({
        type: CoverageRecommendationType.NO_AVAILABLE_NEWS,
        dimension: bucket.dimension,
        key: bucket.key,
        message: `${bucket.label}: هیچ خبر واجد شرایطی استخراج نشده است.`,
        eligibleCount: 0,
        selectedCount: 0,
        suggestedEventIds: [],
        reasons: ['eligibleEventCount = 0'],
      });
    }

    if (
      bucket.status === CoverageBucketStatus.AVAILABLE_NOT_SELECTED ||
      bucket.status === CoverageBucketStatus.UNDER_TARGET
    ) {
      const suggested = bucket.eventIds.eligible
        .filter((id) => !input.selectedIds.has(id))
        .sort((a, b) => (byId.get(b)?.finalScore ?? 0) - (byId.get(a)?.finalScore ?? 0))
        .slice(0, 3);
      if (suggested.length > 0) {
        out.push({
          type: CoverageRecommendationType.COVERAGE_GAP,
          dimension: bucket.dimension,
          key: bucket.key,
          message: `${bucket.label}: ${bucket.eligibleEventCount} خبر واجد شرایط دارد ولی در مخزن امروز ${bucket.selectedEventCount} خبر است.`,
          eligibleCount: bucket.eligibleEventCount,
          selectedCount: bucket.selectedEventCount,
          suggestedEventIds: suggested,
          reasons: [`status=${bucket.status}`, 'پیشنهاد افزودن خبر واجد شرایط'],
        });
      }
    }

    if (bucket.status === CoverageBucketStatus.OVER_TARGET) {
      out.push({
        type: CoverageRecommendationType.OVER_COVERED,
        dimension: bucket.dimension,
        key: bucket.key,
        message: `${bucket.label}: پوشش بالاتر از سقف پیشنهادی است (${bucket.selectedEventCount} خبر).`,
        eligibleCount: bucket.eligibleEventCount,
        selectedCount: bucket.selectedEventCount,
        suggestedEventIds: [],
        reasons: ['selected > maxSelectedCount'],
      });
    }

    if (
      bucket.dimension === CoverageDimensionKey.TEAM &&
      target?.maxSelectedCount != null &&
      bucket.selectedEventCount > target.maxSelectedCount
    ) {
      out.push({
        type: CoverageRecommendationType.TEAM_REDUNDANCY,
        dimension: bucket.dimension,
        key: bucket.key,
        message: `${bucket.label}: بیش از سقف تیم در مخزن امروز (${bucket.selectedEventCount}/${target.maxSelectedCount}).`,
        eligibleCount: bucket.eligibleEventCount,
        selectedCount: bucket.selectedEventCount,
        suggestedEventIds: [],
        reasons: ['team maxSelectedCount exceeded'],
      });
    }
  }

  // Category duration redundancy for TRANSFER
  const transfer = input.buckets.find(
    (b) =>
      b.dimension === CoverageDimensionKey.CATEGORY && b.key === NewsCategory.TRANSFER,
  );
  const totalDur = input.buckets
    .filter((b) => b.dimension === CoverageDimensionKey.SCOPE)
    .reduce((s, b) => s + b.estimatedDurationSeconds, 0);
  if (transfer && totalDur > 0) {
    const pct = (transfer.estimatedDurationSeconds / totalDur) * 100;
    if (pct > 35 && transfer.selectedEventCount > 0) {
      out.push({
        type: CoverageRecommendationType.CATEGORY_REDUNDANCY,
        dimension: CoverageDimensionKey.CATEGORY,
        key: NewsCategory.TRANSFER,
        message: `نقل‌وانتقالات حدود ${pct.toFixed(0)}٪ زمان مخزن را گرفته (سقف پیشنهادی ۳۵٪).`,
        eligibleCount: transfer.eligibleEventCount,
        selectedCount: transfer.selectedEventCount,
        suggestedEventIds: [],
        reasons: [`transferDurationPercent=${pct.toFixed(1)}`],
      });
    }
  }

  // Replacement: over-covered weak selected vs gap strong eligible
  const gap = out.find((r) => r.type === CoverageRecommendationType.COVERAGE_GAP);
  const overTeam = input.buckets.find(
    (b) =>
      b.dimension === CoverageDimensionKey.TEAM &&
      b.status === CoverageBucketStatus.OVER_TARGET &&
      b.selectedEventCount > 0,
  );
  if (gap && overTeam && gap.suggestedEventIds[0]) {
    const weak = overTeam.eventIds.selected
      .map((id) => byId.get(id))
      .filter((e): e is CoverageEventRow => !!e)
      .sort((a, b) => (a.finalScore ?? 0) - (b.finalScore ?? 0))[0];
    const strong = byId.get(gap.suggestedEventIds[0]);
    if (
      weak &&
      strong &&
      isEligibleEvent(strong) &&
      (strong.finalScore ?? 0) >= (weak.finalScore ?? 0) + 8
    ) {
      out.push({
        type: CoverageRecommendationType.REPLACEMENT_SUGGESTION,
        dimension: gap.dimension,
        key: gap.key,
        message: `پیشنهاد جایگزینی: «${weak.title ?? weak.id}» از ${overTeam.label} با خبر قوی‌تر از ${gap.key}.`,
        eligibleCount: gap.eligibleCount,
        selectedCount: gap.selectedCount,
        suggestedEventIds: [strong.id],
        replaceEventId: weak.id,
        reasons: [
          `utility gain ~${((strong.finalScore ?? 0) - (weak.finalScore ?? 0)).toFixed(0)}`,
          'بدون اعمال خودکار',
        ],
      });
    }
  }

  // Soft picks: nothing meets shortlist gates, but discovered news exists
  const hasActionableGap = out.some(
    (r) =>
      r.type === CoverageRecommendationType.COVERAGE_GAP &&
      r.suggestedEventIds.length > 0,
  );
  const eligibleTotal = input.events.filter((e) => isEligibleEvent(e)).length;
  if (!hasActionableGap && eligibleTotal === 0) {
    const minFinal = DAILY_RUNDOWN_POLICY.scoreGates.shortlistMin;
    const minCred = DAILY_RUNDOWN_POLICY.scoreGates.shortlistCredibilityMin;
    const soft = input.events
      .filter((e) => !REJECTED.has(e.status) && !input.selectedIds.has(e.id))
      .map((e) => ({
        e,
        rank:
          (e.finalScore ?? 0) * 0.7 +
          (e.credibilityScore ?? 0) * 0.3 +
          (e.freshnessScore ?? 0) * 0.05,
      }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 5)
      .map((x) => x.e);
    if (soft.length > 0) {
      const titles = soft
        .map((e) => {
          const score = Math.round(e.finalScore ?? 0);
          const t = (e.title ?? e.id).slice(0, 42);
          return `«${t}» (${score})`;
        })
        .join(' · ');
      out.push({
        type: CoverageRecommendationType.BEST_AVAILABLE,
        dimension: 'GLOBAL',
        key: 'best_available',
        message: `هیچ خبری به آستانهٔ Today نرسیده (امتیاز ≥ ${minFinal} و اعتبار ≥ ${minCred}). بهترین‌های موجود برای بررسی دستی: ${titles}`,
        eligibleCount: 0,
        selectedCount: input.selectedIds.size,
        suggestedEventIds: soft.map((e) => e.id),
        reasons: [
          'eligibleEventCount = 0',
          'soft_rank_by_score_cred_freshness',
          `shortlistGates=${minFinal}/${minCred}`,
        ],
      });
    }
  }

  // Dedupe by type+dimension+key, keep higher priority gaps first
  const seen = new Set<string>();
  return out
    .sort((a, b) => {
      const rank = (t: CoverageRecommendationType) =>
        t === CoverageRecommendationType.COVERAGE_GAP
          ? 0
          : t === CoverageRecommendationType.REPLACEMENT_SUGGESTION
            ? 1
            : t === CoverageRecommendationType.BEST_AVAILABLE
              ? 2
              : 3;
      return rank(a.type) - rank(b.type);
    })
    .filter((r) => {
      const k = `${r.type}:${r.dimension}:${r.key}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8);
}

/** Normalize Persian/English team-ish strings for matching */
export function normalizeTaxonomyKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[يی]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '')
    .trim();
}
