import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAcceptanceRate,
  crawlSuccessRate,
  roundMetric,
  sumTokens,
} from './kpis.js';

describe('computeAcceptanceRate', () => {
  it('returns null rate when no decisions', () => {
    assert.deepEqual(computeAcceptanceRate({ approve: 0, reject: 0 }), {
      approve: 0,
      reject: 0,
      total: 0,
      rate: null,
    });
  });

  it('computes approve share', () => {
    const result = computeAcceptanceRate({ approve: 7, reject: 3 });
    assert.equal(result.total, 10);
    assert.equal(result.rate, 0.7);
  });
});

describe('sumTokens', () => {
  it('sums token fields', () => {
    assert.equal(sumTokens({ inputTokens: 10, outputTokens: 5, cachedInputTokens: 2 }), 17);
  });
});

describe('crawlSuccessRate', () => {
  it('handles empty', () => {
    assert.equal(crawlSuccessRate(0, 0), null);
  });

  it('computes ratio', () => {
    assert.equal(crawlSuccessRate(9, 1), 0.9);
  });
});

describe('roundMetric', () => {
  it('rounds to digits', () => {
    assert.equal(roundMetric(1.2345, 2), 1.23);
    assert.equal(roundMetric(null), null);
  });
});
