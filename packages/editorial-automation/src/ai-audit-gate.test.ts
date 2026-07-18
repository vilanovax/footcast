import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyAiAuditGate } from './ai-audit-gate.js';

describe('applyAiAuditGate', () => {
  it('proceeds on PASS with enough confidence', () => {
    const r = applyAiAuditGate({
      verdict: 'PASS',
      confidence: 0.8,
      minConfidence: 0.62,
      reasons: ['strong_multi_source'],
    });
    assert.equal(r.proceed, true);
    assert.equal(r.hold, false);
    assert.equal(r.fail, false);
    assert.ok(r.reasons.includes('ai_audit_pass'));
  });

  it('holds on PASS below min confidence', () => {
    const r = applyAiAuditGate({
      verdict: 'PASS',
      confidence: 0.4,
      minConfidence: 0.62,
    });
    assert.equal(r.proceed, false);
    assert.equal(r.hold, true);
    assert.ok(r.blockedReasons.includes('ai_audit_confidence_below_min'));
  });

  it('fails closed on FAIL', () => {
    const r = applyAiAuditGate({
      verdict: 'FAIL',
      confidence: 0.9,
      minConfidence: 0.62,
      risks: ['rumor_or_false'],
    });
    assert.equal(r.proceed, false);
    assert.equal(r.fail, true);
    assert.ok(r.blockedReasons.includes('ai_audit_failed'));
  });

  it('holds on HOLD verdict', () => {
    const r = applyAiAuditGate({
      verdict: 'HOLD',
      confidence: 0.7,
      minConfidence: 0.62,
      reasons: ['borderline_evidence'],
    });
    assert.equal(r.proceed, false);
    assert.equal(r.hold, true);
    assert.ok(r.blockedReasons.includes('ai_audit_hold'));
  });
});
