import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCoverageReport,
  isEligibleEvent,
  resolveCoverageStatus,
} from './coverage-intelligence.js';
import {
  CoverageBucketStatus,
  CoverageDimensionKey,
  CoverageRecommendationType,
} from './enums.js';

describe('coverage-intelligence', () => {
  it('classifies bucket statuses', () => {
    assert.equal(
      resolveCoverageStatus({
        eligible: 0,
        selected: 0,
        minSelected: 1,
        maxSelected: 3,
      }),
      CoverageBucketStatus.NO_AVAILABLE_NEWS,
    );
    assert.equal(
      resolveCoverageStatus({
        eligible: 3,
        selected: 0,
        minSelected: 1,
        maxSelected: 3,
      }),
      CoverageBucketStatus.AVAILABLE_NOT_SELECTED,
    );
    assert.equal(
      resolveCoverageStatus({
        eligible: 3,
        selected: 1,
        minSelected: 2,
        maxSelected: 3,
      }),
      CoverageBucketStatus.UNDER_TARGET,
    );
    assert.equal(
      resolveCoverageStatus({
        eligible: 3,
        selected: 2,
        minSelected: 1,
        maxSelected: 3,
      }),
      CoverageBucketStatus.ON_TARGET,
    );
    assert.equal(
      resolveCoverageStatus({
        eligible: 3,
        selected: 5,
        minSelected: 1,
        maxSelected: 3,
      }),
      CoverageBucketStatus.OVER_TARGET,
    );
  });

  it('does not treat weak news as eligible', () => {
    assert.equal(
      isEligibleEvent({
        id: 'a',
        scope: 'IRAN',
        category: 'TRANSFER',
        finalScore: 50,
        credibilityScore: 40,
        freshnessScore: 50,
        status: 'NEEDS_REVIEW',
        teamKeys: ['esteghlal'],
        competitionKeys: [],
        trackedEventKeys: [],
      }),
      false,
    );
  });

  it('counts one event across multiple dimensions', () => {
    const report = buildCoverageReport({
      editorialDate: '2026-07-18',
      selectedEventIds: ['e1'],
      selectedDurations: { e1: 60 },
      targets: [
        {
          dimension: CoverageDimensionKey.SCOPE,
          key: 'IRAN',
          minSelectedCount: 1,
          maxSelectedCount: 7,
          minDurationSeconds: null,
          maxDurationSeconds: null,
          priority: 10,
          enforcement: 'SOFT',
        },
        {
          dimension: CoverageDimensionKey.TEAM,
          key: 'esteghlal',
          minSelectedCount: null,
          maxSelectedCount: 2,
          minDurationSeconds: null,
          maxDurationSeconds: null,
          priority: 5,
          enforcement: 'SOFT',
        },
        {
          dimension: CoverageDimensionKey.COMPETITION,
          key: 'iran-pro-league',
          minSelectedCount: 1,
          maxSelectedCount: 7,
          minDurationSeconds: null,
          maxDurationSeconds: null,
          priority: 8,
          enforcement: 'SOFT',
        },
      ],
      events: [
        {
          id: 'e1',
          scope: 'IRAN',
          category: 'TRANSFER',
          finalScore: 80,
          credibilityScore: 70,
          freshnessScore: 70,
          status: 'APPROVED',
          teamKeys: ['esteghlal'],
          competitionKeys: ['iran-pro-league'],
          trackedEventKeys: [],
          title: 'استقلال',
        },
        {
          id: 'e2',
          scope: 'EUROPE',
          category: 'MATCH_RESULT',
          finalScore: 75,
          credibilityScore: 70,
          freshnessScore: 60,
          status: 'NEEDS_REVIEW',
          teamKeys: [],
          competitionKeys: ['premier-league'],
          trackedEventKeys: [],
          title: 'EPL',
        },
      ],
      labels: {
        teams: { esteghlal: 'استقلال' },
        competitions: {
          'iran-pro-league': 'لیگ ایران',
          'premier-league': 'لیگ انگلیس',
        },
      },
    });

    assert.equal(report.summary.discoveredEventCount, 2);
    assert.equal(report.summary.selectedEventCount, 1);
    const iran = report.scopes.find((s) => s.key === 'IRAN');
    const est = report.teams.find((t) => t.key === 'esteghlal');
    const ipl = report.competitions.find((c) => c.key === 'iran-pro-league');
    assert.ok(iran && est && ipl);
    assert.equal(iran.discoveredEventCount, 1);
    assert.equal(est.discoveredEventCount, 1);
    assert.equal(ipl.discoveredEventCount, 1);
    assert.equal(iran.selectedEventCount, 1);
    // e1 counted in iran + team + competition + transfer category
    assert.equal(
      report.categories.find((c) => c.key === 'TRANSFER')?.discoveredEventCount,
      1,
    );

    assert.ok(report.note.includes('چند دسته'));
  });

  it('suggests best-available soft picks when nothing is eligible', () => {
    const report = buildCoverageReport({
      editorialDate: '2026-07-18',
      selectedEventIds: [],
      targets: [
        {
          dimension: CoverageDimensionKey.SCOPE,
          key: 'IRAN',
          minSelectedCount: 1,
          maxSelectedCount: 5,
          minDurationSeconds: null,
          maxDurationSeconds: null,
          priority: 10,
          enforcement: 'SOFT',
        },
      ],
      events: [
        {
          id: 'weak1',
          scope: 'IRAN',
          category: 'OTHER',
          finalScore: 38,
          credibilityScore: 55,
          freshnessScore: 70,
          status: 'NEEDS_REVIEW',
          teamKeys: [],
          competitionKeys: [],
          trackedEventKeys: [],
          title: 'امباپه و زیدان',
        },
        {
          id: 'weak2',
          scope: 'IRAN',
          category: 'OTHER',
          finalScore: 42,
          credibilityScore: 50,
          freshnessScore: 60,
          status: 'NEEDS_REVIEW',
          teamKeys: [],
          competitionKeys: [],
          trackedEventKeys: [],
          title: 'خبر دوم',
        },
      ],
    });
    assert.equal(report.summary.eligibleEventCount, 0);
    const soft = report.recommendations.find(
      (r) => r.type === CoverageRecommendationType.BEST_AVAILABLE,
    );
    assert.ok(soft);
    assert.ok(soft!.suggestedEventIds.includes('weak2'));
    assert.ok(soft!.suggestedEventIds.includes('weak1'));
    assert.equal(soft!.suggestedEventIds[0], 'weak2');
  });

  it('suggests gap when eligible exists but nothing selected', () => {
    const report = buildCoverageReport({
      editorialDate: '2026-07-18',
      selectedEventIds: [],
      targets: [
        {
          dimension: CoverageDimensionKey.COMPETITION,
          key: 'premier-league',
          minSelectedCount: 1,
          maxSelectedCount: 3,
          minDurationSeconds: null,
          maxDurationSeconds: null,
          priority: 8,
          enforcement: 'SOFT',
        },
      ],
      events: [
        {
          id: 'epl1',
          scope: 'EUROPE',
          category: 'CONTRACT',
          finalScore: 76,
          credibilityScore: 70,
          freshnessScore: 80,
          status: 'NEEDS_REVIEW',
          teamKeys: [],
          competitionKeys: ['premier-league'],
          trackedEventKeys: [],
          title: 'تمدید',
        },
      ],
    });
    const gap = report.recommendations.find(
      (r) => r.type === CoverageRecommendationType.COVERAGE_GAP,
    );
    assert.ok(gap);
    assert.deepEqual(gap?.suggestedEventIds, ['epl1']);
  });
});
