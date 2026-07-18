import type { EditorialAutomationConfig } from '@footcast/shared';
import { effectiveScore } from './snapshot.js';
import type { AutomationEventInput, HighlightBadge } from './types.js';

/** Map existing recommendation + score thresholds → UI badge (no EventStatus change). */
export function resolveHighlightBadge(
  event: AutomationEventInput,
  config: EditorialAutomationConfig,
): { badge: HighlightBadge; reasons: string[] } {
  const reasons: string[] = [];
  const score = effectiveScore(event);
  const cred = event.credibilityScore ?? 0;
  const rec = event.recommendation;

  if (rec === 'LEAD_STORY') {
    reasons.push('recommendation:LEAD_STORY');
    return { badge: 'LEAD', reasons };
  }
  if (rec === 'INCLUDE_IN_MAIN_PODCAST') {
    reasons.push('recommendation:INCLUDE_IN_MAIN_PODCAST');
    return { badge: 'IMPORTANT', reasons };
  }
  if (rec === 'INCLUDE_AS_BRIEF') {
    reasons.push('recommendation:INCLUDE_AS_BRIEF');
    return { badge: 'RUNDOWN_CANDIDATE', reasons };
  }
  if (rec === 'REJECT_OR_ARCHIVE') {
    reasons.push('recommendation:REJECT_OR_ARCHIVE');
    return { badge: 'LOW_PRIORITY', reasons };
  }

  if (
    score >= config.importantHighlightMinScore &&
    cred >= config.importantHighlightMinCredibility
  ) {
    reasons.push(
      `score>=${config.importantHighlightMinScore}`,
      `credibility>=${config.importantHighlightMinCredibility}`,
    );
    if (score >= 85 && cred >= 70) {
      return { badge: 'LEAD', reasons };
    }
    return { badge: 'IMPORTANT', reasons };
  }

  if (score >= config.suggestMinScore && cred >= config.suggestMinCredibility) {
    reasons.push(
      `score>=${config.suggestMinScore}`,
      `credibility>=${config.suggestMinCredibility}`,
    );
    return { badge: 'RUNDOWN_CANDIDATE', reasons };
  }

  if (rec === 'NEEDS_EDITOR_REVIEW' || score >= 45) {
    reasons.push(rec ? `recommendation:${rec}` : 'needs_review_fallback');
    return { badge: 'NEEDS_REVIEW', reasons };
  }

  reasons.push('below_thresholds');
  return { badge: 'LOW_PRIORITY', reasons };
}

export function isHighlightWorthy(badge: HighlightBadge): boolean {
  return (
    badge === 'LEAD' || badge === 'IMPORTANT' || badge === 'RUNDOWN_CANDIDATE'
  );
}
