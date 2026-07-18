import type { AutomationEventInput } from './types.js';

export type RuleAuditVerdict = 'PASS' | 'FAIL' | 'NEEDS_AI_AUDIT';

export type RuleAuditResult = {
  verdict: RuleAuditVerdict;
  checks: Array<{ code: string; ok: boolean; detail?: string }>;
  failReasons: string[];
  /** Sensitive enough that AI audit should run when policy asks for it */
  sensitive: boolean;
};

/**
 * Deterministic Rule Audit before AUTO_ADD (ADR-007).
 * Official single-source OK; rumor / conflict / weak evidence FAIL.
 * Multi-source non-official or disputed → NEEDS_AI_AUDIT.
 */
export function ruleAuditAutoAdd(event: AutomationEventInput): RuleAuditResult {
  const checks: RuleAuditResult['checks'] = [];
  const failReasons: string[] = [];
  const official = event.officialStatus ?? 'UNVERIFIED';

  const notTerminal = !['REJECTED', 'ARCHIVED', 'MERGED', 'PUBLISHED'].includes(
    event.status,
  );
  checks.push({ code: 'not_terminal', ok: notTerminal });
  if (!notTerminal) failReasons.push(`status:${event.status}`);

  const notDup = !event.isExactOrNearDuplicate;
  checks.push({ code: 'not_duplicate', ok: notDup });
  if (!notDup) failReasons.push('duplicate');

  const noConflict = !event.hasMajorConflict;
  checks.push({ code: 'no_major_conflict', ok: noConflict });
  if (!noConflict) failReasons.push('major_conflict');

  const notRumor = official !== 'RUMOR' && official !== 'FALSE';
  checks.push({ code: 'not_rumor_or_false', ok: notRumor, detail: official });
  if (!notRumor) failReasons.push(`official:${official}`);

  const scoreOk = (event.effectiveFinalScore ?? event.finalScore ?? 0) >= 70;
  checks.push({ code: 'score_floor', ok: scoreOk });
  if (!scoreOk) failReasons.push('score_below_audit_floor');

  const credOk = (event.credibilityScore ?? 0) >= 60;
  checks.push({ code: 'credibility_floor', ok: credOk });
  if (!credOk) failReasons.push('credibility_below_audit_floor');

  const hasTitleSignal =
    Boolean(event.recommendation) ||
    (event.effectiveFinalScore ?? event.finalScore ?? 0) > 0;
  checks.push({ code: 'has_score_signal', ok: hasTitleSignal });

  const isOfficialish = official === 'OFFICIAL' || official === 'CONFIRMED';
  // Non-official (incl. DISPUTED / UNVERIFIED) or conflict → AI audit when enabled.
  const sensitive = !isOfficialish || event.hasMajorConflict;

  if (failReasons.length > 0) {
    return { verdict: 'FAIL', checks, failReasons, sensitive };
  }

  if (sensitive && !isOfficialish) {
    return {
      verdict: 'NEEDS_AI_AUDIT',
      checks: [
        ...checks,
        {
          code: 'sensitive_non_official',
          ok: false,
          detail: official,
        },
      ],
      failReasons: [],
      sensitive: true,
    };
  }

  return {
    verdict: 'PASS',
    checks: [...checks, { code: 'official_path', ok: true, detail: official }],
    failReasons: [],
    sensitive: false,
  };
}
