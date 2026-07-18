import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ruleAuditAutoAdd } from './rule-audit.js';
import type { AutomationEventInput } from './types.js';

function event(overrides: Partial<AutomationEventInput> = {}): AutomationEventInput {
  return {
    newsEventId: 'e1',
    status: 'NEEDS_REVIEW',
    finalScore: 88,
    effectiveFinalScore: 88,
    credibilityScore: 82,
    importanceScore: 80,
    podcastValueScore: 70,
    recommendation: 'LEAD_STORY',
    officialStatus: 'OFFICIAL',
    category: 'TRANSFER',
    independentSourceCount: 1,
    maxSourceCredibility: 90,
    sourceTypes: ['OFFICIAL_CLUB'],
    hasMajorConflict: false,
    isExactOrNearDuplicate: false,
    teamKeys: [],
    competitionKeys: [],
    estimatedDurationSeconds: 60,
    ...overrides,
  };
}

describe('ruleAuditAutoAdd', () => {
  it('passes official high-score news', () => {
    const r = ruleAuditAutoAdd(event());
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.sensitive, false);
  });

  it('fails rumor', () => {
    const r = ruleAuditAutoAdd(event({ officialStatus: 'RUMOR' }));
    assert.equal(r.verdict, 'FAIL');
    assert.ok(r.failReasons.some((x) => x.includes('RUMOR')));
  });

  it('fails conflict', () => {
    const r = ruleAuditAutoAdd(event({ hasMajorConflict: true }));
    assert.equal(r.verdict, 'FAIL');
  });

  it('fails duplicate', () => {
    const r = ruleAuditAutoAdd(event({ isExactOrNearDuplicate: true }));
    assert.equal(r.verdict, 'FAIL');
  });

  it('requests AI audit for unverified multi-source', () => {
    const r = ruleAuditAutoAdd(
      event({
        officialStatus: 'UNVERIFIED',
        independentSourceCount: 3,
        maxSourceCredibility: 75,
      }),
    );
    assert.equal(r.verdict, 'NEEDS_AI_AUDIT');
    assert.equal(r.sensitive, true);
  });
});
