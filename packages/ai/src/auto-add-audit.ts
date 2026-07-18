import { z } from 'zod';
import type { AiProvider } from './types.js';

export const autoAddAiAuditSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL', 'HOLD']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  summaryFa: z.string().max(500).optional(),
});

export type AutoAddAiAuditResult = z.infer<typeof autoAddAiAuditSchema>;

export type AutoAddAiAuditInput = {
  newsEventId: string;
  title: string;
  summary?: string | null;
  status: string;
  officialStatus: string | null;
  recommendation: string | null;
  category: string | null;
  finalScore: number | null;
  effectiveFinalScore: number | null;
  credibilityScore: number | null;
  independentSourceCount: number;
  maxSourceCredibility: number;
  sourceTypes: string[];
  hasMajorConflict: boolean;
  isExactOrNearDuplicate: boolean;
  teamKeys: string[];
  ruleAuditNotes?: string[];
};

export const AUTO_ADD_AI_AUDIT_STAGE = 'editorial_auto_add_audit';
export const AUTO_ADD_AI_AUDIT_PROMPT_VERSION = 'auto-add-audit-v1';

const SYSTEM_PROMPT = `You are an editorial AI auditor for a football newsroom.
Decide whether an automated system may AUTO-ADD this news event into today's podcast rundown (SHORTLISTED, pending editor ack).

Rules:
- PASS only if the story is safe, non-rumor, non-conflict, and worth a podcast slot.
- FAIL for rumor, false claims, major conflict, near-duplicate, or unsafe single-source gossip.
- HOLD when evidence is mixed or confidence is insufficient — prefer HOLD over PASS.
- Respond with JSON only matching the schema.`;

export function buildAutoAddAuditUserPrompt(input: AutoAddAiAuditInput): string {
  return [
    `Event ID: ${input.newsEventId}`,
    `Title: ${input.title}`,
    `Summary: ${(input.summary ?? '').slice(0, 600)}`,
    `Status: ${input.status}`,
    `OfficialStatus: ${input.officialStatus ?? 'UNVERIFIED'}`,
    `Recommendation: ${input.recommendation ?? 'n/a'}`,
    `Category: ${input.category ?? 'n/a'}`,
    `Scores: final=${input.finalScore ?? 'n/a'} effective=${input.effectiveFinalScore ?? 'n/a'} credibility=${input.credibilityScore ?? 'n/a'}`,
    `Sources: independent=${input.independentSourceCount} maxCredibility=${input.maxSourceCredibility} types=${input.sourceTypes.join(',') || 'n/a'}`,
    `Flags: majorConflict=${input.hasMajorConflict} nearDuplicate=${input.isExactOrNearDuplicate}`,
    `Teams: ${input.teamKeys.join(', ') || 'n/a'}`,
    `RuleAuditNotes: ${(input.ruleAuditNotes ?? []).join('; ') || 'n/a'}`,
    '',
    'Return JSON: { "verdict": "PASS"|"FAIL"|"HOLD", "confidence": 0..1, "reasons": string[], "risks": string[], "summaryFa"?: string }',
  ].join('\n');
}

export function validateAutoAddAiAudit(input: unknown): {
  success: boolean;
  data?: AutoAddAiAuditResult;
  errors?: string[];
} {
  const parsed = autoAddAiAuditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return { success: true, data: parsed.data };
}

/**
 * Deterministic mock auditor used by MockAiProvider and offline tests.
 * Fail-closed on rumor/conflict/duplicate; PASS only for strong multi-source or confirmed paths.
 */
export function mockDecideAutoAddAudit(
  input: AutoAddAiAuditInput,
): AutoAddAiAuditResult {
  const official = (input.officialStatus ?? 'UNVERIFIED').toUpperCase();
  const score = input.effectiveFinalScore ?? input.finalScore ?? 0;
  const cred = input.credibilityScore ?? 0;
  const sources = input.independentSourceCount;
  const risks: string[] = [];
  const reasons: string[] = [];

  if (input.isExactOrNearDuplicate) {
    return {
      verdict: 'FAIL',
      confidence: 0.95,
      reasons: ['near_or_exact_duplicate'],
      risks: ['duplicate_slot'],
      summaryFa: 'تکراری — رد ممیزی',
    };
  }
  if (input.hasMajorConflict) {
    return {
      verdict: 'FAIL',
      confidence: 0.92,
      reasons: ['major_conflict'],
      risks: ['conflicting_claims'],
      summaryFa: 'تعارض جدی — رد ممیزی',
    };
  }
  if (official === 'RUMOR' || official === 'FALSE') {
    return {
      verdict: 'FAIL',
      confidence: 0.9,
      reasons: [`official:${official}`],
      risks: ['rumor_or_false'],
      summaryFa: 'شایعه/نادرست — رد ممیزی',
    };
  }
  if (official === 'DISPUTED') {
    return {
      verdict: 'HOLD',
      confidence: 0.7,
      reasons: ['official:DISPUTED'],
      risks: ['disputed_status'],
      summaryFa: 'وضعیت مورد اختلاف — نگه‌داشت',
    };
  }

  const confirmedPath =
    official === 'OFFICIAL' ||
    official === 'CONFIRMED' ||
    official === 'RELIABLE_REPORT' ||
    (official === 'MULTI_SOURCE_REPORT' && sources >= 2);

  const strongMulti =
    sources >= 2 && cred >= 70 && score >= 75 && official !== 'UNVERIFIED';

  const weakUnverified = official === 'UNVERIFIED' && sources < 2;

  if (weakUnverified) {
    return {
      verdict: 'HOLD',
      confidence: 0.68,
      reasons: ['unverified_single_source'],
      risks: ['weak_evidence'],
      summaryFa: 'تأیید نشده و تک‌منبع — نگه‌داشت',
    };
  }

  if (confirmedPath && score >= 80 && cred >= 70) {
    reasons.push('confirmed_or_reliable_path', `score:${score}`, `cred:${cred}`);
    return {
      verdict: 'PASS',
      confidence: Math.min(0.93, 0.72 + sources * 0.05),
      reasons,
      risks,
      summaryFa: 'مسیر قابل اتکا — تأیید ممیزی',
    };
  }

  if (strongMulti && score >= 78) {
    reasons.push('strong_multi_source', `sources:${sources}`);
    return {
      verdict: 'PASS',
      confidence: 0.78,
      reasons,
      risks: risks.length ? risks : ['non_official'],
      summaryFa: 'چندمنبع قوی — تأیید مشروط',
    };
  }

  if (sources >= 2 && score >= 70 && cred >= 65) {
    return {
      verdict: 'HOLD',
      confidence: 0.6,
      reasons: ['borderline_evidence'],
      risks: ['needs_editor'],
      summaryFa: 'مرزی — نگه‌داشت برای سردبیر',
    };
  }

  return {
    verdict: 'HOLD',
    confidence: 0.55,
    reasons: ['insufficient_confidence'],
    risks: ['auto_add_unsafe'],
    summaryFa: 'اطمینان ناکافی — نگه‌داشت',
  };
}

function parseAuditPayload(raw: unknown, content: string): AutoAddAiAuditResult {
  const candidate =
    raw && typeof raw === 'object'
      ? raw
      : (() => {
          try {
            return JSON.parse(content) as unknown;
          } catch {
            return null;
          }
        })();
  const validated = validateAutoAddAiAudit(candidate);
  if (validated.success && validated.data) return validated.data;
  return {
    verdict: 'HOLD',
    confidence: 0,
    reasons: ['ai_audit_parse_failed', ...(validated.errors ?? [])],
    risks: ['invalid_model_output'],
    summaryFa: 'خروجی مدل نامعتبر — نگه‌داشت',
  };
}

/** Call AI provider and normalize to AutoAddAiAuditResult (fail-closed on errors). */
export async function runAutoAddAiAudit(
  provider: AiProvider,
  input: AutoAddAiAuditInput,
): Promise<AutoAddAiAuditResult & { provider: string; model: string; latencyMs: number }> {
  try {
    const result = await provider.complete({
      pipelineStage: AUTO_ADD_AI_AUDIT_STAGE,
      promptVersionId: AUTO_ADD_AI_AUDIT_PROMPT_VERSION,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildAutoAddAuditUserPrompt(input),
      temperature: 0.1,
      maxTokens: 500,
      metadata: {
        newsEventId: input.newsEventId,
        stage: AUTO_ADD_AI_AUDIT_STAGE,
      },
      jsonSchema: {
        type: 'object',
        required: ['verdict', 'confidence', 'reasons', 'risks'],
        properties: {
          verdict: { type: 'string', enum: ['PASS', 'FAIL', 'HOLD'] },
          confidence: { type: 'number' },
          reasons: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          summaryFa: { type: 'string' },
        },
      },
    });
    const audit = parseAuditPayload(result.parsed, result.content);
    return {
      ...audit,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    return {
      verdict: 'HOLD',
      confidence: 0,
      reasons: ['ai_audit_provider_error', message],
      risks: ['provider_failure'],
      summaryFa: 'خطای ارائه‌دهنده — نگه‌داشت',
      provider: provider.name,
      model: 'n/a',
      latencyMs: 0,
    };
  }
}
