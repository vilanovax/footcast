import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canCluster } from '@footcast/article-pipeline';
import type { Database } from '@footcast/database';
import type { ClusterEventJobData, Queue } from '@footcast/queue';
import { ArticleStatus, EventStatus } from '@footcast/shared';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import { CLUSTER_EVENT_QUEUE } from '../queue/queue.tokens.js';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(CLUSTER_EVENT_QUEUE)
    private readonly clusterQueue: Queue<ClusterEventJobData>,
  ) {}

  async list(page = 1, pageSize = 20, status?: EventStatus) {
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;
    const where = status ? { status } : {};
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
          include: [{ association: 'article' }],
        },
        { association: 'conflicts' },
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

  async merge(sourceEventId: string, targetEventId: string) {
    if (sourceEventId === targetEventId) {
      throw new BadRequestException('Cannot merge an event into itself');
    }
    const source = await this.db.models.NewsEvent.findByPk(sourceEventId);
    const target = await this.db.models.NewsEvent.findByPk(targetEventId);
    if (!source || !target) throw new NotFoundException('Event not found');

    const links = await this.db.models.NewsEventArticle.findAll({
      where: { eventId: sourceEventId },
    });
    for (const link of links) {
      await link.update({
        eventId: targetEventId,
        role: 'duplicate',
        matchMethod: 'manual',
      });
    }

    await this.db.models.NewsEventConflict.update(
      { status: 'resolved', resolvedAt: new Date(), otherEventId: targetEventId },
      { where: { eventId: sourceEventId, status: 'open' } },
    );

    const count = await this.db.models.NewsEventArticle.count({
      where: { eventId: targetEventId },
    });
    await target.update({
      articleCount: count,
      lastSeenAt: new Date(),
      importanceScore: Math.max(
        target.getDataValue('importanceScore') ?? 0,
        source.getDataValue('importanceScore') ?? 0,
      ),
      credibilityScore: Math.max(
        target.getDataValue('credibilityScore') ?? 0,
        source.getDataValue('credibilityScore') ?? 0,
      ),
      status:
        target.getDataValue('status') === EventStatus.CONFLICTED
          ? EventStatus.NEEDS_REVIEW
          : target.getDataValue('status'),
      metadata: {
        ...(target.getDataValue('metadata') ?? {}),
        mergedFrom: sourceEventId,
      },
    });
    await source.update({
      status: EventStatus.ARCHIVED,
      articleCount: 0,
      metadata: {
        ...(source.getDataValue('metadata') ?? {}),
        mergedInto: targetEventId,
      },
    });

    return this.get(targetEventId);
  }

  async split(eventId: string, articleId: string) {
    const link = await this.db.models.NewsEventArticle.findOne({
      where: { eventId, articleId },
    });
    if (!link) throw new NotFoundException('Article not linked to this event');

    const event = await this.db.models.NewsEvent.findByPk(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const article = await this.db.models.RawArticle.findByPk(articleId);
    const extraction = await this.db.models.ArticleExtraction.findOne({
      where: { articleId },
      order: [['createdAt', 'DESC']],
    });
    const now = new Date();
    const newEventId = cryptoRandomUuid();
    const title =
      extraction?.getDataValue('headlineFa') ??
      article?.getDataValue('title') ??
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
      primaryArticleId: articleId,
      articleCount: 1,
      fingerprint: null,
      metadata: { splitFrom: eventId },
      firstSeenAt: now,
      lastSeenAt: now,
    });

    await link.update({
      eventId: newEventId,
      role: 'primary',
      matchMethod: 'manual',
      similarityScore: null,
    });

    await this.db.models.NewsEventConflict.update(
      { status: 'resolved', resolvedAt: now, details: { resolution: 'split', newEventId } },
      { where: { eventId, articleId, status: 'open' } },
    );

    const remaining = await this.db.models.NewsEventArticle.count({ where: { eventId } });
    await event.update({
      articleCount: remaining,
      lastSeenAt: now,
      status: remaining > 0 ? EventStatus.NEEDS_REVIEW : EventStatus.ARCHIVED,
    });

    return {
      sourceEvent: await this.get(eventId),
      newEvent: await this.get(newEventId),
    };
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
      const result = await this.split(eventId, articleId);
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
        { role: 'duplicate', matchMethod: 'manual' },
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
