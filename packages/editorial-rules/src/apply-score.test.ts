import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OfficialStatus } from '@footcast/shared';
import { buildEventScoreInput } from './apply-score.js';

describe('buildEventScoreInput — duplicate + scope', () => {
  it('marks duplicate-heavy from clustering flag', () => {
    const { input, result } = buildEventScoreInput({
      title: 'بازنشر خبر',
      summary: 'همان خبر دوباره',
      scope: 'IRAN',
      officialStatus: OfficialStatus.UNVERIFIED,
      isDuplicateHeavy: true,
      sources: [
        { sourceId: 's1', credibilitySeed: 70, sourceType: 'LOCAL_SPORTS_MEDIA' },
      ],
    });
    assert.equal(input.isDuplicateHeavy, true);
    assert.ok(
      result.penalties.some((p) => p.code === 'LOW_VALUE_DUPLICATE') ||
        result.ruleHits.includes('duplicate_only_on_update') ||
        result.finalScore < 70,
    );
  });

  it('marks reprint-heavy when many links from one source', () => {
    const { input } = buildEventScoreInput({
      title: 'خبر پرتکرار',
      scope: 'iran',
      sources: [
        { sourceId: 's1', credibilitySeed: 70, sourceType: 'LOCAL_SPORTS_MEDIA' },
      ],
      articleLinkCount: 4,
    });
    assert.equal(input.isDuplicateHeavy, true);
  });

  it('does not mark single article as duplicate-heavy', () => {
    const { input } = buildEventScoreInput({
      title: 'خبر تازه',
      scope: 'EUROPE',
      sources: [
        { sourceId: 's1', credibilitySeed: 90, sourceType: 'TRUSTED_NEWSPAPER' },
      ],
      articleLinkCount: 1,
    });
    assert.equal(input.isDuplicateHeavy, false);
  });
});
