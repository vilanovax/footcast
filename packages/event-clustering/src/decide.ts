import {
  CLUSTER_THRESHOLDS,
  decisionToStoredRole,
  isActionProgression,
  type ClusterRecommendedAction,
  type ClusterRelationshipDecision,
  type EventArticleRelationship,
  type EventSignature,
} from '@footcast/shared';
import type { SimilarityBreakdown } from './similarity.js';
import { actionCompatibility } from './similarity.js';

export type MatchMethod =
  | 'content_hash'
  | 'url_hash'
  | 'near_duplicate'
  | 'structured'
  | 'embedding'
  | 'ai_boundary'
  | 'manual';

export type ClusterDecisionKind =
  | 'create'
  | 'attach'
  | 'conflict'
  | 'skip';

export interface ClusterDecision {
  kind: ClusterDecisionKind;
  method: MatchMethod | null;
  score: number;
  eventId?: string;
  reason: string;
  relationshipDecision: ClusterRelationshipDecision;
  storedRole: EventArticleRelationship;
  recommendedAction: ClusterRecommendedAction;
  breakdown?: SimilarityBreakdown;
  needsAiBoundary?: boolean;
  aiConfidence?: number;
}

/** @deprecated use ClusterDecision — kept for older imports */
export type ClusterDecisionKindLegacy = 'create' | 'merge' | 'conflict' | 'skip';

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

/** Legacy scorer — prefer computeEventSimilarity + decideFromSimilarity */
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

export function classifyRelationship(input: {
  exactDuplicate: boolean;
  nearDuplicate: boolean;
  nearScore?: number;
  breakdown: SimilarityBreakdown;
  incoming: EventSignature;
  candidate: EventSignature;
  hasClaimConflict?: boolean;
}): ClusterRelationshipDecision {
  if (input.exactDuplicate) return 'EXACT_DUPLICATE';
  if (input.nearDuplicate) return 'NEAR_DUPLICATE';
  if (input.hasClaimConflict) return 'CONFLICTING';

  const action = actionCompatibility(input.incoming.action, input.candidate.action);
  if (
    action.isProgression ||
    isActionProgression(input.candidate.action, input.incoming.action)
  ) {
    return 'NEW_DEVELOPMENT';
  }

  if (
    input.breakdown.sharedPrimaryEntities.length > 0 &&
    input.breakdown.eventTypeSimilarity >= 0.7 &&
    input.breakdown.eventSimilarity >= CLUSTER_THRESHOLDS.aiBoundaryMin
  ) {
    return 'SAME_EVENT';
  }

  if (
    input.breakdown.sharedPrimaryEntities.length > 0 &&
    input.breakdown.eventTypeSimilarity < 0.5
  ) {
    return 'RELATED_BUT_DIFFERENT';
  }

  if (input.breakdown.eventSimilarity < CLUSTER_THRESHOLDS.aiBoundaryMin) {
    return 'UNRELATED';
  }

  return 'SAME_EVENT';
}

export function decideFromSimilarity(input: {
  eventId: string;
  exactDuplicate: boolean;
  nearDuplicate: boolean;
  nearScore?: number;
  breakdown: SimilarityBreakdown;
  incoming: EventSignature;
  candidate: EventSignature;
  hasClaimConflict?: boolean;
  aiDecision?: {
    relationship: ClusterRelationshipDecision;
    confidence: number;
    recommendedAction?: ClusterRecommendedAction;
  } | null;
}): ClusterDecision {
  const { breakdown } = input;
  const score = input.exactDuplicate
    ? 1
    : input.nearDuplicate
      ? Math.max(input.nearScore ?? 0.95, breakdown.eventSimilarity)
      : breakdown.eventSimilarity;

  if (input.exactDuplicate || input.nearDuplicate) {
    const relationshipDecision = input.exactDuplicate
      ? 'EXACT_DUPLICATE'
      : 'NEAR_DUPLICATE';
    return {
      kind: 'attach',
      method: input.exactDuplicate ? 'content_hash' : 'near_duplicate',
      score,
      eventId: input.eventId,
      reason: input.exactDuplicate ? 'exact_duplicate' : 'near_duplicate',
      relationshipDecision,
      storedRole: decisionToStoredRole(relationshipDecision),
      recommendedAction: 'ATTACH_AS_DUPLICATE',
      breakdown,
    };
  }

  // Hard gate: no shared entity and not same match → create (avoid false merge)
  if (
    !breakdown.sameMatchId &&
    breakdown.sharedPrimaryEntities.length === 0 &&
    breakdown.entitySimilarity < 0.34
  ) {
    return {
      kind: 'create',
      method: null,
      score,
      reason: 'no_shared_primary_entity',
      relationshipDecision: 'UNRELATED',
      storedRole: 'BACKGROUND',
      recommendedAction: 'CREATE_NEW_EVENT',
      breakdown,
    };
  }

  if (score >= CLUSTER_THRESHOLDS.autoMerge) {
    const relationshipDecision = classifyRelationship(input);
    if (relationshipDecision === 'RELATED_BUT_DIFFERENT') {
      return {
        kind: 'create',
        method: 'structured',
        score,
        reason: 'related_but_different',
        relationshipDecision,
        storedRole: 'BACKGROUND',
        recommendedAction: 'CREATE_NEW_EVENT',
        breakdown,
      };
    }
    const storedRole = decisionToStoredRole(relationshipDecision);
    return {
      kind: 'attach',
      method: 'structured',
      score,
      eventId: input.eventId,
      reason: `auto_${relationshipDecision.toLowerCase()}`,
      relationshipDecision,
      storedRole,
      recommendedAction:
        relationshipDecision === 'NEW_DEVELOPMENT'
          ? 'ATTACH_AND_UPDATE_TIMELINE'
          : relationshipDecision === 'CONFLICTING'
            ? 'ATTACH_AS_CONFLICT'
            : 'ATTACH_AS_SUPPORTING',
      breakdown,
    };
  }

  if (
    score >= CLUSTER_THRESHOLDS.aiBoundaryMin &&
    score < CLUSTER_THRESHOLDS.aiBoundaryMax
  ) {
    if (input.aiDecision) {
      const conf = input.aiDecision.confidence;
      if (conf < CLUSTER_THRESHOLDS.aiMinConfidence) {
        return {
          kind: 'conflict',
          method: 'ai_boundary',
          score,
          eventId: input.eventId,
          reason: 'ai_low_confidence',
          relationshipDecision: input.aiDecision.relationship,
          storedRole: 'CONFLICTING',
          recommendedAction: 'NEEDS_HUMAN_REVIEW',
          breakdown,
          aiConfidence: conf,
        };
      }
      const rel = input.aiDecision.relationship;
      if (rel === 'UNRELATED' || rel === 'RELATED_BUT_DIFFERENT') {
        return {
          kind: 'create',
          method: 'ai_boundary',
          score,
          reason: `ai_${rel.toLowerCase()}`,
          relationshipDecision: rel,
          storedRole: 'BACKGROUND',
          recommendedAction: 'CREATE_NEW_EVENT',
          breakdown,
          aiConfidence: conf,
        };
      }
      return {
        kind: 'attach',
        method: 'ai_boundary',
        score,
        eventId: input.eventId,
        reason: `ai_${rel.toLowerCase()}`,
        relationshipDecision: rel,
        storedRole: decisionToStoredRole(rel),
        recommendedAction:
          input.aiDecision.recommendedAction ??
          (rel === 'NEW_DEVELOPMENT'
            ? 'ATTACH_AND_UPDATE_TIMELINE'
            : 'ATTACH_AS_SUPPORTING'),
        breakdown,
        aiConfidence: conf,
      };
    }

    return {
      kind: 'conflict',
      method: 'structured',
      score,
      eventId: input.eventId,
      reason: 'ai_boundary_pending',
      relationshipDecision: classifyRelationship(input),
      storedRole: 'CONFLICTING',
      recommendedAction: 'NEEDS_HUMAN_REVIEW',
      breakdown,
      needsAiBoundary: true,
    };
  }

  return {
    kind: 'create',
    method: null,
    score,
    reason: 'below_ai_boundary',
    relationshipDecision: 'UNRELATED',
    storedRole: 'BACKGROUND',
    recommendedAction: 'CREATE_NEW_EVENT',
    breakdown,
  };
}

/** Legacy wrapper used by older tests */
export function decideClusterAction(candidates: CandidateScore[]): {
  kind: 'create' | 'merge' | 'conflict' | 'skip';
  method: MatchMethod | null;
  score: number;
  eventId?: string;
  reason: string;
} {
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
  if (score >= CLUSTER_THRESHOLDS.autoMerge && best.withinTimeWindow) {
    return {
      kind: 'merge',
      method: 'embedding',
      score,
      eventId: best.eventId,
      reason: 'legacy_strong',
    };
  }
  if (score >= CLUSTER_THRESHOLDS.aiBoundaryMin && best.withinTimeWindow) {
    return {
      kind: 'conflict',
      method: 'embedding',
      score,
      eventId: best.eventId,
      reason: 'legacy_ambiguous',
    };
  }
  return { kind: 'create', method: null, score, reason: 'legacy_below' };
}

export const THRESHOLDS = {
  titleMerge: 0.86,
  entityMerge: 0.66,
  embeddingMerge: CLUSTER_THRESHOLDS.autoMerge,
  embeddingConflict: CLUSTER_THRESHOLDS.aiBoundaryMin,
  titleConflict: 0.72,
  ...CLUSTER_THRESHOLDS,
} as const;
