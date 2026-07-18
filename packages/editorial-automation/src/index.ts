export { evaluateAutomationPolicy } from './evaluate.js';
export {
  collectAutoAddBlockers,
  collectSuggestBlockers,
  hasCoverageCapacityPressure,
  isTerminalEventStatus,
} from './guards.js';
export { isHighlightWorthy, resolveHighlightBadge } from './highlight.js';
export { ruleAuditAutoAdd } from './rule-audit.js';
export type { RuleAuditResult, RuleAuditVerdict } from './rule-audit.js';
export { applyAiAuditGate } from './ai-audit-gate.js';
export type {
  AiAuditGateInput,
  AiAuditGateResult,
  AiAuditVerdict,
} from './ai-audit-gate.js';
export {
  buildCoverageSnapshot,
  buildScoreSnapshot,
  effectiveScore,
} from './snapshot.js';
export type {
  AutomationDecisionDraft,
  AutomationEventInput,
  AutomationReplaceCandidate,
  AutomationRundownContext,
  EvaluateAutomationInput,
  EvaluateAutomationResult,
  HighlightBadge,
} from './types.js';
