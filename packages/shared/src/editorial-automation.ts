/**
 * Auto Editorial Selection — policy config & decision types (ADR-007).
 * Engine execution lands in a later package; this module is the contract.
 */

import type { AutomationDecisionType } from './enums.js';

export type AutomationProfileMode = 'MANUAL' | 'ASSISTED' | 'CONTROLLED_AUTO';

export type OfficialStatusForAuto =
  | 'OFFICIAL'
  | 'CONFIRMED'
  | 'RELIABLE_REPORT'
  | 'MULTI_SOURCE_REPORT'
  | 'UNVERIFIED'
  | 'RUMOR'
  | 'DISPUTED'
  | 'FALSE';

/** Stored in AppSetting `control.editorial.automation`. */
export type EditorialAutomationConfig = {
  version: string;
  profileMode: AutomationProfileMode;

  autoHighlightImportant: boolean;
  autoSuggestForRundown: boolean;
  autoAddToRundown: boolean;
  /** v1: suggestion only — never execute remove */
  autoRemoveLowPriority: boolean;
  /** v1: suggestion only — never execute replace */
  autoReplaceLowerUtilityItem: boolean;

  importantHighlightMinScore: number;
  importantHighlightMinCredibility: number;

  suggestMinScore: number;
  suggestMinCredibility: number;

  autoAddMinScore: number;
  autoAddMinCredibility: number;

  allowedOfficialStatuses: OfficialStatusForAuto[];
  allowedSourceTypes: string[];
  minimumSourceCredibility: number;
  minimumIndependentSources: number;
  allowSingleSourceOfficial: boolean;
  allowRumorAutoAdd: boolean;
  blockOnConflict: boolean;

  maxAutoAddedItems: number;
  maxItemsPerTeam: number;
  maxItemsPerCompetition: number;
  maxItemsPerCategory: number;
  stopAutoAddBeforeDeadlineMinutes: number;

  /** When true, Auto Add items start as PENDING_REVIEW on the rundown item */
  requireEditorAckOnAutoAdd: boolean;

  /** Deterministic rule audit before AUTO_ADD execute */
  requireRuleAuditOnAutoAdd: boolean;
  /**
   * When Rule Audit returns NEEDS_AI_AUDIT:
   * call AI auditor; only PASS + confidence ≥ aiAuditMinConfidence executes.
   */
  requireAiAuditOnSensitiveAutoAdd: boolean;
  /** Minimum AI auditor confidence (0–1) to allow AUTO_ADD after PASS */
  aiAuditMinConfidence: number;
};

export const DEFAULT_EDITORIAL_AUTOMATION: EditorialAutomationConfig = {
  version: '1.0.0',
  profileMode: 'ASSISTED',

  autoHighlightImportant: true,
  autoSuggestForRundown: true,
  autoAddToRundown: false,
  autoRemoveLowPriority: false,
  autoReplaceLowerUtilityItem: false,

  importantHighlightMinScore: 72,
  importantHighlightMinCredibility: 60,

  suggestMinScore: 68,
  suggestMinCredibility: 58,

  autoAddMinScore: 85,
  autoAddMinCredibility: 80,

  allowedOfficialStatuses: [
    'OFFICIAL',
    'CONFIRMED',
    'RELIABLE_REPORT',
    'MULTI_SOURCE_REPORT',
  ],
  allowedSourceTypes: [],
  minimumSourceCredibility: 80,
  minimumIndependentSources: 1,
  allowSingleSourceOfficial: true,
  allowRumorAutoAdd: false,
  blockOnConflict: true,

  maxAutoAddedItems: 6,
  maxItemsPerTeam: 3,
  maxItemsPerCompetition: 4,
  maxItemsPerCategory: 5,
  stopAutoAddBeforeDeadlineMinutes: 30,

  requireEditorAckOnAutoAdd: true,

  requireRuleAuditOnAutoAdd: true,
  requireAiAuditOnSensitiveAutoAdd: true,
  aiAuditMinConfidence: 0.62,
};

export const AUTOMATION_PROFILE_PRESETS: Record<
  AutomationProfileMode,
  Pick<
    EditorialAutomationConfig,
    | 'profileMode'
    | 'autoHighlightImportant'
    | 'autoSuggestForRundown'
    | 'autoAddToRundown'
    | 'autoRemoveLowPriority'
    | 'autoReplaceLowerUtilityItem'
  >
> = {
  MANUAL: {
    profileMode: 'MANUAL',
    autoHighlightImportant: true,
    autoSuggestForRundown: false,
    autoAddToRundown: false,
    autoRemoveLowPriority: false,
    autoReplaceLowerUtilityItem: false,
  },
  ASSISTED: {
    profileMode: 'ASSISTED',
    autoHighlightImportant: true,
    autoSuggestForRundown: true,
    autoAddToRundown: false,
    autoRemoveLowPriority: false,
    autoReplaceLowerUtilityItem: false,
  },
  CONTROLLED_AUTO: {
    profileMode: 'CONTROLLED_AUTO',
    autoHighlightImportant: true,
    autoSuggestForRundown: true,
    autoAddToRundown: true,
    autoRemoveLowPriority: false,
    autoReplaceLowerUtilityItem: false,
  },
};

export function applyAutomationProfile(
  base: EditorialAutomationConfig,
  mode: AutomationProfileMode,
): EditorialAutomationConfig {
  return {
    ...base,
    ...AUTOMATION_PROFILE_PRESETS[mode],
  };
}

export type AutomationScoreSnapshot = {
  finalScore: number | null;
  credibilityScore: number | null;
  importanceScore: number | null;
  podcastValueScore: number | null;
  recommendation: string | null;
  officialStatus: string | null;
  independentSourceCount: number | null;
  effectiveFinalScore: number | null;
};

export type AutomationCoverageSnapshot = {
  editorialDate?: string;
  selectedCount?: number;
  durationSeconds?: number;
  teamCounts?: Record<string, number>;
  competitionCounts?: Record<string, number>;
  categoryCounts?: Record<string, number>;
};

/** Shape persisted in editorial_automation_decisions (engine writes later). */
export type EditorialAutomationDecisionRecord = {
  id: string;
  newsEventId: string;
  rundownId: string | null;
  rundownItemId: string | null;
  decisionType: AutomationDecisionType | string;
  policyVersion: string;
  profileMode: AutomationProfileMode;
  scoreSnapshot: AutomationScoreSnapshot | null;
  coverageSnapshot: AutomationCoverageSnapshot | null;
  reasons: string[];
  blockedReasons: string[];
  executed: boolean;
  executedAt: string | null;
  revertedAt: string | null;
  revertedBy: string | null;
  createdAt: string;
};
