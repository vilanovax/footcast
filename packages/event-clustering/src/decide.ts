export type MatchMethod =
  | 'content_hash'
  | 'title'
  | 'entity'
  | 'embedding'
  | 'manual';

export type ClusterDecisionKind = 'create' | 'merge' | 'conflict' | 'skip';

export interface CandidateScore {
  eventId: string;
  articleId: string;
  contentHashMatch: boolean;
  titleSimilarity: number;
  entityOverlap: number;
  embeddingSimilarity: number;
  sameCategory: boolean;
  withinTimeWindow: boolean;
}

export interface ClusterDecision {
  kind: ClusterDecisionKind;
  method: MatchMethod | null;
  score: number;
  eventId?: string;
  reason: string;
}

export const THRESHOLDS = {
  titleMerge: 0.86,
  entityMerge: 0.66,
  embeddingMerge: 0.9,
  embeddingConflict: 0.78,
  titleConflict: 0.72,
} as const;

export function scoreCandidate(candidate: CandidateScore): number {
  if (candidate.contentHashMatch) return 1;
  return (
    candidate.embeddingSimilarity * 0.55 +
    candidate.titleSimilarity * 0.3 +
    candidate.entityOverlap * 0.15 +
    (candidate.sameCategory ? 0.03 : 0) +
    (candidate.withinTimeWindow ? 0.02 : 0)
  );
}

export function decideClusterAction(candidates: CandidateScore[]): ClusterDecision {
  if (candidates.length === 0) {
    return { kind: 'create', method: null, score: 0, reason: 'no_candidates' };
  }

  const ranked = [...candidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  const best = ranked[0]!;
  const score = scoreCandidate(best);

  if (best.contentHashMatch) {
    return {
      kind: 'merge',
      method: 'content_hash',
      score: 1,
      eventId: best.eventId,
      reason: 'exact_content_hash',
    };
  }

  const strongTitle =
    best.titleSimilarity >= THRESHOLDS.titleMerge &&
    best.withinTimeWindow &&
    (best.sameCategory || best.entityOverlap >= 0.34);
  const strongEmbed =
    best.embeddingSimilarity >= THRESHOLDS.embeddingMerge && best.withinTimeWindow;
  const strongEntity =
    best.entityOverlap >= THRESHOLDS.entityMerge &&
    best.titleSimilarity >= 0.55 &&
    best.withinTimeWindow;

  if (strongTitle || strongEmbed || strongEntity) {
    const method: MatchMethod = strongEmbed
      ? 'embedding'
      : strongTitle
        ? 'title'
        : 'entity';
    return {
      kind: 'merge',
      method,
      score,
      eventId: best.eventId,
      reason: `strong_${method}`,
    };
  }

  const ambiguous =
    (best.embeddingSimilarity >= THRESHOLDS.embeddingConflict ||
      best.titleSimilarity >= THRESHOLDS.titleConflict) &&
    best.withinTimeWindow;

  if (ambiguous) {
    return {
      kind: 'conflict',
      method: best.embeddingSimilarity >= best.titleSimilarity ? 'embedding' : 'title',
      score,
      eventId: best.eventId,
      reason: 'ambiguous_similarity',
    };
  }

  return { kind: 'create', method: null, score, reason: 'below_thresholds' };
}
