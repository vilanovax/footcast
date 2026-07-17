import type { FactCheckIssue, FactCheckResult, ScriptClaim } from './types.js';

/** Lightweight fact-check over script claims vs selected event titles/summaries. */
export function factCheckScript(input: {
  claims: ScriptClaim[];
  items: Array<{ eventId: string; title: string; summary?: string | null }>;
}): FactCheckResult {
  const byEvent = new Map(input.items.map((item) => [item.eventId, item]));
  const issues: FactCheckIssue[] = [];

  for (const claim of input.claims) {
    const item = byEvent.get(claim.eventId);
    if (!item) {
      issues.push({
        claim: claim.claim,
        eventId: claim.eventId,
        severity: 'error',
        message: 'ادعایی به رویدادی خارج از اپیزود ارجاع داده است.',
      });
      continue;
    }

    const hay = `${item.title} ${item.summary ?? ''}`.toLowerCase();
    const tokens = claim.claim
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 6);
    const hits = tokens.filter((t) => hay.includes(t)).length;
    const ratio = tokens.length ? hits / tokens.length : 0;

    if (ratio < 0.34) {
      issues.push({
        claim: claim.claim,
        eventId: claim.eventId,
        severity: 'warn',
        message: 'همپوشانی ضعیف بین ادعای اسکریپت و متن کارت خبر.',
      });
    }

    if (claim.status === 'weak') {
      issues.push({
        claim: claim.claim,
        eventId: claim.eventId,
        severity: 'warn',
        message: 'ادعای ضعیف؛ قبل از TTS بازبینی شود.',
      });
    }
  }

  const supportedClaims = input.claims.filter((c) => c.status === 'supported').length;
  const hasError = issues.some((i) => i.severity === 'error');

  return {
    ok: !hasError,
    issues,
    supportedClaims,
    totalClaims: input.claims.length,
  };
}
