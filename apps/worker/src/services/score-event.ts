import { randomUUID } from 'node:crypto';
import type { Database } from '@footcast/database';
import {
  buildEventScoreInput,
  toLegacyPenaltiesRecord,
} from '@footcast/editorial-rules';
import type { Logger } from '@footcast/logger';
import type { ScoreEventJobData } from '@footcast/queue';
import { EventStatus, countsAsIndependentSource } from '@footcast/shared';
import { applyEditorialAutomationAfterScore } from './apply-editorial-automation.js';

function namesFromCard(card: Record<string, unknown>, key: 'clubs' | 'people'): string[] {
  const raw = card[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name: unknown }).name);
      }
      return '';
    })
    .filter(Boolean);
}

export async function processScoreEventJob(
  db: Database,
  logger: Logger,
  data: ScoreEventJobData,
): Promise<void> {
  const event = await db.models.NewsEvent.findByPk(data.eventId, {
    include: [
      {
        association: 'articles',
        include: [{ association: 'article', include: [{ association: 'source' }] }],
      },
      { association: 'conflicts', where: { status: 'open' }, required: false },
      {
        association: 'scoreOverrides',
        where: { revokedAt: null },
        required: false,
        limit: 1,
        order: [['createdAt', 'DESC']],
      },
    ],
  });
  if (!event) {
    logger.warn('Event missing for score', { eventId: data.eventId });
    return;
  }

  const links =
    (
      event as unknown as {
        articles?: Array<{
          getDataValue: (k: string) => unknown;
          article?: {
            getDataValue: (k: string) => unknown;
            source?: { getDataValue: (k: string) => unknown };
          };
        }>;
      }
    ).articles ?? [];

  const sources = links
    .map((link) => {
      const role = String(link.getDataValue('role') ?? '');
      if (!countsAsIndependentSource(role)) return null;
      const src = link.article?.source;
      if (!src) return null;
      return {
        sourceId: String(src.getDataValue('id')),
        credibilitySeed: Number(src.getDataValue('credibilitySeed') ?? 50),
        sourceType: String(src.getDataValue('sourceType') ?? ''),
      };
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const primaryId =
    event.getDataValue('primaryArticleId') ??
    (links[0]?.getDataValue('articleId') as string | undefined);

  let clubs: string[] = [];
  let people: string[] = [];
  let aiImportanceHint: number | null = null;
  let aiCredibilityHint: number | null = null;
  let hasDirectQuote = false;

  if (primaryId) {
    const extraction = await db.models.ArticleExtraction.findOne({
      where: { articleId: primaryId },
      order: [['createdAt', 'DESC']],
    });
    const card = (extraction?.getDataValue('cardJson') ?? {}) as Record<string, unknown>;
    clubs = namesFromCard(card, 'clubs');
    people = namesFromCard(card, 'people');
    if (typeof card.importanceScore === 'number') aiImportanceHint = card.importanceScore;
    if (typeof card.credibilityScore === 'number') aiCredibilityHint = card.credibilityScore;
    hasDirectQuote = Array.isArray(card.quotes) && card.quotes.length > 0;
  }

  const openConflicts =
    (event as unknown as { conflicts?: unknown[] }).conflicts?.length ?? 0;

  const { result: scored } = buildEventScoreInput({
    title: event.getDataValue('title'),
    summary: event.getDataValue('summary'),
    scope: event.getDataValue('scope'),
    category: event.getDataValue('category'),
    officialStatus: event.getDataValue('officialStatus'),
    freshnessScore: event.getDataValue('freshnessScore'),
    aiImportanceHint,
    aiCredibilityHint,
    lastSeenAt: event.getDataValue('lastSeenAt'),
    clubs,
    people,
    hasOpenConflict: openConflicts > 0,
    hasDirectQuote,
    sources,
  });

  await db.models.EditorialScore.create({
    id: randomUUID(),
    eventId: data.eventId,
    finalScore: scored.finalScore,
    credibilityScore: scored.credibilityScore,
    importanceScore: scored.importanceScore,
    podcastValueScore: scored.podcastValueScore,
    rawFinalScore: scored.rawFinalScore,
    totalBonus: scored.totalBonus,
    totalPenalty: scored.totalPenalty,
    recommendation: scored.recommendation,
    factors: scored.factors,
    penalties: toLegacyPenaltiesRecord(scored.penalties),
    ruleHits: scored.ruleHits,
    breakdown: scored.breakdown,
    reasons: scored.reasons,
    bonuses: scored.bonuses,
    penaltyItems: scored.penalties,
    inputSnapshot: {
      sourceCount: sources.length,
      independentSources: scored.breakdown.independentCount,
      reason: data.reason ?? 'manual',
    },
    scorerVersion: scored.policyVersion,
  });

  const activeOverride = (
    event as unknown as {
      scoreOverrides?: Array<{ getDataValue: (k: string) => unknown }>;
    }
  ).scoreOverrides?.[0];
  const effectiveFinal = activeOverride
    ? Number(activeOverride.getDataValue('overriddenFinalScore'))
    : scored.finalScore;

  await event.update({
    // legacy field = effective final for sorting/compat
    importanceScore: Math.round(effectiveFinal),
    credibilityScore: Math.round(scored.credibilityScore),
    freshnessScore: Math.round(Number(scored.breakdown.freshness ?? 70)),
    podcastValueScore: scored.podcastValueScore,
    effectiveFinalScore: effectiveFinal,
    recommendation: scored.recommendation,
    status:
      event.getDataValue('status') === EventStatus.CONFLICTED
        ? EventStatus.CONFLICTED
        : event.getDataValue('status') === EventStatus.NEW
          ? EventStatus.NEEDS_REVIEW
          : event.getDataValue('status'),
    metadata: {
      ...(event.getDataValue('metadata') ?? {}),
      lastScore: {
        finalScore: scored.finalScore,
        credibilityScore: scored.credibilityScore,
        importanceScore: scored.importanceScore,
        podcastValueScore: scored.podcastValueScore,
        recommendation: scored.recommendation,
        ruleHits: scored.ruleHits,
        reason: data.reason ?? 'manual',
        policyVersion: scored.policyVersion,
      },
    },
  });

  logger.info('Event scored', {
    eventId: data.eventId,
    finalScore: scored.finalScore,
    effectiveFinal,
    credibilityScore: scored.credibilityScore,
    recommendation: scored.recommendation,
    ruleHits: scored.ruleHits,
  });

  try {
    await applyEditorialAutomationAfterScore(db, logger, data.eventId);
  } catch (err) {
    logger.error('Editorial automation after score failed', {
      eventId: data.eventId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
