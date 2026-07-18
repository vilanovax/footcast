import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OfficialStatus } from '@footcast/shared';
import { scoreNewsEvent } from './score-event.js';

describe('scoreNewsEvent', () => {
  it('boosts Esteghlal/Perspolis Iran stories', () => {
    const scored = scoreNewsEvent({
      title: 'استقلال قرارداد مهاجم جدید را رسمی کرد',
      summary: 'باشگاه استقلال خبر رسمی داد.',
      scope: 'iran',
      category: 'TRANSFER',
      officialStatus: OfficialStatus.OFFICIAL,
      aiImportanceHint: 70,
      aiCredibilityHint: 80,
      freshnessScore: 90,
      independentSourceCount: 2,
      sourceCredibilitySeeds: [85, 70],
      sourceTypes: ['OFFICIAL_CLUB', 'LOCAL_SPORTS_MEDIA'],
      clubs: ['استقلال'],
    });
    assert.ok(scored.finalScore >= 60);
    assert.ok(scored.ruleHits.includes('esteghlal_persepolis_weight'));
    assert.equal(typeof scored.credibilityScore, 'number');
    assert.equal(typeof scored.podcastValueScore, 'number');
    assert.ok(scored.recommendation);
  });

  it('penalizes single-source rumor', () => {
    const scored = scoreNewsEvent({
      title: 'شایعه عجیب درباره انتقال',
      summary: 'یک منبع ناشناس',
      scope: 'europe',
      category: 'TRANSFER',
      officialStatus: OfficialStatus.RUMOR,
      aiImportanceHint: 40,
      aiCredibilityHint: 30,
      freshnessScore: 50,
      independentSourceCount: 1,
      sourceCredibilitySeeds: [35],
    });
    const singleSourcePenalty = scored.penalties.find(
      (p) => p.code === 'SINGLE_SOURCE_RUMOR',
    );
    assert.ok(singleSourcePenalty && singleSourcePenalty.value > 0);
    assert.ok(scored.finalScore < 55);
  });

  it('uses source credibility seeds in formula', () => {
    const low = scoreNewsEvent({
      title: 'گزارش انتقال',
      officialStatus: OfficialStatus.RELIABLE_REPORT,
      sourceCredibilitySeeds: [20],
      independentSourceCount: 1,
    });
    const high = scoreNewsEvent({
      title: 'گزارش انتقال',
      officialStatus: OfficialStatus.RELIABLE_REPORT,
      sourceCredibilitySeeds: [95],
      independentSourceCount: 1,
    });
    assert.ok(high.credibilityScore > low.credibilityScore);
  });
});
