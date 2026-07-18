import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  editorialDateTehran,
  estimateDurationSeconds,
  selectionUtility,
  suggestSection,
  summarizeCoverage,
} from './daily-rundown-policy.js';
import { RundownSection } from './enums.js';

describe('daily-rundown-policy', () => {
  it('formats editorial date as YYYY-MM-DD', () => {
    assert.match(
      editorialDateTehran(new Date('2026-07-18T10:00:00.000Z')),
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('estimates duration by section', () => {
    assert.equal(estimateDurationSeconds(RundownSection.LEAD), 90);
    assert.equal(estimateDurationSeconds(RundownSection.BRIEF), 30);
  });

  it('suggests section from score', () => {
    assert.equal(suggestSection(90), RundownSection.LEAD);
    assert.equal(suggestSection(72), RundownSection.MAIN);
  });

  it('computes selection utility in range', () => {
    const u = selectionUtility({
      finalScore: 80,
      freshnessScore: 70,
      coverageNeed: 80,
    });
    assert.ok(u > 50);
    assert.ok(u <= 100);
  });

  it('summarizes coverage by duration', () => {
    const summary = summarizeCoverage([
      {
        scope: 'IRAN',
        category: 'TRANSFER',
        section: RundownSection.MAIN,
        estimatedDurationSeconds: 60,
      },
      {
        scope: 'EUROPE',
        category: 'MATCH_RESULT',
        section: RundownSection.MAIN,
        estimatedDurationSeconds: 60,
        isLeadStory: true,
      },
    ]);
    assert.equal(summary.totalCount, 2);
    assert.equal(summary.totalDurationSeconds, 120);
    assert.equal(
      summary.byScope.find((b) => b.key === 'IRAN')?.percentDuration,
      50,
    );
  });
});
