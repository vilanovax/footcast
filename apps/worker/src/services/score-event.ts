import { randomUUID } from 'node:crypto';
import type { Database } from '@footcast/database';
import { scoreNewsEvent } from '@footcast/editorial-rules';
import type { Logger } from '@footcast/logger';
import type { ScoreEventJobData } from '@footcast/queue';
import { EventStatus } from '@footcast/shared';

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
      { association: 'articles' },
      { association: 'conflicts', where: { status: 'open' }, required: false },
    ],
  });
  if (!event) {
    logger.warn('Event missing for score', { eventId: data.eventId });
    return;
  }

  const links = (
    event as unknown as { articles?: Array<{ getDataValue: (k: string) => unknown }> }
  ).articles ?? [];
  const primaryId =
    event.getDataValue('primaryArticleId') ??
    (links[0]?.getDataValue('articleId') as string | undefined);

  let clubs: string[] = [];
  let people: string[] = [];
  if (primaryId) {
    const extraction = await db.models.ArticleExtraction.findOne({
      where: { articleId: primaryId },
      order: [['createdAt', 'DESC']],
    });
    const card = (extraction?.getDataValue('cardJson') ?? {}) as Record<string, unknown>;
    clubs = namesFromCard(card, 'clubs');
    people = namesFromCard(card, 'people');
  }

  const openConflicts = (
    event as unknown as { conflicts?: unknown[] }
  ).conflicts?.length ?? 0;

  const scored = scoreNewsEvent({
    title: event.getDataValue('title'),
    summary: event.getDataValue('summary'),
    scope: event.getDataValue('scope'),
    category: event.getDataValue('category'),
    officialStatus: event.getDataValue('officialStatus'),
    importanceScore: event.getDataValue('importanceScore'),
    credibilityScore: event.getDataValue('credibilityScore'),
    freshnessScore: event.getDataValue('freshnessScore'),
    articleCount: event.getDataValue('articleCount'),
    clubs,
    people,
    hasOpenConflict: openConflicts > 0,
    isDuplicateHeavy: (event.getDataValue('articleCount') ?? 1) > 3,
  });

  await db.models.EditorialScore.create({
    id: randomUUID(),
    eventId: data.eventId,
    finalScore: scored.finalScore,
    factors: scored.factors as unknown as Record<string, unknown>,
    penalties: scored.penalties as unknown as Record<string, unknown>,
    ruleHits: scored.ruleHits,
    breakdown: scored.breakdown,
    scorerVersion: '1.0.0',
  });

  await event.update({
    importanceScore: scored.finalScore,
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
        ruleHits: scored.ruleHits,
        reason: data.reason ?? 'manual',
      },
    },
  });

  logger.info('Event scored', {
    eventId: data.eventId,
    finalScore: scored.finalScore,
    ruleHits: scored.ruleHits,
  });
}
