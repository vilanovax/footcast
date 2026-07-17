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
      importanceScore: 70,
      credibilityScore: 80,
      freshnessScore: 90,
      articleCount: 2,
      clubs: ['استقلال'],
    });
    assert.ok(scored.finalScore >= 60);
    assert.ok(scored.ruleHits.includes('esteghlal_persepolis_weight'));
  });

  it('penalizes single-source rumor', () => {
    const scored = scoreNewsEvent({
      title: 'شایعه عجیب درباره انتقال',
      summary: 'یک منبع ناشناس',
      scope: 'europe',
      category: 'TRANSFER',
      officialStatus: OfficialStatus.RUMOR,
      importanceScore: 40,
      credibilityScore: 30,
      freshnessScore: 50,
      articleCount: 1,
    });
    assert.ok((scored.penalties.singleSourceRumor ?? 0) > 0);
    assert.ok(scored.finalScore < 55);
  });
});
