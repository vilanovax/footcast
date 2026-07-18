import { AutomationDecisionType } from '@footcast/shared';
import {
  collectAutoAddBlockers,
  collectSuggestBlockers,
  hasCoverageCapacityPressure,
  isTerminalEventStatus,
} from './guards.js';
import { isHighlightWorthy, resolveHighlightBadge } from './highlight.js';
import {
  buildCoverageSnapshot,
  buildScoreSnapshot,
  effectiveScore,
} from './snapshot.js';
import type {
  AutomationDecisionDraft,
  AutomationReplaceCandidate,
  EvaluateAutomationInput,
  EvaluateAutomationResult,
} from './types.js';

function pickReplaceTarget(
  eventScore: number,
  candidates: AutomationReplaceCandidate[] | undefined,
): string | undefined {
  if (!candidates?.length) return undefined;
  let weakest: { newsEventId: string; score: number } | null = null;
  for (const c of candidates) {
    const s = c.effectiveScore ?? 0;
    if (s >= eventScore) continue;
    if (!weakest || s < weakest.score) {
      weakest = { newsEventId: c.newsEventId, score: s };
    }
  }
  return weakest?.newsEventId;
}

/**
 * Pure Policy Engine (ADR-007). No I/O — caller persists decisions / executes AUTO_ADD.
 */
export function evaluateAutomationPolicy(
  input: EvaluateAutomationInput,
): EvaluateAutomationResult {
  const { config, event, rundown } = input;
  const scoreSnapshot = buildScoreSnapshot(event);
  const coverageSnapshot = buildCoverageSnapshot(rundown);
  const decisions: AutomationDecisionDraft[] = [];

  if (isTerminalEventStatus(event.status)) {
    decisions.push({
      decisionType: AutomationDecisionType.HOLD,
      reasons: [],
      blockedReasons: [`status:${event.status}`],
      shouldExecute: false,
      scoreSnapshot,
      coverageSnapshot,
    });
    return {
      decisions,
      highlight: null,
      suggest: null,
      autoAdd: null,
    };
  }

  let highlight: EvaluateAutomationResult['highlight'] = null;
  if (config.autoHighlightImportant) {
    const resolved = resolveHighlightBadge(event, config);
    if (isHighlightWorthy(resolved.badge)) {
      highlight = resolved;
      decisions.push({
        decisionType: AutomationDecisionType.HIGHLIGHT,
        reasons: resolved.reasons,
        blockedReasons: [],
        shouldExecute: false,
        scoreSnapshot,
        coverageSnapshot,
        highlightBadge: resolved.badge,
      });
    }
  }

  let suggest: EvaluateAutomationResult['suggest'] = null;
  if (config.autoSuggestForRundown) {
    const suggestBlocked = collectSuggestBlockers(event, rundown, config);
    const capacityPressure = hasCoverageCapacityPressure(event, rundown, config);
    const softOkForReplace =
      !event.isExactOrNearDuplicate &&
      !rundown.locked &&
      !rundown.existingEventIds.includes(event.newsEventId) &&
      effectiveScore(event) >= config.suggestMinScore &&
      (event.credibilityScore ?? 0) >= config.suggestMinCredibility;

    if (
      config.autoReplaceLowerUtilityItem &&
      capacityPressure &&
      softOkForReplace
    ) {
      const target = pickReplaceTarget(
        effectiveScore(event),
        rundown.replaceCandidates,
      );
      if (target) {
        suggest = {
          kind: 'REPLACE',
          reasons: [
            `score:${effectiveScore(event)}`,
            `replace_weaker:${target}`,
            'coverage_capacity_pressure',
            'advisory_only_v1',
          ],
          replaceTargetEventId: target,
        };
        decisions.push({
          decisionType: AutomationDecisionType.SUGGEST_REPLACE,
          reasons: suggest.reasons,
          blockedReasons: [],
          shouldExecute: false,
          scoreSnapshot,
          coverageSnapshot,
          replaceTargetEventId: target,
        });
      }
    }

    if (!suggest && suggestBlocked.length === 0) {
      suggest = {
        kind: 'ADD',
        reasons: [
          `score:${effectiveScore(event)}`,
          `credibility:${event.credibilityScore ?? 0}`,
          ...(event.recommendation
            ? [`recommendation:${event.recommendation}`]
            : []),
        ],
      };
      decisions.push({
        decisionType: AutomationDecisionType.SUGGEST_ADD,
        reasons: suggest.reasons,
        blockedReasons: [],
        shouldExecute: false,
        scoreSnapshot,
        coverageSnapshot,
      });
    }
  }

  let autoAdd: EvaluateAutomationResult['autoAdd'] = null;
  if (config.autoAddToRundown) {
    const blockedReasons = collectAutoAddBlockers(event, rundown, config);
    const reasons = [
      `score:${effectiveScore(event)}`,
      `credibility:${event.credibilityScore ?? 0}`,
      `official:${event.officialStatus ?? 'UNVERIFIED'}`,
    ];
    if (blockedReasons.length === 0) {
      const reviewStatus = config.requireEditorAckOnAutoAdd
        ? 'PENDING_REVIEW'
        : 'ACCEPTED';
      autoAdd = {
        allowed: true,
        reasons,
        blockedReasons: [],
        reviewStatus,
      };
      decisions.push({
        decisionType: AutomationDecisionType.AUTO_ADD,
        reasons,
        blockedReasons: [],
        shouldExecute: true,
        scoreSnapshot,
        coverageSnapshot,
      });
    } else {
      autoAdd = {
        allowed: false,
        reasons,
        blockedReasons,
        reviewStatus: 'PENDING_REVIEW',
      };
      decisions.push({
        decisionType: AutomationDecisionType.HOLD,
        reasons,
        blockedReasons,
        shouldExecute: false,
        scoreSnapshot,
        coverageSnapshot,
      });
    }
  }

  return { decisions, highlight, suggest, autoAdd };
}
