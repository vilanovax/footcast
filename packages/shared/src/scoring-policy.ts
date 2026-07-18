/**
 * Central MVP scoring policy — single source of weights/thresholds.
 * Future: load from ScoringPolicy table without changing call sites.
 */
export const MVP_SCORING_POLICY = {
  version: '1.0.0',
  credibility: {
    sourceCredibility: 0.35,
    officialStatus: 0.25,
    independentSources: 0.2,
    evidenceQuality: 0.1,
    sourceAgreement: 0.1,
  },
  importance: {
    sportingImpact: 0.25,
    teamOrPlayerImportance: 0.2,
    audienceRelevance: 0.2,
    freshness: 0.15,
    nationalOrInternationalImpact: 0.1,
    novelty: 0.1,
  },
  podcastValue: {
    listenerAppeal: 0.35,
    narrativeValue: 0.25,
    explainability: 0.15,
    newDevelopment: 0.15,
    episodeFit: 0.1,
  },
  final: {
    importance: 0.45,
    credibility: 0.35,
    podcastValue: 0.2,
  },
  thresholds: {
    leadStory: { finalScore: 85, credibilityScore: 70 },
    mainPodcast: { finalScore: 70, credibilityScore: 65 },
    brief: { finalScore: 60, credibilityScore: 55 },
    rumorTransfer: { finalScore: 65, credibilityScore: 50 },
    hardReviewCredibility: 40,
  },
  independentSourceScoreMap: [
    { min: 5, score: 100 },
    { min: 4, score: 90 },
    { min: 3, score: 75 },
    { min: 2, score: 55 },
    { min: 1, score: 25 },
  ],
} as const;

export type EditorialRecommendation =
  | 'LEAD_STORY'
  | 'INCLUDE_IN_MAIN_PODCAST'
  | 'INCLUDE_AS_BRIEF'
  | 'NEEDS_EDITOR_REVIEW'
  | 'REJECT_OR_ARCHIVE';

export type ScoreAdjustment = {
  code: string;
  value: number;
  reason: string;
};

export function roundScore(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(Math.max(0, Math.min(100, n)) * f) / f;
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function independentSourceScore(count: number): number {
  for (const row of MVP_SCORING_POLICY.independentSourceScoreMap) {
    if (count >= row.min) return row.score;
  }
  return 25;
}

/** highestTrusted × 0.60 + avgOthers × 0.40; official floor 90 */
export function combineSourceCredibility(
  seeds: number[],
  opts?: { hasOfficialSource?: boolean },
): number {
  if (seeds.length === 0) return 50;
  const sorted = [...seeds].sort((a, b) => b - a);
  const highest = sorted[0]!;
  const others = sorted.slice(1);
  const avgOthers =
    others.length > 0 ? others.reduce((s, n) => s + n, 0) / others.length : highest;
  let score = highest * 0.6 + avgOthers * 0.4;
  if (opts?.hasOfficialSource) score = Math.max(score, 90);
  return clampScore(score);
}

export function officialStatusScore(status?: string | null): number {
  switch (status) {
    case 'OFFICIAL':
      return 100;
    case 'CONFIRMED':
      return 90;
    case 'MULTI_SOURCE_REPORT':
      return 80;
    case 'RELIABLE_REPORT':
      return 70;
    case 'UNVERIFIED':
      return 45;
    case 'RUMOR':
      return 25;
    case 'DISPUTED':
      return 10;
    case 'FALSE':
      return 0;
    default:
      return 40;
  }
}

export function recommendationFromScores(input: {
  finalScore: number;
  credibilityScore: number;
  officialStatus?: string | null;
  category?: string | null;
}): EditorialRecommendation {
  const { finalScore, credibilityScore, officialStatus, category } = input;
  const t = MVP_SCORING_POLICY.thresholds;

  if (credibilityScore < t.hardReviewCredibility) {
    return 'NEEDS_EDITOR_REVIEW';
  }

  const isTransferRumor =
    category === 'TRANSFER' &&
    (officialStatus === 'RUMOR' || officialStatus === 'RELIABLE_REPORT');

  if (
    isTransferRumor &&
    finalScore >= t.rumorTransfer.finalScore &&
    credibilityScore >= t.rumorTransfer.credibilityScore
  ) {
    return 'INCLUDE_AS_BRIEF';
  }

  if (
    finalScore >= t.leadStory.finalScore &&
    credibilityScore >= t.leadStory.credibilityScore
  ) {
    return 'LEAD_STORY';
  }
  if (
    finalScore >= t.mainPodcast.finalScore &&
    credibilityScore >= t.mainPodcast.credibilityScore
  ) {
    return 'INCLUDE_IN_MAIN_PODCAST';
  }
  if (finalScore >= t.brief.finalScore && credibilityScore >= t.brief.credibilityScore) {
    return 'INCLUDE_AS_BRIEF';
  }
  if (finalScore >= 45) return 'NEEDS_EDITOR_REVIEW';
  return 'REJECT_OR_ARCHIVE';
}

export function recommendationLabelFa(rec?: string | null): string {
  switch (rec) {
    case 'LEAD_STORY':
      return 'تیتر اول';
    case 'INCLUDE_IN_MAIN_PODCAST':
      return 'پادکست اصلی';
    case 'INCLUDE_AS_BRIEF':
      return 'خبر کوتاه';
    case 'NEEDS_EDITOR_REVIEW':
      return 'نیاز به بررسی';
    case 'REJECT_OR_ARCHIVE':
      return 'رد / بایگانی';
    default:
      return '—';
  }
}
