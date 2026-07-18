import type { EditorialAutomationConfig } from '@footcast/shared';
import { effectiveScore } from './snapshot.js';
import type { AutomationEventInput, AutomationRundownContext } from './types.js';

const TERMINAL_STATUSES = new Set([
  'REJECTED',
  'ARCHIVED',
  'MERGED',
  'PUBLISHED',
]);

export function isTerminalEventStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Soft eligibility for suggest (fewer gates than auto-add). */
export function collectSuggestBlockers(
  event: AutomationEventInput,
  rundown: AutomationRundownContext,
  config: EditorialAutomationConfig,
): string[] {
  const blocked: string[] = [];
  if (isTerminalEventStatus(event.status)) {
    blocked.push(`status:${event.status}`);
  }
  if (event.isExactOrNearDuplicate) {
    blocked.push('duplicate');
  }
  if (rundown.existingEventIds.includes(event.newsEventId)) {
    blocked.push('already_in_rundown');
  }
  if (rundown.locked) {
    blocked.push('rundown_locked');
  }
  const score = effectiveScore(event);
  const cred = event.credibilityScore ?? 0;
  if (score < config.suggestMinScore) {
    blocked.push(`score_below_${config.suggestMinScore}`);
  }
  if (cred < config.suggestMinCredibility) {
    blocked.push(`credibility_below_${config.suggestMinCredibility}`);
  }
  return blocked;
}

/** Hard guards for AUTO_ADD execution. */
export function collectAutoAddBlockers(
  event: AutomationEventInput,
  rundown: AutomationRundownContext,
  config: EditorialAutomationConfig,
): string[] {
  const blocked: string[] = [];

  if (!config.autoAddToRundown) {
    blocked.push('auto_add_disabled');
  }
  if (isTerminalEventStatus(event.status)) {
    blocked.push(`status:${event.status}`);
  }
  if (event.isExactOrNearDuplicate) {
    blocked.push('duplicate');
  }
  if (rundown.existingEventIds.includes(event.newsEventId)) {
    blocked.push('already_in_rundown');
  }
  if (rundown.priorAutoAddExecuted) {
    blocked.push('prior_auto_add_executed');
  }
  if (rundown.locked) {
    blocked.push('rundown_locked');
  }
  if (
    rundown.minutesUntilLock != null &&
    rundown.minutesUntilLock <= config.stopAutoAddBeforeDeadlineMinutes
  ) {
    blocked.push(
      `within_deadline_window_${config.stopAutoAddBeforeDeadlineMinutes}m`,
    );
  }

  const score = effectiveScore(event);
  const cred = event.credibilityScore ?? 0;
  if (score < config.autoAddMinScore) {
    blocked.push(`score_below_${config.autoAddMinScore}`);
  }
  if (cred < config.autoAddMinCredibility) {
    blocked.push(`credibility_below_${config.autoAddMinCredibility}`);
  }

  const official = event.officialStatus ?? 'UNVERIFIED';
  if (
    config.allowedOfficialStatuses.length > 0 &&
    !config.allowedOfficialStatuses.includes(
      official as EditorialAutomationConfig['allowedOfficialStatuses'][number],
    )
  ) {
    blocked.push(`official_status_not_allowed:${official}`);
  }

  if (official === 'RUMOR' && !config.allowRumorAutoAdd) {
    blocked.push('rumor_not_allowed');
  }

  if (config.blockOnConflict && event.hasMajorConflict) {
    blocked.push('major_conflict');
  }

  if (event.maxSourceCredibility < config.minimumSourceCredibility) {
    blocked.push(
      `source_credibility_below_${config.minimumSourceCredibility}`,
    );
  }

  if (event.independentSourceCount < config.minimumIndependentSources) {
    blocked.push(
      `independent_sources_below_${config.minimumIndependentSources}`,
    );
  }

  const isSingleSource = event.independentSourceCount <= 1;
  const isOfficialish = official === 'OFFICIAL' || official === 'CONFIRMED';
  if (isSingleSource && !isOfficialish && !config.allowRumorAutoAdd) {
    blocked.push('single_source_non_official');
  }
  if (isSingleSource && isOfficialish && !config.allowSingleSourceOfficial) {
    blocked.push('single_source_official_disabled');
  }

  if (
    config.allowedSourceTypes.length > 0 &&
    !event.sourceTypes.some((t) => config.allowedSourceTypes.includes(t))
  ) {
    blocked.push('source_type_not_allowed');
  }

  if (rundown.autoAddedCount >= config.maxAutoAddedItems) {
    blocked.push(`max_auto_added_${config.maxAutoAddedItems}`);
  }

  for (const team of event.teamKeys) {
    const count = rundown.teamCounts[team] ?? 0;
    if (count >= config.maxItemsPerTeam) {
      blocked.push(`team_cap:${team}`);
    }
  }
  for (const comp of event.competitionKeys) {
    const count = rundown.competitionCounts[comp] ?? 0;
    if (count >= config.maxItemsPerCompetition) {
      blocked.push(`competition_cap:${comp}`);
    }
  }
  if (event.category) {
    const count = rundown.categoryCounts[event.category] ?? 0;
    if (count >= config.maxItemsPerCategory) {
      blocked.push(`category_cap:${event.category}`);
    }
  }

  const maxDur = rundown.maxEpisodeDurationSeconds;
  if (
    maxDur != null &&
    rundown.durationSeconds + event.estimatedDurationSeconds > maxDur
  ) {
    blocked.push('episode_duration_exceeded');
  }

  return blocked;
}

/** Soft capacity pressure — prefer SUGGEST_REPLACE over ADD when true. */
export function hasCoverageCapacityPressure(
  event: AutomationEventInput,
  rundown: AutomationRundownContext,
  config: EditorialAutomationConfig,
): boolean {
  for (const team of event.teamKeys) {
    if ((rundown.teamCounts[team] ?? 0) >= config.maxItemsPerTeam) return true;
  }
  for (const comp of event.competitionKeys) {
    if ((rundown.competitionCounts[comp] ?? 0) >= config.maxItemsPerCompetition) {
      return true;
    }
  }
  if (event.category) {
    if (
      (rundown.categoryCounts[event.category] ?? 0) >= config.maxItemsPerCategory
    ) {
      return true;
    }
  }
  const maxDur = rundown.maxEpisodeDurationSeconds;
  if (
    maxDur != null &&
    rundown.durationSeconds + event.estimatedDurationSeconds > maxDur
  ) {
    return true;
  }
  return false;
}
