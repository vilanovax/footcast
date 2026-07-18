import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUTOMATION_PROFILE_PRESETS,
  AutomationDecisionType,
  DEFAULT_EDITORIAL_AUTOMATION,
  applyAutomationProfile,
  type EditorialAutomationConfig,
} from '@footcast/shared';
import { evaluateAutomationPolicy } from './evaluate.js';
import type { AutomationEventInput, AutomationRundownContext } from './types.js';

function baseEvent(
  overrides: Partial<AutomationEventInput> = {},
): AutomationEventInput {
  return {
    newsEventId: 'evt-1',
    status: 'NEEDS_REVIEW',
    finalScore: 88,
    effectiveFinalScore: 88,
    credibilityScore: 82,
    importanceScore: 80,
    podcastValueScore: 70,
    recommendation: 'LEAD_STORY',
    officialStatus: 'OFFICIAL',
    category: 'TRANSFER',
    independentSourceCount: 2,
    maxSourceCredibility: 90,
    sourceTypes: ['OFFICIAL_CLUB', 'NEWS_AGENCY'],
    hasMajorConflict: false,
    isExactOrNearDuplicate: false,
    teamKeys: ['esteghlal'],
    competitionKeys: ['persian-gulf-pro'],
    estimatedDurationSeconds: 75,
    ...overrides,
  };
}

function baseRundown(
  overrides: Partial<AutomationRundownContext> = {},
): AutomationRundownContext {
  return {
    rundownId: 'rd-1',
    editorialDate: '2026-07-18',
    locked: false,
    minutesUntilLock: 120,
    existingEventIds: [],
    autoAddedCount: 0,
    teamCounts: {},
    competitionCounts: {},
    categoryCounts: {},
    durationSeconds: 200,
    maxEpisodeDurationSeconds: 720,
    ...overrides,
  };
}

function assisted(): EditorialAutomationConfig {
  return applyAutomationProfile(DEFAULT_EDITORIAL_AUTOMATION, 'ASSISTED');
}

function controlled(): EditorialAutomationConfig {
  return applyAutomationProfile(DEFAULT_EDITORIAL_AUTOMATION, 'CONTROLLED_AUTO');
}

describe('evaluateAutomationPolicy — ASSISTED defaults', () => {
  it('highlights lead-story and suggests add without auto-add', () => {
    const result = evaluateAutomationPolicy({
      config: assisted(),
      event: baseEvent(),
      rundown: baseRundown(),
    });
    assert.equal(result.highlight?.badge, 'LEAD');
    assert.equal(result.suggest?.kind, 'ADD');
    assert.equal(result.autoAdd, null);
    assert.ok(
      result.decisions.some((d) => d.decisionType === AutomationDecisionType.HIGHLIGHT),
    );
    assert.ok(
      result.decisions.some((d) => d.decisionType === AutomationDecisionType.SUGGEST_ADD),
    );
    assert.ok(
      !result.decisions.some((d) => d.decisionType === AutomationDecisionType.AUTO_ADD),
    );
  });

  it('does not highlight reject-or-archive below thresholds', () => {
    const result = evaluateAutomationPolicy({
      config: assisted(),
      event: baseEvent({
        finalScore: 40,
        effectiveFinalScore: 40,
        credibilityScore: 40,
        recommendation: 'REJECT_OR_ARCHIVE',
      }),
      rundown: baseRundown(),
    });
    assert.equal(result.highlight, null);
    assert.equal(result.suggest, null);
  });
});

describe('evaluateAutomationPolicy — CONTROLLED_AUTO', () => {
  it('allows AUTO_ADD for official high-score news', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent(),
      rundown: baseRundown(),
    });
    assert.equal(result.autoAdd?.allowed, true);
    assert.equal(result.autoAdd?.reviewStatus, 'PENDING_REVIEW');
    const add = result.decisions.find(
      (d) => d.decisionType === AutomationDecisionType.AUTO_ADD,
    );
    assert.ok(add?.shouldExecute);
  });

  it('blocks rumor even with high score', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({
        officialStatus: 'RUMOR',
        finalScore: 92,
        effectiveFinalScore: 92,
        credibilityScore: 90,
        recommendation: 'INCLUDE_IN_MAIN_PODCAST',
      }),
      rundown: baseRundown(),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(result.autoAdd?.blockedReasons.includes('rumor_not_allowed'));
  });

  it('blocks single-source non-official', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({
        officialStatus: 'UNVERIFIED',
        independentSourceCount: 1,
        maxSourceCredibility: 85,
        recommendation: 'INCLUDE_IN_MAIN_PODCAST',
      }),
      rundown: baseRundown(),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(
      result.autoAdd?.blockedReasons.some(
        (b) =>
          b === 'single_source_non_official' ||
          b.startsWith('official_status_not_allowed'),
      ),
    );
  });

  it('allows single-source official when configured', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({
        independentSourceCount: 1,
        maxSourceCredibility: 90,
        officialStatus: 'OFFICIAL',
      }),
      rundown: baseRundown(),
    });
    assert.equal(result.autoAdd?.allowed, true);
  });

  it('blocks major conflict', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({ hasMajorConflict: true }),
      rundown: baseRundown(),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(result.autoAdd?.blockedReasons.includes('major_conflict'));
  });

  it('blocks exact/near duplicate', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({ isExactOrNearDuplicate: true }),
      rundown: baseRundown(),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(result.autoAdd?.blockedReasons.includes('duplicate'));
    assert.equal(result.suggest, null);
  });

  it('blocks when rundown is locked', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent(),
      rundown: baseRundown({ locked: true }),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(result.autoAdd?.blockedReasons.includes('rundown_locked'));
    assert.equal(result.suggest, null);
  });

  it('blocks when team cap exceeded', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({ teamKeys: ['barcelona'] }),
      rundown: baseRundown({
        teamCounts: { barcelona: 3 },
      }),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(result.autoAdd?.blockedReasons.includes('team_cap:barcelona'));
  });

  it('is idempotent — prior AUTO_ADD blocks re-execute', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent(),
      rundown: baseRundown({ priorAutoAddExecuted: true }),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(
      result.autoAdd?.blockedReasons.includes('prior_auto_add_executed'),
    );
  });

  it('blocks when already in rundown', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({ newsEventId: 'evt-dup' }),
      rundown: baseRundown({ existingEventIds: ['evt-dup'] }),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(result.autoAdd?.blockedReasons.includes('already_in_rundown'));
    assert.equal(result.suggest, null);
  });

  it('blocks near lock deadline window', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent(),
      rundown: baseRundown({ minutesUntilLock: 10 }),
    });
    assert.equal(result.autoAdd?.allowed, false);
    assert.ok(
      result.autoAdd?.blockedReasons.some((b) =>
        b.startsWith('within_deadline_window'),
      ),
    );
  });

  it('holds rejected events', () => {
    const result = evaluateAutomationPolicy({
      config: controlled(),
      event: baseEvent({ status: 'REJECTED' }),
      rundown: baseRundown(),
    });
    assert.equal(result.highlight, null);
    assert.equal(result.suggest, null);
    assert.equal(result.autoAdd, null);
    assert.equal(result.decisions[0]?.decisionType, AutomationDecisionType.HOLD);
  });
});

describe('evaluateAutomationPolicy — SUGGEST_REPLACE advisory', () => {
  it('suggests replace under coverage capacity pressure', () => {
    const config: EditorialAutomationConfig = {
      ...assisted(),
      autoReplaceLowerUtilityItem: true,
      maxItemsPerTeam: 2,
    };
    const result = evaluateAutomationPolicy({
      config,
      event: baseEvent({
        newsEventId: 'evt-new',
        finalScore: 90,
        effectiveFinalScore: 90,
        teamKeys: ['esteghlal'],
      }),
      rundown: baseRundown({
        teamCounts: { esteghlal: 2 },
        replaceCandidates: [
          {
            newsEventId: 'evt-weak',
            effectiveScore: 60,
            teamKeys: ['esteghlal'],
            category: 'TRANSFER',
          },
        ],
      }),
    });
    assert.equal(result.suggest?.kind, 'REPLACE');
    assert.equal(result.suggest?.replaceTargetEventId, 'evt-weak');
    assert.ok(
      result.decisions.some(
        (d) => d.decisionType === AutomationDecisionType.SUGGEST_REPLACE,
      ),
    );
    assert.ok(
      !result.decisions.some((d) => d.shouldExecute),
      'REPLACE must never execute in v1',
    );
  });
});

describe('profile presets', () => {
  it('MANUAL disables suggest and auto-add', () => {
    assert.equal(AUTOMATION_PROFILE_PRESETS.MANUAL.autoSuggestForRundown, false);
    assert.equal(AUTOMATION_PROFILE_PRESETS.MANUAL.autoAddToRundown, false);
  });

  it('CONTROLLED_AUTO enables auto-add flag', () => {
    assert.equal(AUTOMATION_PROFILE_PRESETS.CONTROLLED_AUTO.autoAddToRundown, true);
  });
});
