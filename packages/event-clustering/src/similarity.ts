import {
  SIMILARITY_WEIGHTS,
  actionOrder,
  categoryTimeWindowHours,
  type EventSignature,
} from '@footcast/shared';
import { entityOverlap, normalizeForMatch, titleSimilarity, tokenize } from './normalize.js';
import { cosineSimilarity } from './embedding.js';

export type SimilarityBreakdown = {
  entitySimilarity: number;
  eventTypeSimilarity: number;
  actionCompatibility: number;
  semanticSimilarity: number;
  titleSimilarity: number;
  timeSimilarity: number;
  eventSimilarity: number;
  sharedPrimaryEntities: string[];
  sameMatchId: boolean;
  withinCategoryWindow: boolean;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function eventTypeSimilarity(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0.4;
  if (a === b) return 1;
  const compatible: Record<string, string[]> = {
    TRANSFER: ['CONTRACT'],
    CONTRACT: ['TRANSFER'],
    MATCH_RESULT: ['MATCH_PREVIEW'],
    MATCH_PREVIEW: ['MATCH_RESULT'],
    DISCIPLINARY: ['SUSPENSION', 'LEGAL'],
    SUSPENSION: ['DISCIPLINARY'],
    LEGAL: ['DISCIPLINARY', 'OWNERSHIP'],
  };
  if ((compatible[a] ?? []).includes(b)) return 0.7;
  return 0.1;
}

export function actionCompatibility(
  a?: string | null,
  b?: string | null,
): { score: number; isProgression: boolean; sameFamily: boolean } {
  if (!a || !b) return { score: 0.55, isProgression: false, sameFamily: false };
  if (a === b) return { score: 1, isProgression: false, sameFamily: true };
  const oa = actionOrder(a);
  const ob = actionOrder(b);
  const sameFamily = oa > 0 && ob > 0 && Math.floor(oa / 100) === Math.floor(ob / 100);
  // Same lifecycle family by prefix heuristic
  const prefixA = a.split('_')[0] ?? '';
  const prefixB = b.split('_')[0] ?? '';
  const family =
    sameFamily ||
    prefixA === prefixB ||
    (['RUMOR', 'INTEREST', 'NEGOTIATION', 'OFFER', 'PERSONAL', 'CLUB', 'MEDICAL', 'TRANSFER'].some(
      (p) => a.startsWith(p),
    ) &&
      ['RUMOR', 'INTEREST', 'NEGOTIATION', 'OFFER', 'PERSONAL', 'CLUB', 'MEDICAL', 'TRANSFER'].some(
        (p) => b.startsWith(p),
      ));
  if (!family) return { score: 0.15, isProgression: false, sameFamily: false };
  const diff = Math.abs(oa - ob);
  const isProgression = ob > oa;
  if (diff === 0) return { score: 1, isProgression: false, sameFamily: true };
  if (diff <= 20) return { score: 0.9, isProgression, sameFamily: true };
  if (diff <= 40) return { score: 0.8, isProgression, sameFamily: true };
  return { score: 0.65, isProgression, sameFamily: true };
}

export function timeSimilarity(
  a?: string | Date | null,
  b?: string | Date | null,
  windowHours?: number,
): number {
  if (!a || !b) return 0.6;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0.6;
  const hours = Math.abs(ta - tb) / 3_600_000;
  const window = windowHours ?? 168;
  if (hours <= window * 0.1) return 1;
  if (hours <= window * 0.5) return 0.85;
  if (hours <= window) return 0.65;
  if (hours <= window * 1.5) return 0.35;
  return 0.1;
}

export function claimOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const left = a.map((x) => new Set(tokenize(x)));
  const right = b.map((x) => new Set(tokenize(x)));
  let best = 0;
  for (const l of left) {
    for (const r of right) {
      if (l.size === 0 || r.size === 0) continue;
      let hit = 0;
      for (const t of l) if (r.has(t)) hit += 1;
      const score = hit / Math.min(l.size, r.size);
      if (score > best) best = score;
    }
  }
  return clamp01(best);
}

export function primaryEntityOverlap(
  a: EventSignature,
  b: EventSignature,
): { score: number; shared: string[] } {
  const left = new Set(a.primaryEntities.map(normalizeForMatch).filter(Boolean));
  const right = new Set(b.primaryEntities.map(normalizeForMatch).filter(Boolean));
  const shared: string[] = [];
  for (const v of left) if (right.has(v)) shared.push(v);
  // Weight primary higher; blend with secondary lightly
  const primaryScore =
    left.size === 0 || right.size === 0
      ? 0
      : shared.length / Math.min(left.size, right.size);
  const secondary = entityOverlap(a.secondaryEntities, b.secondaryEntities);
  const score = clamp01(primaryScore * 0.85 + secondary * 0.15);
  return { score, shared };
}

export function computeEventSimilarity(input: {
  incoming: EventSignature;
  candidate: EventSignature;
  titleA: string;
  titleB: string;
  embeddingA: number[];
  embeddingB: number[];
  claimsA?: string[];
  claimsB?: string[];
}): SimilarityBreakdown {
  const windowHours = categoryTimeWindowHours(input.incoming.eventType);
  const entities = primaryEntityOverlap(input.incoming, input.candidate);
  const typeScore = eventTypeSimilarity(
    input.incoming.eventType,
    input.candidate.eventType,
  );
  const action = actionCompatibility(input.incoming.action, input.candidate.action);
  const semantic = clamp01(cosineSimilarity(input.embeddingA, input.embeddingB));
  const title = titleSimilarity(input.titleA, input.titleB);
  const time = timeSimilarity(
    input.incoming.occurredAt,
    input.candidate.occurredAt,
    windowHours,
  );
  const sameMatchId = Boolean(
    input.incoming.matchId &&
      input.candidate.matchId &&
      input.incoming.matchId === input.candidate.matchId,
  );

  let eventSimilarity =
    entities.score * SIMILARITY_WEIGHTS.entity +
    typeScore * SIMILARITY_WEIGHTS.eventType +
    action.score * SIMILARITY_WEIGHTS.action +
    semantic * SIMILARITY_WEIGHTS.semantic +
    title * SIMILARITY_WEIGHTS.title +
    time * SIMILARITY_WEIGHTS.time;

  if (sameMatchId) eventSimilarity = Math.max(eventSimilarity, 0.93);

  const claim = claimOverlap(input.claimsA ?? [], input.claimsB ?? []);
  if (claim >= 0.85) eventSimilarity = Math.max(eventSimilarity, eventSimilarity * 0.9 + 0.1);

  const withinCategoryWindow = time >= 0.35;

  return {
    entitySimilarity: entities.score,
    eventTypeSimilarity: typeScore,
    actionCompatibility: action.score,
    semanticSimilarity: semantic,
    titleSimilarity: title,
    timeSimilarity: time,
    eventSimilarity: clamp01(eventSimilarity),
    sharedPrimaryEntities: entities.shared,
    sameMatchId,
    withinCategoryWindow,
  };
}

export function sharesPrimaryEntity(a: EventSignature, b: EventSignature): boolean {
  return primaryEntityOverlap(a, b).shared.length > 0;
}
