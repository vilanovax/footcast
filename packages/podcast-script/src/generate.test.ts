import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { factCheckScript } from './fact-check.js';
import {
  TARGET_MAX_MINUTES,
  TARGET_MIN_MINUTES,
  estimateDurationSec,
  generatePodcastScript,
} from './generate.js';

describe('generatePodcastScript', () => {
  it('builds an 8-12 minute-ish script with sourced claims', () => {
    const script = generatePodcastScript({
      episodeTitle: 'خلاصه خبر ۱۷ تیر',
      targetMinutes: 10,
      items: [
        {
          eventId: '11111111-1111-4111-8111-111111111111',
          title: 'استقلال قرارداد مهاجم را رسمی کرد',
          summary: 'باشگاه استقلال خبر رسمی جذب مهاجم جدید را اعلام کرد.',
          category: 'TRANSFER',
          scope: 'iran',
          officialStatus: 'OFFICIAL',
          importanceScore: 80,
          sourceLabels: ['IRNA'],
        },
        {
          eventId: '22222222-2222-4222-8222-222222222222',
          title: 'لیورپول برای هافبک وارد مذاکره شد',
          summary: 'منابع نزدیک به باشگاه از مذاکره اولیه خبر دادند.',
          category: 'TRANSFER',
          scope: 'europe',
          officialStatus: 'UNVERIFIED',
          importanceScore: 70,
          sourceLabels: ['Guardian'],
        },
      ],
    });

    const minutes = script.estimatedDurationSec / 60;
    assert.ok(minutes >= TARGET_MIN_MINUTES - 0.5);
    assert.ok(minutes <= TARGET_MAX_MINUTES + 2);
    assert.equal(script.claims.length, 2);
    assert.ok(script.bodyMd.includes('استقلال'));
    assert.ok(script.bodyMd.includes('منبع'));
    assert.equal(estimateDurationSec(script.wordCount), script.estimatedDurationSec);
  });
});

describe('factCheckScript', () => {
  it('flags claims missing from episode items', () => {
    const result = factCheckScript({
      claims: [
        {
          claim: 'خبر ساختگی',
          eventId: '33333333-3333-4333-8333-333333333333',
          sourceLabel: 'x',
          confidence: 0.2,
          status: 'unverified',
        },
      ],
      items: [],
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.severity === 'error'));
  });
});
