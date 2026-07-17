import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op, type WhereOptions } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { createNotification, type Database } from '@footcast/database';
import { scoreNewsEvent } from '@footcast/editorial-rules';
import type { Queue, ScoreEventJobData } from '@footcast/queue';
import { EventStatus } from '@footcast/shared';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import { SCORE_EVENT_QUEUE } from '../queue/queue.tokens.js';

const INBOX_STATUSES = [
  EventStatus.NEW,
  EventStatus.NEEDS_REVIEW,
  EventStatus.CONFLICTED,
  EventStatus.VERIFIED,
];

export interface InboxFilters {
  page?: number;
  pageSize?: number;
  status?: EventStatus;
  scope?: string;
  category?: string;
  officialStatus?: string;
  minImportance?: number;
  q?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class EditorialService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(SCORE_EVENT_QUEUE) private readonly scoreQueue: Queue<ScoreEventJobData>,
  ) {}

  async inbox(filters: InboxFilters) {
    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
    const where: WhereOptions = {
      status: filters.status ?? { [Op.in]: INBOX_STATUSES },
    };
    if (filters.scope) Object.assign(where, { scope: filters.scope });
    if (filters.category) Object.assign(where, { category: filters.category });
    if (filters.officialStatus) Object.assign(where, { officialStatus: filters.officialStatus });
    if (filters.minImportance != null) {
      Object.assign(where, { importanceScore: { [Op.gte]: filters.minImportance } });
    }
    if (filters.q) {
      Object.assign(where, {
        [Op.or]: [
          { title: { [Op.iLike]: `%${filters.q}%` } },
          { summary: { [Op.iLike]: `%${filters.q}%` } },
        ],
      });
    }
    if (filters.from || filters.to) {
      Object.assign(where, {
        lastSeenAt: {
          ...(filters.from ? { [Op.gte]: new Date(filters.from) } : {}),
          ...(filters.to ? { [Op.lte]: new Date(filters.to) } : {}),
        },
      });
    }

    const { rows, count } = await this.db.models.NewsEvent.findAndCountAll({
      where,
      include: [
        {
          association: 'scores',
          separate: true,
          limit: 1,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [
        ['importanceScore', 'DESC'],
        ['lastSeenAt', 'DESC'],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      data: rows.map((row) => {
        const json = row.toJSON() as unknown as Record<string, unknown>;
        const scores = (json.scores as Array<Record<string, unknown>> | undefined) ?? [];
        return {
          ...json,
          latestScore: scores[0] ?? null,
          scores: undefined,
        };
      }),
      meta: { page, pageSize, total: count },
    };
  }

  async selected(page = 1, pageSize = 20) {
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;
    const { rows, count } = await this.db.models.NewsEvent.findAndCountAll({
      where: { status: { [Op.in]: [EventStatus.APPROVED, EventStatus.SELECTED] } },
      order: [
        ['importanceScore', 'DESC'],
        ['updatedAt', 'DESC'],
      ],
      limit,
      offset,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page: Math.max(page, 1), pageSize: limit, total: count },
    };
  }

  async getDetail(eventId: string) {
    const event = await this.db.models.NewsEvent.findByPk(eventId, {
      include: [
        {
          association: 'articles',
          include: [{ association: 'article' }],
        },
        { association: 'conflicts' },
        {
          association: 'scores',
          separate: true,
          limit: 5,
          order: [['createdAt', 'DESC']],
        },
        {
          association: 'decisions',
          separate: true,
          limit: 20,
          order: [['createdAt', 'DESC']],
        },
        {
          association: 'notes',
          separate: true,
          limit: 50,
          order: [['createdAt', 'DESC']],
        },
      ],
    });
    if (!event) throw new NotFoundException('Event not found');
    return event.toJSON();
  }

  async listRules() {
    const rows = await this.db.models.EditorialRule.findAll({
      order: [['code', 'ASC']],
    });
    return rows.map((row) => row.toJSON());
  }

  async listDecisions(page = 1, pageSize = 30) {
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;
    const { rows, count } = await this.db.models.EditorialDecision.findAndCountAll({
      include: [{ association: 'event' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page: Math.max(page, 1), pageSize: limit, total: count },
    };
  }

  async scoreNow(eventId: string) {
    await this.getDetail(eventId);
    const job = await this.scoreQueue.add(
      'score',
      { eventId, reason: 'manual' },
      { jobId: `score-${eventId}-${Date.now()}` },
    );
    return { eventId, queued: true, queue: 'score-event', jobId: String(job.id) };
  }

  async scoreSync(eventId: string) {
    const event = await this.db.models.NewsEvent.findByPk(eventId, {
      include: [
        { association: 'articles' },
        { association: 'conflicts', where: { status: 'open' }, required: false },
      ],
    });
    if (!event) throw new NotFoundException('Event not found');

    const links =
      (event as unknown as { articles?: Array<{ getDataValue: (k: string) => unknown }> })
        .articles ?? [];
    const primaryId =
      event.getDataValue('primaryArticleId') ??
      (links[0]?.getDataValue('articleId') as string | undefined);
    let clubs: string[] = [];
    if (primaryId) {
      const extraction = await this.db.models.ArticleExtraction.findOne({
        where: { articleId: primaryId },
        order: [['createdAt', 'DESC']],
      });
      const card = (extraction?.getDataValue('cardJson') ?? {}) as Record<string, unknown>;
      const raw = card.clubs;
      if (Array.isArray(raw)) {
        clubs = raw
          .map((item) =>
            typeof item === 'string'
              ? item
              : item && typeof item === 'object' && 'name' in item
                ? String((item as { name: unknown }).name)
                : '',
          )
          .filter(Boolean);
      }
    }
    const openConflicts =
      (event as unknown as { conflicts?: unknown[] }).conflicts?.length ?? 0;
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
      hasOpenConflict: openConflicts > 0,
      isDuplicateHeavy: (event.getDataValue('articleCount') ?? 1) > 3,
    });

    const row = await this.db.models.EditorialScore.create({
      id: randomUUID(),
      eventId,
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
        event.getDataValue('status') === EventStatus.NEW
          ? EventStatus.NEEDS_REVIEW
          : event.getDataValue('status'),
    });
    return row.toJSON();
  }

  async decide(
    eventId: string,
    actorUserId: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ) {
    const event = await this.db.models.NewsEvent.findByPk(eventId);
    if (!event) throw new NotFoundException('Event not found');
    const previous = event.getDataValue('status');
    if (
      ![
        EventStatus.NEW,
        EventStatus.NEEDS_REVIEW,
        EventStatus.CONFLICTED,
        EventStatus.VERIFIED,
        EventStatus.APPROVED,
        EventStatus.REJECTED,
      ].includes(previous as EventStatus)
    ) {
      throw new BadRequestException(`Cannot decide from status ${previous}`);
    }

    const nextStatus = decision === 'approve' ? EventStatus.APPROVED : EventStatus.REJECTED;
    await event.update({ status: nextStatus });
    const record = await this.db.models.EditorialDecision.create({
      id: randomUUID(),
      eventId,
      actorUserId,
      decision,
      reason: reason ?? null,
      previousStatus: previous,
      nextStatus,
      metadata: null,
    });
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId,
      action: `editorial.${decision}`,
      entityType: 'NewsEvent',
      entityId: eventId,
      before: { status: previous },
      after: { status: nextStatus, reason: reason ?? null },
      ip: null,
    });
    await createNotification(this.db, {
      type: `editorial.${decision}`,
      title: decision === 'approve' ? 'خبر تأیید شد' : 'خبر رد شد',
      body: event.getDataValue('title'),
      entityType: 'NewsEvent',
      entityId: eventId,
      href: `/inbox/${eventId}`,
      metadata: { decision, actorUserId },
    });
    return {
      event: await this.getDetail(eventId),
      decision: record.toJSON(),
    };
  }

  async addNote(eventId: string, authorUserId: string, body: string) {
    await this.getDetail(eventId);
    if (!body.trim()) throw new BadRequestException('Note body required');
    const note = await this.db.models.EditorialNote.create({
      id: randomUUID(),
      eventId,
      authorUserId,
      body: body.trim(),
    });
    return note.toJSON();
  }
}
