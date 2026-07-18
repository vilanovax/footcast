import { NewsCategory } from './enums.js';

/** Stored on NewsEventArticle.role (uppercase). Legacy lowercase mapped via normalizeRole. */
export type EventArticleRelationship =
  | 'PRIMARY'
  | 'SUPPORTING'
  | 'EXACT_DUPLICATE'
  | 'NEAR_DUPLICATE'
  | 'NEW_DEVELOPMENT'
  | 'CONFLICTING'
  | 'BACKGROUND';

/** Decision-level relationship (may map to a stored role). */
export type ClusterRelationshipDecision =
  | 'EXACT_DUPLICATE'
  | 'NEAR_DUPLICATE'
  | 'SAME_EVENT'
  | 'NEW_DEVELOPMENT'
  | 'RELATED_BUT_DIFFERENT'
  | 'UNRELATED'
  | 'CONFLICTING';

export type ClusterRecommendedAction =
  | 'ATTACH_AS_DUPLICATE'
  | 'ATTACH_AS_SUPPORTING'
  | 'ATTACH_AND_UPDATE_TIMELINE'
  | 'ATTACH_AS_CONFLICT'
  | 'CREATE_NEW_EVENT'
  | 'NEEDS_HUMAN_REVIEW';

export const EVENT_ARTICLE_RELATIONSHIPS: EventArticleRelationship[] = [
  'PRIMARY',
  'SUPPORTING',
  'EXACT_DUPLICATE',
  'NEAR_DUPLICATE',
  'NEW_DEVELOPMENT',
  'CONFLICTING',
  'BACKGROUND',
];

/** Roles that count as an independent source for credibility. */
export const INDEPENDENT_SOURCE_ROLES: ReadonlySet<EventArticleRelationship> = new Set([
  'PRIMARY',
  'SUPPORTING',
  'NEW_DEVELOPMENT',
  'CONFLICTING',
]);

export function normalizeEventArticleRole(
  role?: string | null,
): EventArticleRelationship {
  if (!role) return 'SUPPORTING';
  const upper = role.toUpperCase();
  if ((EVENT_ARTICLE_RELATIONSHIPS as string[]).includes(upper)) {
    return upper as EventArticleRelationship;
  }
  switch (role.toLowerCase()) {
    case 'primary':
      return 'PRIMARY';
    case 'duplicate':
      return 'NEAR_DUPLICATE';
    case 'related':
      return 'BACKGROUND';
    default:
      return 'SUPPORTING';
  }
}

export function countsAsIndependentSource(role?: string | null): boolean {
  return INDEPENDENT_SOURCE_ROLES.has(normalizeEventArticleRole(role));
}

/** Transfer / contract lifecycle actions */
export const TRANSFER_ACTIONS = [
  'RUMOR_REPORTED',
  'INTEREST_REPORTED',
  'NEGOTIATION_STARTED',
  'OFFER_SUBMITTED',
  'PERSONAL_TERMS_AGREED',
  'CLUB_AGREEMENT_REACHED',
  'MEDICAL_SCHEDULED',
  'TRANSFER_OFFICIAL',
  'TRANSFER_COLLAPSED',
] as const;

export const INJURY_ACTIONS = [
  'INJURY_REPORTED',
  'INJURY_CONFIRMED',
  'DIAGNOSIS_UPDATED',
  'RETURN_DATE_REPORTED',
  'RETURNED_TO_TRAINING',
] as const;

export const COACH_ACTIONS = [
  'COACH_UNDER_PRESSURE',
  'COACH_DISMISSED',
  'COACH_NEGOTIATION',
  'COACH_APPOINTED',
] as const;

export const MATCH_ACTIONS = [
  'MATCH_PREVIEW',
  'MATCH_KICKOFF',
  'MATCH_RESULT',
  'MATCH_ANALYSIS',
] as const;

export const DISCIPLINARY_ACTIONS = [
  'INCIDENT_REPORTED',
  'CHARGE_FILED',
  'HEARING_SCHEDULED',
  'SANCTION_ANNOUNCED',
] as const;

export type EventAction =
  | (typeof TRANSFER_ACTIONS)[number]
  | (typeof INJURY_ACTIONS)[number]
  | (typeof COACH_ACTIONS)[number]
  | (typeof MATCH_ACTIONS)[number]
  | (typeof DISCIPLINARY_ACTIONS)[number]
  | 'GENERIC_UPDATE'
  | string;

/** Hours lookback for candidate retrieval by category. */
export const CATEGORY_TIME_WINDOWS_HOURS: Record<string, number> = {
  [NewsCategory.MATCH_RESULT]: 24,
  [NewsCategory.MATCH_PREVIEW]: 48,
  [NewsCategory.INJURY]: 14 * 24,
  [NewsCategory.TRANSFER]: 30 * 24,
  [NewsCategory.CONTRACT]: 30 * 24,
  [NewsCategory.COACH_CHANGE]: 21 * 24,
  [NewsCategory.DISCIPLINARY]: 30 * 24,
  [NewsCategory.SUSPENSION]: 30 * 24,
  [NewsCategory.LEGAL]: 90 * 24,
  [NewsCategory.OWNERSHIP]: 90 * 24,
  [NewsCategory.NATIONAL_TEAM]: 14 * 24,
  DEFAULT: 7 * 24,
};

export function categoryTimeWindowHours(category?: string | null): number {
  if (!category) return CATEGORY_TIME_WINDOWS_HOURS.DEFAULT!;
  return (
    CATEGORY_TIME_WINDOWS_HOURS[category] ?? CATEGORY_TIME_WINDOWS_HOURS.DEFAULT!
  );
}

/** Versioned clustering policy — bump version when thresholds/weights change. */
export const CLUSTERING_POLICY = {
  version: '2.1.0',
  autoMergeThreshold: 0.9,
  aiBoundaryMin: 0.74,
  aiBoundaryMax: 0.9,
  nearDuplicateMin: 0.92,
  aiMinConfidence: 0.8,
  maxCandidates: 80,
  weights: {
    entity: 0.3,
    eventType: 0.15,
    action: 0.15,
    semantic: 0.2,
    title: 0.1,
    time: 0.1,
  },
  timeWindows: CATEGORY_TIME_WINDOWS_HOURS,
  targets: {
    exactDuplicateRecall: 0.95,
    nearDuplicateRecall: 0.9,
    sameEventRecall: 0.85,
    newDevelopmentRecall: 0.8,
    falseMergeRateMax: 0.03,
  },
} as const;

/** @deprecated use CLUSTERING_POLICY */
export const CLUSTER_THRESHOLDS = {
  autoMerge: CLUSTERING_POLICY.autoMergeThreshold,
  aiBoundaryMin: CLUSTERING_POLICY.aiBoundaryMin,
  aiBoundaryMax: CLUSTERING_POLICY.aiBoundaryMax,
  nearDuplicateMin: CLUSTERING_POLICY.nearDuplicateMin,
  exactContentHash: 1,
  aiMinConfidence: CLUSTERING_POLICY.aiMinConfidence,
  maxCandidates: CLUSTERING_POLICY.maxCandidates,
} as const;

/** @deprecated use CLUSTERING_POLICY.weights */
export const SIMILARITY_WEIGHTS = CLUSTERING_POLICY.weights;

export type EvaluationVerdict =
  | 'CORRECT'
  | 'WRONG_MERGE'
  | 'MISSED_MERGE'
  | 'WRONG_RELATIONSHIP'
  | 'UNCERTAIN';

export type EvaluationExpectedRelationship =
  | 'EXACT_DUPLICATE'
  | 'NEAR_DUPLICATE'
  | 'SAME_EVENT'
  | 'NEW_DEVELOPMENT'
  | 'RELATED_BUT_DIFFERENT'
  | 'UNRELATED';

/** Higher index = later / stronger in lifecycle (same family). */
export const ACTION_ORDER: Record<string, number> = {
  RUMOR_REPORTED: 10,
  INTEREST_REPORTED: 20,
  NEGOTIATION_STARTED: 30,
  OFFER_SUBMITTED: 40,
  PERSONAL_TERMS_AGREED: 50,
  CLUB_AGREEMENT_REACHED: 60,
  MEDICAL_SCHEDULED: 70,
  TRANSFER_OFFICIAL: 90,
  TRANSFER_COLLAPSED: 85,
  INJURY_REPORTED: 10,
  INJURY_CONFIRMED: 30,
  DIAGNOSIS_UPDATED: 50,
  RETURN_DATE_REPORTED: 60,
  RETURNED_TO_TRAINING: 80,
  COACH_UNDER_PRESSURE: 10,
  COACH_DISMISSED: 40,
  COACH_NEGOTIATION: 50,
  COACH_APPOINTED: 80,
  MATCH_PREVIEW: 10,
  MATCH_KICKOFF: 40,
  MATCH_RESULT: 70,
  MATCH_ANALYSIS: 80,
  INCIDENT_REPORTED: 10,
  CHARGE_FILED: 40,
  HEARING_SCHEDULED: 60,
  SANCTION_ANNOUNCED: 80,
  GENERIC_UPDATE: 50,
};

export function actionOrder(action?: string | null): number {
  if (!action) return 0;
  return ACTION_ORDER[action] ?? 0;
}

export function isActionProgression(
  previous?: string | null,
  next?: string | null,
): boolean {
  const a = actionOrder(previous);
  const b = actionOrder(next);
  return b > a && a > 0 && b > 0;
}

export function decisionToStoredRole(
  decision: ClusterRelationshipDecision,
  opts?: { isFirstArticle?: boolean },
): EventArticleRelationship {
  switch (decision) {
    case 'EXACT_DUPLICATE':
      return 'EXACT_DUPLICATE';
    case 'NEAR_DUPLICATE':
      return 'NEAR_DUPLICATE';
    case 'NEW_DEVELOPMENT':
      return 'NEW_DEVELOPMENT';
    case 'CONFLICTING':
      return 'CONFLICTING';
    case 'SAME_EVENT':
      return opts?.isFirstArticle ? 'PRIMARY' : 'SUPPORTING';
    case 'RELATED_BUT_DIFFERENT':
      return 'BACKGROUND';
    case 'UNRELATED':
    default:
      return 'BACKGROUND';
  }
}

export type EventSignature = {
  eventType: string;
  action: string | null;
  primaryEntities: string[];
  secondaryEntities: string[];
  competitionId?: string | null;
  matchId?: string | null;
  occurredAt?: string | null;
};
