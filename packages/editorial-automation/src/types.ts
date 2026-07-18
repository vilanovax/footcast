import type {
  AutomationCoverageSnapshot,
  AutomationDecisionType,
  AutomationScoreSnapshot,
  EditorialAutomationConfig,
} from '@footcast/shared';

export type HighlightBadge =
  | 'LEAD'
  | 'IMPORTANT'
  | 'RUNDOWN_CANDIDATE'
  | 'NEEDS_REVIEW'
  | 'LOW_PRIORITY'
  | 'NONE';

export type AutomationEventInput = {
  newsEventId: string;
  status: string;
  finalScore: number | null;
  effectiveFinalScore: number | null;
  credibilityScore: number | null;
  importanceScore: number | null;
  podcastValueScore: number | null;
  recommendation: string | null;
  officialStatus: string | null;
  category: string | null;
  independentSourceCount: number;
  maxSourceCredibility: number;
  sourceTypes: string[];
  hasMajorConflict: boolean;
  isExactOrNearDuplicate: boolean;
  teamKeys: string[];
  competitionKeys: string[];
  estimatedDurationSeconds: number;
};

export type AutomationReplaceCandidate = {
  newsEventId: string;
  effectiveScore: number | null;
  teamKeys: string[];
  category: string | null;
};

export type AutomationRundownContext = {
  rundownId: string | null;
  editorialDate?: string;
  locked: boolean;
  minutesUntilLock: number | null;
  existingEventIds: string[];
  /** Count of items already added with addedMode=AUTO today */
  autoAddedCount: number;
  teamCounts: Record<string, number>;
  competitionCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  durationSeconds: number;
  maxEpisodeDurationSeconds?: number;
  /** When coverage is full, weakest items for SUGGEST_REPLACE only */
  replaceCandidates?: AutomationReplaceCandidate[];
  /** Idempotency: AUTO_ADD already executed for this event+rundown */
  priorAutoAddExecuted?: boolean;
};

export type AutomationDecisionDraft = {
  decisionType: AutomationDecisionType;
  reasons: string[];
  blockedReasons: string[];
  /** Only AUTO_ADD sets true when guards pass and config allows execute */
  shouldExecute: boolean;
  scoreSnapshot: AutomationScoreSnapshot;
  coverageSnapshot: AutomationCoverageSnapshot | null;
  highlightBadge?: HighlightBadge;
  replaceTargetEventId?: string;
};

export type EvaluateAutomationInput = {
  config: EditorialAutomationConfig;
  event: AutomationEventInput;
  rundown: AutomationRundownContext;
};

export type EvaluateAutomationResult = {
  decisions: AutomationDecisionDraft[];
  highlight: {
    badge: HighlightBadge;
    reasons: string[];
  } | null;
  suggest: {
    kind: 'ADD' | 'REPLACE';
    reasons: string[];
    replaceTargetEventId?: string;
  } | null;
  autoAdd: {
    allowed: boolean;
    reasons: string[];
    blockedReasons: string[];
    reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED';
  } | null;
};
