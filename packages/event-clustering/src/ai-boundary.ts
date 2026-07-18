import {
  CLUSTER_THRESHOLDS,
  type ClusterRecommendedAction,
  type ClusterRelationshipDecision,
  type EventSignature,
} from '@footcast/shared';
import { isActionProgression } from '@footcast/shared';
import type { SimilarityBreakdown } from './similarity.js';

export type AiBoundaryInput = {
  incoming: EventSignature;
  candidate: EventSignature;
  incomingHeadline: string;
  incomingSummary: string;
  candidateHeadline: string;
  candidateSummary: string;
  incomingClaims: string[];
  candidateClaims: string[];
  latestTimelineSummaries: string[];
  breakdown: SimilarityBreakdown;
};

export type AiBoundaryResult = {
  relationship: ClusterRelationshipDecision;
  confidence: number;
  newClaims: string[];
  duplicateClaims: string[];
  conflicts: Array<{ field: string; a: string; b: string }>;
  reason: string;
  recommendedAction: ClusterRecommendedAction;
};

export interface ClusterAiJudge {
  readonly name: string;
  readonly model: string;
  judge(input: AiBoundaryInput): Promise<AiBoundaryResult>;
}

const RELATIONSHIPS: ClusterRelationshipDecision[] = [
  'EXACT_DUPLICATE',
  'NEAR_DUPLICATE',
  'SAME_EVENT',
  'NEW_DEVELOPMENT',
  'RELATED_BUT_DIFFERENT',
  'UNRELATED',
  'CONFLICTING',
];

const ACTIONS: ClusterRecommendedAction[] = [
  'ATTACH_AS_DUPLICATE',
  'ATTACH_AS_SUPPORTING',
  'ATTACH_AND_UPDATE_TIMELINE',
  'ATTACH_AS_CONFLICT',
  'CREATE_NEW_EVENT',
  'NEEDS_HUMAN_REVIEW',
];

export function validateAiBoundaryResult(raw: unknown): AiBoundaryResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const relationship = String(o.relationship ?? '') as ClusterRelationshipDecision;
  const recommendedAction = String(
    o.recommendedAction ?? '',
  ) as ClusterRecommendedAction;
  const confidence = Number(o.confidence);
  if (!RELATIONSHIPS.includes(relationship)) return null;
  if (!ACTIONS.includes(recommendedAction)) return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  return {
    relationship,
    confidence,
    newClaims: Array.isArray(o.newClaims) ? o.newClaims.map(String) : [],
    duplicateClaims: Array.isArray(o.duplicateClaims)
      ? o.duplicateClaims.map(String)
      : [],
    conflicts: Array.isArray(o.conflicts)
      ? (o.conflicts as Array<{ field: string; a: string; b: string }>)
      : [],
    reason: String(o.reason ?? 'ai'),
    recommendedAction,
  };
}

/**
 * Deterministic mock judge for tests/dev.
 * Prefer create / human review over risky merge (false-merge aversion).
 */
export class MockClusterAiJudge implements ClusterAiJudge {
  readonly name = 'mock';
  readonly model = 'MockClusterAiJudge';

  async judge(input: AiBoundaryInput): Promise<AiBoundaryResult> {
    const { breakdown, incoming, candidate } = input;
    const progression = isActionProgression(candidate.action, incoming.action);

    if (breakdown.sameMatchId && breakdown.eventTypeSimilarity >= 0.7) {
      return {
        relationship: progression ? 'NEW_DEVELOPMENT' : 'SAME_EVENT',
        confidence: 0.88,
        newClaims: progression ? input.incomingClaims.slice(0, 2) : [],
        duplicateClaims: [],
        conflicts: [],
        reason: 'same_match_id',
        recommendedAction: progression
          ? 'ATTACH_AND_UPDATE_TIMELINE'
          : 'ATTACH_AS_SUPPORTING',
      };
    }

    if (
      breakdown.sharedPrimaryEntities.length > 0 &&
      progression &&
      breakdown.eventSimilarity >= CLUSTER_THRESHOLDS.aiBoundaryMin
    ) {
      return {
        relationship: 'NEW_DEVELOPMENT',
        confidence: 0.86,
        newClaims: input.incomingClaims.slice(0, 3),
        duplicateClaims: [],
        conflicts: [],
        reason: 'action_progression_with_shared_entities',
        recommendedAction: 'ATTACH_AND_UPDATE_TIMELINE',
      };
    }

    if (
      breakdown.sharedPrimaryEntities.length > 0 &&
      breakdown.eventTypeSimilarity >= 0.7 &&
      breakdown.eventSimilarity >= 0.8
    ) {
      return {
        relationship: 'SAME_EVENT',
        confidence: 0.82,
        newClaims: [],
        duplicateClaims: input.incomingClaims.slice(0, 1),
        conflicts: [],
        reason: 'shared_entities_same_type',
        recommendedAction: 'ATTACH_AS_SUPPORTING',
      };
    }

    if (
      breakdown.sharedPrimaryEntities.length > 0 &&
      breakdown.eventTypeSimilarity < 0.5
    ) {
      return {
        relationship: 'RELATED_BUT_DIFFERENT',
        confidence: 0.78,
        newClaims: [],
        duplicateClaims: [],
        conflicts: [],
        reason: 'shared_entity_different_event_type',
        recommendedAction: 'CREATE_NEW_EVENT',
      };
    }

    return {
      relationship: 'UNRELATED',
      confidence: 0.55,
      newClaims: [],
      duplicateClaims: [],
      conflicts: [],
      reason: 'mock_uncertain_prefer_create',
      recommendedAction: 'CREATE_NEW_EVENT',
    };
  }
}

/**
 * Real HTTP JSON judge (OpenAI-compatible chat completions).
 * Production use must be gated by CLUSTER_AI_JUDGE_ENABLED.
 */
export class HttpClusterAiJudge implements ClusterAiJudge {
  readonly name: string;
  readonly model: string;

  constructor(
    private readonly opts: {
      apiKey: string;
      baseUrl?: string;
      model?: string;
      providerName?: string;
    },
  ) {
    this.name = opts.providerName ?? 'openai';
    this.model = opts.model ?? 'gpt-4o-mini';
  }

  async judge(input: AiBoundaryInput): Promise<AiBoundaryResult> {
    const base = (this.opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const body = {
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a football news event-boundary judge. Reply JSON only with keys: relationship, confidence, newClaims, duplicateClaims, conflicts, reason, recommendedAction.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            incomingHeadline: input.incomingHeadline,
            candidateHeadline: input.candidateHeadline,
            incomingSummary: input.incomingSummary,
            candidateSummary: input.candidateSummary,
            incoming: input.incoming,
            candidate: input.candidate,
            claims: {
              incoming: input.incomingClaims,
              candidate: input.candidateClaims,
            },
            timeline: input.latestTimelineSummaries,
            breakdown: input.breakdown,
            allowedRelationships: RELATIONSHIPS,
            allowedActions: ACTIONS,
          }),
        },
      ],
    };

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`AI judge HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI judge empty response');
    const parsed = JSON.parse(content) as unknown;
    const validated = validateAiBoundaryResult(parsed);
    if (!validated) throw new Error('AI judge schema invalid');
    return validated;
  }
}

export function createDefaultClusterAiJudge(): ClusterAiJudge {
  return new MockClusterAiJudge();
}

export function createClusterAiJudge(opts?: {
  enabled?: boolean;
  apiKey?: string | null;
  baseUrl?: string;
  model?: string;
}): ClusterAiJudge {
  if (opts?.enabled && opts.apiKey) {
    return new HttpClusterAiJudge({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      model: opts.model,
    });
  }
  return new MockClusterAiJudge();
}
