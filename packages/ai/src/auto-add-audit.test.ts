import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mockDecideAutoAddAudit,
  runAutoAddAiAudit,
  validateAutoAddAiAudit,
  type AutoAddAiAuditInput,
} from './auto-add-audit.js';
import { MockAiProvider } from './mock-provider.js';

function base(overrides: Partial<AutoAddAiAuditInput> = {}): AutoAddAiAuditInput {
  return {
    newsEventId: '11111111-1111-4111-8111-111111111111',
    title: 'استقلال قرارداد بازیکن را رسمی کرد',
    summary: 'باشگاه استقلال امضای قرارداد را اعلام کرد.',
    status: 'NEEDS_REVIEW',
    officialStatus: 'RELIABLE_REPORT',
    recommendation: 'INCLUDE_IN_MAIN_PODCAST',
    category: 'TRANSFER',
    finalScore: 88,
    effectiveFinalScore: 88,
    credibilityScore: 82,
    independentSourceCount: 2,
    maxSourceCredibility: 85,
    sourceTypes: ['trusted_media', 'official_club'],
    hasMajorConflict: false,
    isExactOrNearDuplicate: false,
    teamKeys: ['esteghlal'],
    ...overrides,
  };
}

describe('mockDecideAutoAddAudit', () => {
  it('passes reliable multi-source high score', () => {
    const r = mockDecideAutoAddAudit(base());
    assert.equal(r.verdict, 'PASS');
    assert.ok(r.confidence >= 0.7);
  });

  it('fails rumor', () => {
    const r = mockDecideAutoAddAudit(base({ officialStatus: 'RUMOR' }));
    assert.equal(r.verdict, 'FAIL');
  });

  it('holds unverified single source', () => {
    const r = mockDecideAutoAddAudit(
      base({
        officialStatus: 'UNVERIFIED',
        independentSourceCount: 1,
      }),
    );
    assert.equal(r.verdict, 'HOLD');
  });
});

describe('runAutoAddAiAudit via MockAiProvider', () => {
  it('returns parsed PASS for strong event', async () => {
    const provider = new MockAiProvider();
    const r = await runAutoAddAiAudit(provider, base());
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.provider, 'mock');
    assert.ok(r.latencyMs >= 0);
  });

  it('validates schema', () => {
    const ok = validateAutoAddAiAudit({
      verdict: 'HOLD',
      confidence: 0.5,
      reasons: ['x'],
      risks: [],
    });
    assert.equal(ok.success, true);
    const bad = validateAutoAddAiAudit({ verdict: 'MAYBE', confidence: 2 });
    assert.equal(bad.success, false);
  });
});
