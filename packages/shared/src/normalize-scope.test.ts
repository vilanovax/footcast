import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CoverageScope } from './enums.js';
import { normalizeScope, scopeBucketKey } from './normalize-scope.js';

describe('normalizeScope', () => {
  it('maps AI lowercase scopes', () => {
    assert.equal(normalizeScope('iran'), CoverageScope.IRAN);
    assert.equal(normalizeScope('europe'), CoverageScope.EUROPE);
    assert.equal(normalizeScope('both'), CoverageScope.BOTH);
    assert.equal(normalizeScope('other'), CoverageScope.OTHER);
  });

  it('maps enum uppercase', () => {
    assert.equal(normalizeScope('IRAN'), CoverageScope.IRAN);
    assert.equal(normalizeScope('EUROPE'), CoverageScope.EUROPE);
  });

  it('maps Persian labels', () => {
    assert.equal(normalizeScope('ایران'), CoverageScope.IRAN);
    assert.equal(normalizeScope('اروپا'), CoverageScope.EUROPE);
  });

  it('returns null for empty', () => {
    assert.equal(normalizeScope(null), null);
    assert.equal(normalizeScope(''), null);
    assert.equal(normalizeScope('   '), null);
  });

  it('falls back unknown to OTHER', () => {
    assert.equal(normalizeScope('latam'), CoverageScope.OTHER);
  });

  it('scopeBucketKey never null', () => {
    assert.equal(scopeBucketKey(null), CoverageScope.OTHER);
    assert.equal(scopeBucketKey('iran'), CoverageScope.IRAN);
  });
});
