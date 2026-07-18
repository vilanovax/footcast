export type AiAuditVerdict = 'PASS' | 'FAIL' | 'HOLD';

export type AiAuditGateInput = {
  verdict: AiAuditVerdict | string;
  confidence: number;
  reasons?: string[];
  risks?: string[];
  minConfidence: number;
};

export type AiAuditGateResult = {
  /** Safe to continue AUTO_ADD execute */
  proceed: boolean;
  /** Soft block — editor should review; do not auto-add */
  hold: boolean;
  /** Hard block */
  fail: boolean;
  reasons: string[];
  blockedReasons: string[];
};

/**
 * Pure gate after AI auditor returns a verdict (ADR-007 phase 6).
 * Fail-closed: only PASS with confidence >= minConfidence proceeds.
 */
export function applyAiAuditGate(input: AiAuditGateInput): AiAuditGateResult {
  const reasons = [...(input.reasons ?? [])];
  const risks = input.risks ?? [];
  const verdict = String(input.verdict ?? 'HOLD').toUpperCase();
  const confidence = Number.isFinite(input.confidence) ? input.confidence : 0;

  if (verdict === 'FAIL') {
    return {
      proceed: false,
      hold: false,
      fail: true,
      reasons: ['ai_audit_fail', ...reasons],
      blockedReasons: [
        'ai_audit_failed',
        ...risks.map((r) => `ai_risk:${r}`),
      ],
    };
  }

  if (verdict === 'PASS' && confidence >= input.minConfidence) {
    return {
      proceed: true,
      hold: false,
      fail: false,
      reasons: [
        'ai_audit_pass',
        `ai_confidence:${confidence.toFixed(2)}`,
        ...reasons,
      ],
      blockedReasons: [],
    };
  }

  if (verdict === 'PASS' && confidence < input.minConfidence) {
    return {
      proceed: false,
      hold: true,
      fail: false,
      reasons: [
        'ai_audit_low_confidence',
        `ai_confidence:${confidence.toFixed(2)}`,
        `min:${input.minConfidence}`,
        ...reasons,
      ],
      blockedReasons: ['ai_audit_confidence_below_min'],
    };
  }

  return {
    proceed: false,
    hold: true,
    fail: false,
    reasons: ['ai_audit_hold', ...reasons],
    blockedReasons: [
      'ai_audit_hold',
      ...risks.map((r) => `ai_risk:${r}`),
    ],
  };
}
