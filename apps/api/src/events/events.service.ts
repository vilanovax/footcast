import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { canCluster } from '@footcast/article-pipeline';
import type { Database } from '@footcast/database';
import type { ClusterEventJobData, Queue, ScoreEventJobData } from '@footcast/queue';
import { ArticleStatus, EventStatus, countsAsIndependentSource } from '@footcast/shared';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import {
  CLUSTER_EVENT_QUEUE,
  SCORE_EVENT_QUEUE,
} from '../queue/queue.tokens.js';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(CLUSTER_EVENT_QUEUE)
    private readonly clusterQueue: Queue<ClusterEventJobData>,
    @Inject(SCORE_EVENT_QUEUE)
    private readonly scoreQueue: Queue<ScoreEventJobData>,
  ) {}

  async list(page = 1, pageSize = 20, status?: EventStatus) {
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;
    const where = status
      ? { status }
      : { status: { [Op.ne]: EventStatus.MERGED } };
    const { rows, count } = await this.db.models.NewsEvent.findAndCountAll({
      where,
      order: [['lastSeenAt', 'DESC']],
      limit,
      offset,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page: Math.max(page, 1), pageSize: limit, total: count },
    };
  }

  async get(id: string) {
    const event = await this.db.models.NewsEvent.findByPk(id, {
      include: [
        {
          association: 'articles',
          include: [{ association: 'article', include: [{ association: 'source' }] }],
        },
        { association: 'conflicts' },
        {
          association: 'timelineItems',
          separate: true,
          limit: 30,
          order: [
            ['occurredAt', 'DESC'],
            ['createdAt', 'DESC'],
          ],
        },
      ],
    });
    if (!event) throw new NotFoundException('Event not found');
    return event.toJSON();
  }

  async listArticles(id: string) {
    await this.get(id);
    const rows = await this.db.models.NewsEventArticle.findAll({
      where: { eventId: id },
      include: [{ association: 'article' }],
      order: [['createdAt', 'ASC']],
    });
    return rows.map((row) => row.toJSON());
  }

  async listConflicts(status = 'open') {
    const rows = await this.db.models.NewsEventConflict.findAll({
      where: { status },
      include: [{ association: 'event' }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return rows.map((row) => row.toJSON());
  }

  async enqueueCluster(articleId: string) {
    const article = await this.db.models.RawArticle.findByPk(articleId);
    if (!article) throw new NotFoundException('Article not found');
    const status = article.getDataValue('status');
    if (!canCluster(status)) {
      throw new BadRequestException(`Cannot cluster from status ${status}`);
    }
    const job = await this.clusterQueue.add(
      'cluster',
      { articleId, reason: 'manual' },
      { jobId: `cluster-${articleId}-${Date.now()}` },
    );
    return {
      articleId,
      queued: true,
      queue: 'cluster-event',
      jobId: String(job.id),
    };
  }

  private async recountIndependent(eventId: string): Promise<number> {
    const links = await this.db.models.NewsEventArticle.findAll({
      where: { eventId },
      include: [{ association: 'article', attributes: ['sourceId'] }],
    });
    const ids = new Set<string>();
    for (const link of links) {
      if (!countsAsIndependentSource(link.getDataValue('role'))) continue;
      const article = (
        link as unknown as { article?: { getDataValue: (k: string) => unknown } }
      ).article;
      const sid = article?.getDataValue('sourceId');
      if (sid) ids.add(String(sid));
    }
    return Math.max(1, ids.size || 1);
  }

  private async enqueueScore(eventId: string) {
    await this.scoreQueue.add(
      'score',
      { eventId, reason: 'manual' },
      { jobId: `score-${eventId}-${Date.now()}` },
    );
  }

  async mergeMany(
    primaryEventId: string,
    secondaryEventIds: string[],
    reason: string,
    actorUserId?: string,
  ) {
    if (!reason.trim()) throw new BadRequestException('Reason required');
    const uniqueSecondaries = [...new Set(secondaryEventIds)].filter(
      (id) => id !== primaryEventId,
    );
    if (uniqueSecondaries.length === 0) {
      throw new BadRequestException('No secondary events to merge');
    }

    const primary = await this.db.models.NewsEvent.findByPk(primaryEventId);
    if (!primary) throw new NotFoundException('Primary event not found');
    if (primary.getDataValue('status') === EventStatus.MERGED) {
      throw new BadRequestException('Primary event is already merged');
    }

    for (const secondaryId of uniqueSecondaries) {
      const secondary = await this.db.models.NewsEvent.findByPk(secondaryId);
      if (!secondary) throw new NotFoundException(`Event not found: ${secondaryId}`);
      if (secondary.getDataValue('status') === EventStatus.MERGED) {
        // idempotent: already merged into someone
        if (secondary.getDataValue('mergedIntoEventId') === primaryEventId) continue;
        throw new BadRequestException(`Event already merged: ${secondaryId}`);
      }
      // prevent cycle: primary already merged into secondary
      if (primary.getDataValue('mergedIntoEventId') === secondaryId) {
        throw new BadRequestException('Merge would create a cycle');
      }

      const links = await this.db.models.NewsEventArticle.findAll({
        where: { eventId: secondaryId },
      });
      for (const link of links) {
        const articleId = link.getDataValue('articleId');
        const existing = await this.db.models.NewsEventArticle.findOne({
          where: { articleId, eventId: primaryEventId },
        });
        if (existing) {
          await link.destroy();
          continue;
        }
        await link.update({
          eventId: primaryEventId,
          role:
            link.getDataValue('role') === 'PRIMARY'
              ? 'SUPPORTING'
              : link.getDataValue('role'),
          matchMethod: 'manual',
        });
      }

      await this.db.models.EventTimelineItem.update(
        { newsEventId: primaryEventId },
        { where: { newsEventId: secondaryId } },
      );

      await this.db.models.NewsEventConflict.update(
        {
          status: 'resolved',
          resolvedAt: new Date(),
          otherEventId: primaryEventId,
          details: { resolution: 'manual_merge', reason },
        },
        { where: { eventId: secondaryId, status: 'open' } },
      );

      await secondary.update({
        status: EventStatus.MERGED,
        mergedIntoEventId: primaryEventId,
        articleCount: 0,
        metadata: {
          ...(secondary.getDataValue('metadata') ?? {}),
          mergedInto: primaryEventId,
          mergeReason: reason,
        },
      });
    }

    const count = await this.db.models.NewsEventArticle.count({
      where: { eventId: primaryEventId },
    });
    const independentSourceCount = await this.recountIndependent(primaryEventId);
    await primary.update({
      articleCount: count,
      independentSourceCount,
      lastSeenAt: new Date(),
      status:
        primary.getDataValue('status') === EventStatus.CONFLICTED
          ? EventStatus.NEEDS_REVIEW
          : primary.getDataValue('status'),
      metadata: {
        ...(primary.getDataValue('metadata') ?? {}),
        lastManualMerge: { secondaryEventIds: uniqueSecondaries, reason },
      },
    });

    if (actorUserId) {
      await this.db.models.AuditLog.create({
        id: cryptoRandomUuid(),
        actorUserId,
        action: 'events.merge',
        entityType: 'NewsEvent',
        entityId: primaryEventId,
        before: { secondaryEventIds: uniqueSecondaries },
        after: { reason },
        ip: null,
      });
    }

    await this.enqueueScore(primaryEventId);
    return this.get(primaryEventId);
  }

  /** @deprecated prefer mergeMany */
  async merge(sourceEventId: string, targetEventId: string) {
    return this.mergeMany(targetEventId, [sourceEventId], 'legacy merge endpoint');
  }

  async splitMany(
    eventId: string,
    articleIds: string[],
    reason: string,
    newHeadline?: string,
    actorUserId?: string,
  ) {
    if (!reason.trim()) throw new BadRequestException('Reason required');
    const uniqueArticles = [...new Set(articleIds)];
    if (uniqueArticles.length === 0) {
      throw new BadRequestException('articleIds required');
    }

    const event = await this.db.models.NewsEvent.findByPk(eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (event.getDataValue('status') === EventStatus.MERGED) {
      throw new BadRequestException('Cannot split a merged event');
    }

    const remainingBefore = await this.db.models.NewsEventArticle.count({
      where: { eventId },
    });
    if (remainingBefore - uniqueArticles.length < 1) {
      throw new BadRequestException('At least one article must remain on the source event');
    }

    const firstArticleId = uniqueArticles[0]!;
    const article = await this.db.models.RawArticle.findByPk(firstArticleId);
    const extraction = await this.db.models.ArticleExtraction.findOne({
      where: { articleId: firstArticleId },
      order: [['createdAt', 'DESC']],
    });
    const now = new Date();
    const newEventId = cryptoRandomUuid();
    const title =
      newHeadline?.trim() ||
      extraction?.getDataValue('headlineFa') ||
      article?.getDataValue('title') ||
      'Split event';

    await this.db.models.NewsEvent.create({
      id: newEventId,
      title: String(title).slice(0, 500),
      summary: extraction?.getDataValue('summaryFa') ?? null,
      status: EventStatus.NEEDS_REVIEW,
      scope: extraction?.getDataValue('scope') ?? null,
      category: extraction?.getDataValue('category') ?? null,
      officialStatus: extraction?.getDataValue('officialStatus') ?? null,
      importanceScore: extraction?.getDataValue('importanceScore') ?? null,
      credibilityScore: extraction?.getDataValue('credibilityScore') ?? null,
      freshnessScore: extraction?.getDataValue('freshnessScore') ?? null,
      primaryArticleId: firstArticleId,
      articleCount: uniqueArticles.length,
      independentSourceCount: 1,
      fingerprint: null,
      metadata: { splitFrom: eventId, reason },
      firstSeenAt: now,
      lastSeenAt: now,
      mergedIntoEventId: null,
    });

    for (const articleId of uniqueArticles) {
      const link = await this.db.models.NewsEventArticle.findOne({
        where: { eventId, articleId },
      });
      if (!link) {
        throw new NotFoundException(`Article not linked to this event: ${articleId}`);
      }
      await link.update({
        eventId: newEventId,
        role: articleId === firstArticleId ? 'PRIMARY' : 'SUPPORTING',
        matchMethod: 'manual',
        similarityScore: null,
      });
      await this.db.models.EventTimelineItem.update(
        { newsEventId: newEventId },
        { where: { newsEventId: eventId, rawArticleId: articleId } },
      );
      await this.db.models.NewsEventConflict.update(
        {
          status: 'resolved',
          resolvedAt: now,
          details: { resolution: 'split', newEventId, reason },
        },
        { where: { eventId, articleId, status: 'open' } },
      );
    }

    const remaining = await this.db.models.NewsEventArticle.count({ where: { eventId } });
    await event.update({
      articleCount: remaining,
      independentSourceCount: await this.recountIndependent(eventId),
      lastSeenAt: now,
      status: EventStatus.NEEDS_REVIEW,
    });
    await this.db.models.NewsEvent.update(
      {
        independentSourceCount: await this.recountIndependent(newEventId),
      },
      { where: { id: newEventId } },
    );

    if (actorUserId) {
      await this.db.models.AuditLog.create({
        id: cryptoRandomUuid(),
        actorUserId,
        action: 'events.split',
        entityType: 'NewsEvent',
        entityId: eventId,
        before: { articleIds: uniqueArticles },
        after: { newEventId, reason },
        ip: null,
      });
    }

    await this.enqueueScore(eventId);
    await this.enqueueScore(newEventId);

    return {
      sourceEvent: await this.get(eventId),
      newEvent: await this.get(newEventId),
    };
  }

  async split(eventId: string, articleId: string) {
    return this.splitMany(eventId, [articleId], 'legacy split endpoint');
  }

  async resolveConflict(conflictId: string, resolution: 'confirm_merge' | 'split' | 'dismiss') {
    const conflict = await this.db.models.NewsEventConflict.findByPk(conflictId);
    if (!conflict) throw new NotFoundException('Conflict not found');
    if (conflict.getDataValue('status') !== 'open') {
      throw new BadRequestException('Conflict already resolved');
    }

    const eventId = conflict.getDataValue('eventId');
    const articleId = conflict.getDataValue('articleId');

    if (resolution === 'split') {
      const result = await this.splitMany(eventId, [articleId], 'conflict split');
      await conflict.update({
        status: 'resolved',
        resolvedAt: new Date(),
        details: {
          ...(conflict.getDataValue('details') ?? {}),
          resolution,
        },
      });
      return result;
    }

    if (resolution === 'confirm_merge') {
      await this.db.models.NewsEventArticle.update(
        { role: 'NEAR_DUPLICATE', matchMethod: 'manual' },
        { where: { eventId, articleId } },
      );
      await this.db.models.RawArticle.update(
        { status: ArticleStatus.DUPLICATE },
        { where: { id: articleId } },
      );
    }

    await conflict.update({
      status: 'resolved',
      resolvedAt: new Date(),
      details: {
        ...(conflict.getDataValue('details') ?? {}),
        resolution,
      },
    });

    const openCount = await this.db.models.NewsEventConflict.count({
      where: { eventId, status: 'open' },
    });
    if (openCount === 0) {
      await this.db.models.NewsEvent.update(
        { status: EventStatus.NEEDS_REVIEW },
        { where: { id: eventId, status: EventStatus.CONFLICTED } },
      );
    }

    return this.get(eventId);
  }
}

function cryptoRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}
