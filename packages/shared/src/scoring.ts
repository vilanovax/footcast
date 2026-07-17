export interface ImportanceFactors {
  sportingImpact: number;
  teamOrPlayerImportance: number;
  sourceCredibility: number;
  freshness: number;
  officialness: number;
  nationalOrInternationalImpact: number;
  independentSourceCount: number;
  podcastFitness: number;
}

export interface ImportancePenalties {
  duplicate?: number;
  stale?: number;
  clickbait?: number;
  untrustedSource?: number;
  noNewDevelopment?: number;
  singleSourceRumor?: number;
}

const WEIGHTS: ImportanceFactors = {
  sportingImpact: 0.25,
  teamOrPlayerImportance: 0.15,
  sourceCredibility: 0.15,
  freshness: 0.15,
  officialness: 0.1,
  nationalOrInternationalImpact: 0.1,
  independentSourceCount: 0.05,
  podcastFitness: 0.05,
};

const PENALTY_CAPS: Required<ImportancePenalties> = {
  duplicate: 40,
  stale: 30,
  clickbait: 20,
  untrustedSource: 30,
  noNewDevelopment: 25,
  singleSourceRumor: 25,
};

function clamp01to100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function computeImportanceScore(
  factors: ImportanceFactors,
  penalties: ImportancePenalties = {},
): number {
  let score = 0;
  (Object.keys(WEIGHTS) as (keyof ImportanceFactors)[]).forEach((key) => {
    score += clamp01to100(factors[key]) * WEIGHTS[key];
  });

  (Object.keys(PENALTY_CAPS) as (keyof Required<ImportancePenalties>)[]).forEach((key) => {
    const raw = penalties[key] ?? 0;
    const applied = Math.min(Math.max(0, raw), PENALTY_CAPS[key]);
    score -= applied;
  });

  return Math.round(clamp01to100(score));
}
