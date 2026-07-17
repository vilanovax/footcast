import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_EDITORIAL_RULES, listEnabledRules } from './index.js';

describe('editorial rules seed', () => {
  it('includes hard rumor and conflict rules', () => {
    const codes = DEFAULT_EDITORIAL_RULES.map((r) => r.code);
    assert.ok(codes.includes('block_single_source_rumor'));
    assert.ok(codes.includes('conflict_to_human'));
  });

  it('lists only enabled rules', () => {
    assert.equal(listEnabledRules().length, DEFAULT_EDITORIAL_RULES.filter((r) => r.enabled).length);
  });
});
