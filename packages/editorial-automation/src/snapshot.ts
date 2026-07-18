import type { AutomationCoverageSnapshot, AutomationScoreSnapshot } from '@footcast/shared';
import type { AutomationEventInput, AutomationRundownContext } from './types.js';

export function buildScoreSnapshot(event: AutomationEventInput): AutomationScoreSnapshot {
  return {
    finalScore: event.finalScore,
    credibilityScore: event.credibilityScore,
    importanceScore: event.importanceScore,
    podcastValueScore: event.podcastValueScore,
    recommendation: event.recommendation,
    officialStatus: event.officialStatus,
    independentSourceCount: event.independentSourceCount,
    effectiveFinalScore: event.effectiveFinalScore,
  };
}

export function buildCoverageSnapshot(
  rundown: AutomationRundownContext,
): AutomationCoverageSnapshot {
  return {
    editorialDate: rundown.editorialDate,
    selectedCount: rundown.existingEventIds.length,
    durationSeconds: rundown.durationSeconds,
    teamCounts: rundown.teamCounts,
    competitionCounts: rundown.competitionCounts,
    categoryCounts: rundown.categoryCounts,
  };
}

export function effectiveScore(event: AutomationEventInput): number {
  return event.effectiveFinalScore ?? event.finalScore ?? 0;
}
