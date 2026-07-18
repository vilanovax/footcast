import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLUSTERING_POLICY } from '@footcast/shared';
import {
  buildAliasMap,
  computeEvaluationMetrics,
  configureEmbeddingRuntime,
  createEmbeddingProvider,
  getEmbeddingProvider,
  normalizeForMatch,
  resetEmbeddingProvider,
  resolveEntityName,
  validateAiBoundaryResult,
} from './index.js';

describe('PR-B evaluation metrics', () => {
  it('computes precision/recall and false merge rate', () => {
    const metrics = computeEvaluationMetrics([
      {
        verdict: 'CORRECT',
        expectedRelationship: 'EXACT_DUPLICATE',
        predictedRelationship: 'EXACT_DUPLICATE',
      },
      {
        verdict: 'CORRECT',
        expectedRelationship: 'EXACT_DUPLICATE',
        predictedRelationship: 'EXACT_DUPLICATE',
      },
      {
        verdict: 'WRONG_MERGE',
        expectedRelationship: 'UNRELATED',
        predictedRelationship: 'SAME_EVENT',
      },
      {
        verdict: 'MISSED_MERGE',
        expectedRelationship: 'SAME_EVENT',
        predictedRelationship: 'UNRELATED',
      },
      {
        verdict: 'WRONG_RELATIONSHIP',
        expectedRelationship: 'NEAR_DUPLICATE',
        predictedRelationship: 'SAME_EVENT',
      },
    ]);
    assert.equal(metrics.evaluatedCount, 5);
    assert.equal(metrics.exactDuplicateRecall, 1);
    assert.equal(metrics.exactDuplicatePrecision, 1);
    assert.equal(metrics.falseMergeRate, 0.2);
    assert.equal(metrics.missedMergeRate, 0.2);
    assert.ok(metrics.falseMergeRate > 0);
  });
});

describe('Entity alias normalization', () => {
  it('maps FA/EN Persepolis aliases to one entity', () => {
    const map = buildAliasMap([
      {
        normalizedAlias: normalizeForMatch('پرسپولیس'),
        canonicalNormalized: normalizeForMatch('پرسپولیس'),
      },
      {
        normalizedAlias: normalizeForMatch('باشگاه پرسپولیس'),
        canonicalNormalized: normalizeForMatch('پرسپولیس'),
      },
      {
        normalizedAlias: normalizeForMatch('سرخ‌پوشان'),
        canonicalNormalized: normalizeForMatch('پرسپولیس'),
      },
      {
        normalizedAlias: normalizeForMatch('Persepolis'),
        canonicalNormalized: normalizeForMatch('پرسپولیس'),
      },
      {
        normalizedAlias: normalizeForMatch('Persepolis FC'),
        canonicalNormalized: normalizeForMatch('پرسپولیس'),
      },
    ]);
    const names = [
      'پرسپولیس',
      'باشگاه پرسپولیس',
      'سرخ‌پوشان',
      'Persepolis',
      'Persepolis FC',
    ].map((n) => resolveEntityName(n, map));
    assert.ok(names.every((n) => n === names[0]));
  });
});

describe('Policy versioning', () => {
  it('exposes versioned CLUSTERING_POLICY 2.1.0', () => {
    assert.equal(CLUSTERING_POLICY.version, '2.1.0');
    assert.equal(CLUSTERING_POLICY.autoMergeThreshold, 0.9);
    assert.equal(CLUSTERING_POLICY.aiBoundaryMin, 0.74);
    assert.ok(CLUSTERING_POLICY.weights.entity === 0.3);
  });
});

describe('Embedding production mock prevention', () => {
  it('fail-fast when mock disabled', () => {
    resetEmbeddingProvider();
    configureEmbeddingRuntime({ allowMock: false });
    assert.throws(() => getEmbeddingProvider(), /Mock embedding provider is disabled/);
    resetEmbeddingProvider();
  });

  it('createEmbeddingProvider rejects mock when not allowed', () => {
    assert.throws(
      () => createEmbeddingProvider({ provider: 'mock', allowMock: false }),
      /not allowed/,
    );
  });
});

describe('AI boundary schema validation', () => {
  it('accepts valid JSON and rejects invalid', () => {
    const ok = validateAiBoundaryResult({
      relationship: 'SAME_EVENT',
      confidence: 0.85,
      recommendedAction: 'ATTACH_AS_SUPPORTING',
      reason: 'ok',
      newClaims: [],
      duplicateClaims: [],
      conflicts: [],
    });
    assert.ok(ok);
    assert.equal(ok?.confidence, 0.85);
    assert.equal(
      validateAiBoundaryResult({ relationship: 'NOPE', confidence: 0.9 }),
      null,
    );
    assert.equal(
      validateAiBoundaryResult({
        relationship: 'SAME_EVENT',
        confidence: 0.5,
        recommendedAction: 'ATTACH_AS_SUPPORTING',
      })?.confidence,
      0.5,
    );
  });
});
