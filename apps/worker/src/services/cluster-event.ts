import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { assertTransition } from '@footcast/article-pipeline';
import type { Database } from '@footcast/database';
import {
  contentFingerprint,
  cosineSimilarity,
  decideClusterAction,
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  embeddingTextFromCard,
  entityOverlap,
  mockEmbed,
  titleSimilarity,
  withinHours,
  type CandidateScore,
} from '@footcast/event-clustering';
import type { Logger } from '@footcast/logger';
import type { ClusterEventJobData, Queue, ScoreEventJobData } from '@footcast/queue';
import { ArticleStatus, EventStatus } from '@footcast/shared';

async function enqueueScore(
  scoreQueue: Queue<ScoreEventJobData> | null,
  eventId: string,
): Promise<void> {
  if (!scoreQueue) return;
  await scoreQueue.add(
    'score',
    { eventId, reason: 'cluster_complete' },
    { jobId: `score-${eventId}-${Date.now()}` },
  );
}

const LOOKBACK_DAYS = 14;
const TIME_WINDOW_HOURS = 96;
const CANDIDATE_LIMIT = 120;

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

export async function processClusterEventJob(
  db: Database,
  logger: Logger,
  scoreQueue: Queue<ScoreEventJobData> | null,
  data: ClusterEventJobData,
): Promise<void> {
  const article = await db.models.RawArticle.findByPk(data.articleId, {
    include: [{ association: 'source' }],
  });
  if (!article) {
    logger.warn('Article missing for cluster', { articleId: data.articleId });
    return;
  }

  const status = article.getDataValue('status');
  if (status === ArticleStatus.IRRELEVANT) {
    logger.info('Skip cluster for irrelevant article', { articleId: data.articleId });
    return;
  }
  if (status !== ArticleStatus.EXTRACTED && status !== ArticleStatus.DUPLICATE) {
    throw new Error(`Cannot cluster from status ${status}`);
  }

  const existingLink = await db.models.NewsEventArticle.findOne({
    where: { articleId: data.articleId },
  });
  if (existingLink && data.reason !== 'manual') {
    logger.info('Article already linked to event', {
      articleId: data.articleId,
      eventId: existingLink.getDataValue('eventId'),
    });
    return;
  }

  const extraction = await db.models.ArticleExtraction.findOne({
    where: { articleId: data.articleId },
    order: [['createdAt', 'DESC']],
  });
  if (!extraction) {
    throw new Error('Extraction missing; run extract first');
  }

  const card = extraction.getDataValue('cardJson') ?? {};
  const headline = extraction.getDataValue('headlineFa') ?? article.getDataValue('title') ?? 'Untitled';
  const summary = extraction.getDataValue('summaryFa') ?? '';
  const category = extraction.getDataValue('category');
  const scope = extraction.getDataValue('scope');
  const clubs = namesFromCard(card, 'clubs');
  const people = namesFromCard(card, 'people');
  const fingerprint = contentFingerprint([headline, summary, category ?? '']);
  const embedText = embeddingTextFromCard({
    headlineFa: headline,
    summaryFa: summary,
    category,
    clubs,
    people,
  });
  const embedding = mockEmbed(embedText);

  await db.models.ArticleEmbedding.upsert({
    articleId: data.articleId,
    extractionId: extraction.getDataValue('id'),
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMS,
    embedding,
    contentHash: fingerprint,
  });

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const hashHit = await db.models.ArticleEmbedding.findOne({
    where: {
      contentHash: fingerprint,
      articleId: { [Op.ne]: data.articleId },
    },
  });

  let candidates: CandidateScore[] = [];
  if (hashHit) {
    const linked = await db.models.NewsEventArticle.findOne({
      where: { articleId: hashHit.getDataValue('articleId') },
    });
    if (linked) {
      candidates.push({
        eventId: linked.getDataValue('eventId'),
        articleId: hashHit.getDataValue('articleId'),
        contentHashMatch: true,
        titleSimilarity: 1,
        entityOverlap: 1,
        embeddingSimilarity: 1,
        sameCategory: true,
        withinTimeWindow: true,
      });
    }
  }

  if (candidates.length === 0) {
    const recentLinks = await db.models.NewsEventArticle.findAll({
      include: [
        {
          association: 'event',
          required: true,
          where: {
            lastSeenAt: { [Op.gte]: since },
          },
        },
        { association: 'article', required: true },
      ],
      limit: CANDIDATE_LIMIT,
      order: [['createdAt', 'DESC']],
    });

    const articleIds = recentLinks.map((row) => row.getDataValue('articleId'));
    const embeddings = articleIds.length
      ? await db.models.ArticleEmbedding.findAll({
          where: { articleId: { [Op.in]: articleIds } },
        })
      : [];
    const embedByArticle = new Map(
      embeddings.map((row) => [row.getDataValue('articleId'), row.getDataValue('embedding')]),
    );
    const extractionRows = articleIds.length
      ? await db.models.ArticleExtraction.findAll({
          where: { articleId: { [Op.in]: articleIds } },
          order: [['createdAt', 'DESC']],
        })
      : [];
    const extractionByArticle = new Map<string, (typeof extractionRows)[number]>();
    for (const row of extractionRows) {
      const id = row.getDataValue('articleId');
      if (!extractionByArticle.has(id)) extractionByArticle.set(id, row);
    }

    const articleTime = article.getDataValue('publishedAt') ?? article.getDataValue('discoveredAt');
    for (const link of recentLinks) {
      const otherArticleId = link.getDataValue('articleId');
      if (otherArticleId === data.articleId) continue;
      const event = (link as unknown as { event?: { getDataValue: (k: string) => unknown } }).event;
      const otherArticle = (
        link as unknown as { article?: { getDataValue: (k: string) => unknown } }
      ).article;
      if (!event) continue;
      const otherExtraction = extractionByArticle.get(otherArticleId);
      const otherCard = (otherExtraction?.getDataValue('cardJson') ?? {}) as Record<string, unknown>;
      const otherHeadline =
        otherExtraction?.getDataValue('headlineFa') ??
        String(otherArticle?.getDataValue('title') ?? '');
      const otherEmbed = embedByArticle.get(otherArticleId) ?? [];
      const otherTime =
        (otherArticle?.getDataValue('publishedAt') as Date | null | undefined) ??
        (otherArticle?.getDataValue('discoveredAt') as Date | null | undefined);

      candidates.push({
        eventId: String(event.getDataValue('id')),
        articleId: otherArticleId,
        contentHashMatch: false,
        titleSimilarity: titleSimilarity(headline, otherHeadline),
        entityOverlap: Math.max(
          entityOverlap(clubs, namesFromCard(otherCard, 'clubs')),
          entityOverlap(people, namesFromCard(otherCard, 'people')),
        ),
        embeddingSimilarity: cosineSimilarity(embedding, otherEmbed),
        sameCategory: Boolean(category) && category === event.getDataValue('category'),
        withinTimeWindow: withinHours(articleTime, otherTime ?? null, TIME_WINDOW_HOURS),
      });
    }
  }

  const decision = decideClusterAction(candidates);
  const now = new Date();

  if (existingLink && data.reason === 'manual') {
    await existingLink.destroy();
  }

  if (decision.kind === 'create' || !decision.eventId) {
    const eventId = randomUUID();
    await db.models.NewsEvent.create({
      id: eventId,
      title: headline.slice(0, 500),
      summary: summary || null,
      status: EventStatus.NEW,
      scope,
      category,
      officialStatus: extraction.getDataValue('officialStatus'),
      importanceScore: extraction.getDataValue('importanceScore'),
      credibilityScore: extraction.getDataValue('credibilityScore'),
      freshnessScore: extraction.getDataValue('freshnessScore'),
      primaryArticleId: data.articleId,
      articleCount: 1,
      fingerprint,
      metadata: {
        createdBy: 'cluster-event',
        reason: data.reason ?? 'extract_complete',
        decision,
      },
      firstSeenAt: now,
      lastSeenAt: now,
    });
    await db.models.NewsEventArticle.create({
      id: randomUUID(),
      eventId,
      articleId: data.articleId,
      extractionId: extraction.getDataValue('id'),
      role: 'primary',
      matchMethod: null,
      similarityScore: null,
    });
    if (status !== ArticleStatus.EXTRACTED) {
      assertTransition(status, ArticleStatus.EXTRACTED);
      await article.update({ status: ArticleStatus.EXTRACTED, errorMessage: null });
    }
    await enqueueScore(scoreQueue, eventId);
    logger.info('Created news event', {
      articleId: data.articleId,
      eventId,
      decision: decision.reason,
    });
    return;
  }

  const event = await db.models.NewsEvent.findByPk(decision.eventId);
  if (!event) {
    throw new Error(`Target event missing: ${decision.eventId}`);
  }

  if (decision.kind === 'merge') {
    await db.models.NewsEventArticle.create({
      id: randomUUID(),
      eventId: decision.eventId,
      articleId: data.articleId,
      extractionId: extraction.getDataValue('id'),
      role: 'duplicate',
      matchMethod: decision.method,
      similarityScore: decision.score,
    });

    const articleCount = event.getDataValue('articleCount') + 1;
    const credibility = Math.min(
      100,
      Math.max(
        event.getDataValue('credibilityScore') ?? 0,
        extraction.getDataValue('credibilityScore') ?? 0,
      ) + (articleCount > 1 ? 5 : 0),
    );
    await event.update({
      articleCount,
      lastSeenAt: now,
      credibilityScore: credibility,
      importanceScore: Math.max(
        event.getDataValue('importanceScore') ?? 0,
        extraction.getDataValue('importanceScore') ?? 0,
      ),
      metadata: {
        ...(event.getDataValue('metadata') ?? {}),
        lastMerge: { articleId: data.articleId, decision },
      },
    });

    if (status !== ArticleStatus.DUPLICATE) {
      assertTransition(status, ArticleStatus.DUPLICATE);
      await article.update({ status: ArticleStatus.DUPLICATE, errorMessage: null });
    }

    await enqueueScore(scoreQueue, decision.eventId);
    logger.info('Merged article into event', {
      articleId: data.articleId,
      eventId: decision.eventId,
      method: decision.method,
      score: decision.score,
    });
    return;
  }

  // conflict: attach as related + open conflict for editorial review
  await db.models.NewsEventArticle.create({
    id: randomUUID(),
    eventId: decision.eventId,
    articleId: data.articleId,
    extractionId: extraction.getDataValue('id'),
    role: 'related',
    matchMethod: decision.method,
    similarityScore: decision.score,
  });
  await db.models.NewsEventConflict.create({
    id: randomUUID(),
    eventId: decision.eventId,
    articleId: data.articleId,
    otherEventId: null,
    conflictType: 'ambiguous_match',
    status: 'open',
    details: { decision, candidates: candidates.slice(0, 5) },
    resolvedAt: null,
  });
  await event.update({
    status: EventStatus.CONFLICTED,
    articleCount: event.getDataValue('articleCount') + 1,
    lastSeenAt: now,
    metadata: {
      ...(event.getDataValue('metadata') ?? {}),
      lastConflict: { articleId: data.articleId, decision },
    },
  });
  if (status !== ArticleStatus.EXTRACTED) {
    assertTransition(status, ArticleStatus.EXTRACTED);
    await article.update({ status: ArticleStatus.EXTRACTED, errorMessage: null });
  }

  await enqueueScore(scoreQueue, decision.eventId);
  logger.info('Cluster conflict opened', {
    articleId: data.articleId,
    eventId: decision.eventId,
    score: decision.score,
  });
}
