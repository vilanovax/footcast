import { CLUSTER_THRESHOLDS } from '@footcast/shared';
import { contentFingerprint, titleSimilarity } from './normalize.js';
import { claimOverlap } from './similarity.js';

export function isNearDuplicate(input: {
  titleA: string;
  titleB: string;
  contentPartsA: string[];
  contentPartsB: string[];
  claimsA: string[];
  claimsB: string[];
  entityOverlap: number;
}): { isNear: boolean; score: number } {
  const title = titleSimilarity(input.titleA, input.titleB);
  const fpA = contentFingerprint(input.contentPartsA);
  const fpB = contentFingerprint(input.contentPartsB);
  const sameFp = fpA === fpB;
  const claims = claimOverlap(input.claimsA, input.claimsB);
  const score = sameFp
    ? 1
    : title * 0.45 + claims * 0.35 + input.entityOverlap * 0.2;
  return {
    isNear: sameFp || score >= CLUSTER_THRESHOLDS.nearDuplicateMin,
    score,
  };
}

export function isExactDuplicate(input: {
  contentHashMatch: boolean;
  urlHashMatch?: boolean;
  fingerprintMatch?: boolean;
}): boolean {
  return Boolean(input.contentHashMatch || input.urlHashMatch || input.fingerprintMatch);
}
