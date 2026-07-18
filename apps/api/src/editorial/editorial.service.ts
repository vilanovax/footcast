import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op, type Includeable, type WhereOptions } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { canCluster, canExtract } from '@footcast/article-pipeline';
import { createNotification, type Database } from '@footcast/database';
import {
  buildEventScoreInput,
  toLegacyPenaltiesRecord,
} from '@footcast/editorial-rules';
import type {
  ClusterEventJobData,
  ExtractArticleJobData,
  Queue,
  ScoreEventJobData,
} from '@footcast/queue';
import { ArticleStatus, EventStatus, countsAsIndependentSource } from '@footcast/shared';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import {
  CLUSTER_EVENT_QUEUE,
  EXTRACT_ARTICLE_QUEUE,
  SCORE_EVENT_QUEUE,
} from '../queue/queue.tokens.js';

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
  /** @deprecated prefer minFinalScore */
  minImportance?: number;
  minFinalScore?: number;
  minCredibilityScore?: number;
  recommendation?: string;
  /** important | suggested — filters automation / recommendation hints */
  automation?: string;
  sourceId?: string;
  hasManualOverride?: boolean;
  q?: string;
  from?: string;
  to?: string;
}

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

@Injectable()
export class EditorialService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(SCORE_EVENT_QUEUE) private readonly scoreQueue: Queue<ScoreEventJobData>,
    @Inject(EXTRACT_ARTICLE_QUEUE)
    private readonly extractQueue: Queue<ExtractArticleJobData>,
    @Inject(CLUSTER_EVENT_QUEUE)
    private readonly clusterQueue: Queue<ClusterEventJobData>,
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
    if (filters.recommendation) Object.assign(where, { recommendation: filters.recommendation });

    const andParts: WhereOptions[] = [];
    const minFinal = filters.minFinalScore ?? filters.minImportance;
    if (minFinal != null) {
      andParts.push({
        [Op.or]: [
          { effectiveFinalScore: { [Op.gte]: minFinal } },
          {
            [Op.and]: [
              { effectiveFinalScore: { [Op.is]: null } },
              { importanceScore: { [Op.gte]: minFinal } },
            ],
          },
        ],
      });
    }
    if (filters.minCredibilityScore != null) {
      Object.assign(where, {
        credibilityScore: { [Op.gte]: filters.minCredibilityScore },
      });
    }
    if (filters.q) {
      andParts.push({
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

    if (filters.hasManualOverride === true) {
      andParts.push({
        id: {
          [Op.in]: this.db.sequelize.literal(
            `(SELECT news_event_id FROM editorial_score_overrides WHERE revoked_at IS NULL)`,
          ),
        },
      });
    }
    if (filters.automation === 'important') {
      andParts.push(
        this.db.sequelize.literal(`(
          "NewsEvent".recommendation IN ('LEAD_STORY','INCLUDE_IN_MAIN_PODCAST','INCLUDE_AS_BRIEF')
          OR ("NewsEvent".metadata->'lastAutomation'->>'highlightBadge')
            IN ('LEAD','IMPORTANT','RUNDOWN_CANDIDATE')
        )`) as unknown as WhereOptions,
      );
    } else if (filters.automation === 'suggested') {
      andParts.push(
        this.db.sequelize.literal(`(
          ("NewsEvent".metadata->'lastAutomation'->>'suggestKind') IN ('ADD','REPLACE')
        )`) as unknown as WhereOptions,
      );
    }
    // Avoid Sequelize distinct+join bug ("missing FROM-clause … NewsEvent->NewsEvent")
    if (filters.sourceId) {
      const sourceIdSql = this.db.sequelize.escape(filters.sourceId);
      andParts.push({
        id: {
          [Op.in]: this.db.sequelize.literal(
            `(SELECT DISTINCT nea.event_id
              FROM news_event_articles AS nea
              INNER JOIN raw_articles AS ra ON ra.id = nea.article_id
              WHERE ra.source_id = ${sourceIdSql})`,
          ),
        },
      });
    }
    if (andParts.length > 0) {
      Object.assign(where, { [Op.and]: andParts });
    }    const include: Includeable[] = [
      {
        association: 'scores',
        separate: true,
        limit: 1,
        order: [['createdAt', 'DESC']],
      },
      {
        association: 'scoreOverrides',
        separate: true,
        limit: 1,
        where: { revokedAt: null },
        required: false,
        order: [['createdAt', 'DESC']],
      },
    ];

    const { rows, count } = await this.db.models.NewsEvent.findAndCountAll({
      where,
      include,
      order: [
        ['effectiveFinalScore', 'DESC'],
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
        const overrides =
          (json.scoreOverrides as Array<Record<string, unknown>> | undefined) ?? [];
        return {
          ...json,
          latestScore: scores[0] ?? null,
          activeOverride: overrides[0] ?? null,
          scores: undefined,
          scoreOverrides: undefined,
          articles: undefined,
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
        ['effectiveFinalScore', 'DESC NULLS LAST'],
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
          include: [{ association: 'article', include: [{ association: 'source' }] }],
        },
        { association: 'conflicts' },
        {
          association: 'scores',
          separate: true,
          limit: 5,
          order: [['createdAt', 'DESC']],
        },
        {
          association: 'scoreOverrides',
          separate: true,
          limit: 10,
          order: [['createdAt', 'DESC']],
        },
        {
          association: 'timelineItems',
          separate: true,
          limit: 20,
          order: [
            ['occurredAt', 'DESC'],
            ['createdAt', 'DESC'],
          ],
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
    const json = event.toJSON() as unknown as Record<string, unknown>;
    const overrides =
      (json.scoreOverrides as Array<Record<string, unknown>> | undefined) ?? [];
    const timeline =
      (json.timelineItems as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      ...json,
      activeOverride: overrides.find((o) => o.revokedAt == null) ?? null,
      latestDevelopment: timeline[0] ?? null,
    };
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

  private async gatherSourcesForEvent(eventId: string) {
    const links = await this.db.models.NewsEventArticle.findAll({
      where: { eventId },
      include: [{ association: 'article', include: [{ association: 'source' }] }],
    });
    return links
      .map((link) => {
        if (!countsAsIndependentSource(link.getDataValue('role'))) return null;
        const article = (
          link as unknown as {
            article?: {
              source?: { getDataValue: (k: string) => unknown };
            };
          }
        ).article;
        const src = article?.source;
        if (!src) return null;
        return {
          sourceId: String(src.getDataValue('id')),
          credibilitySeed: Number(src.getDataValue('credibilitySeed') ?? 50),
          sourceType: String(src.getDataValue('sourceType') ?? ''),
        };
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }

  async scoreSync(eventId: string) {
    const event = await this.db.models.NewsEvent.findByPk(eventId, {
      include: [
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
    if (!event) throw new NotFoundException('Event not found');

    const sources = await this.gatherSourcesForEvent(eventId);
    const links = await this.db.models.NewsEventArticle.findAll({
      where: { eventId },
      limit: 1,
      order: [['createdAt', 'ASC']],
    });
    const primaryId =
      event.getDataValue('primaryArticleId') ??
      (links[0]?.getDataValue('articleId') as string | undefined);

    let clubs: string[] = [];
    let people: string[] = [];
    let aiImportanceHint: number | null = null;
    let aiCredibilityHint: number | null = null;
    let hasDirectQuote = false;

    if (primaryId) {
      const extraction = await this.db.models.ArticleExtraction.findOne({
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

    const row = await this.db.models.EditorialScore.create({
      id: randomUUID(),
      eventId,
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
        reason: 'manual-sync',
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
      importanceScore: Math.round(effectiveFinal),
      credibilityScore: Math.round(scored.credibilityScore),
      freshnessScore: Math.round(Number(scored.breakdown.freshness ?? 70)),
      podcastValueScore: scored.podcastValueScore,
      effectiveFinalScore: effectiveFinal,
      recommendation: scored.recommendation,
      status:
        event.getDataValue('status') === EventStatus.NEW
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
          policyVersion: scored.policyVersion,
        },
      },
    });

    return row.toJSON();
  }

  async setScoreOverride(
    eventId: string,
    userId: string,
    overriddenFinalScore: number,
    reason: string,
  ) {
    if (!reason.trim()) throw new BadRequestException('Reason required');
    if (overriddenFinalScore < 0 || overriddenFinalScore > 100) {
      throw new BadRequestException('Score must be 0–100');
    }
    const event = await this.db.models.NewsEvent.findByPk(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.db.models.EditorialScoreOverride.findAll({
      where: { newsEventId: eventId, revokedAt: null },
    });
    for (const row of existing) {
      await row.update({ revokedAt: new Date() });
    }

    const automatic =
      event.getDataValue('effectiveFinalScore') ??
      event.getDataValue('importanceScore') ??
      0;

    const override = await this.db.models.EditorialScoreOverride.create({
      id: randomUUID(),
      newsEventId: eventId,
      automaticFinalScore: Number(automatic),
      overriddenFinalScore,
      reason: reason.trim(),
      userId,
      revokedAt: null,
    });

    await event.update({
      effectiveFinalScore: overriddenFinalScore,
      importanceScore: Math.round(overriddenFinalScore),
    });

    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'editorial.score_override',
      entityType: 'NewsEvent',
      entityId: eventId,
      before: { automaticFinalScore: automatic },
      after: { overriddenFinalScore, reason: reason.trim() },
      ip: null,
    });

    return override.toJSON();
  }

  async revokeScoreOverride(eventId: string, userId: string) {
    const event = await this.db.models.NewsEvent.findByPk(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const active = await this.db.models.EditorialScoreOverride.findOne({
      where: { newsEventId: eventId, revokedAt: null },
      order: [['createdAt', 'DESC']],
    });
    if (!active) throw new NotFoundException('No active override');

    await active.update({ revokedAt: new Date() });

    const latestScore = await this.db.models.EditorialScore.findOne({
      where: { eventId },
      order: [['createdAt', 'DESC']],
    });
    const restored =
      latestScore?.getDataValue('finalScore') ??
      Number(active.getDataValue('automaticFinalScore'));

    await event.update({
      effectiveFinalScore: restored,
      importanceScore: Math.round(restored),
    });

    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'editorial.score_override_revoke',
      entityType: 'NewsEvent',
      entityId: eventId,
      before: { overriddenFinalScore: active.getDataValue('overriddenFinalScore') },
      after: { effectiveFinalScore: restored },
      ip: null,
    });

    return { revoked: true, effectiveFinalScore: restored };
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

  private normalizeEventIds(eventIds: string[]): string[] {
    const unique = [...new Set(eventIds.filter(Boolean))];
    if (unique.length === 0) throw new BadRequestException('eventIds required');
    if (unique.length > 50) throw new BadRequestException('Max 50 events per bulk action');
    return unique;
  }

  async bulkDecide(
    eventIds: string[],
    actorUserId: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ) {
    const ids = this.normalizeEventIds(eventIds);
    const results: Array<{ eventId: string; ok: boolean; error?: string }> = [];
    for (const eventId of ids) {
      try {
        await this.decide(eventId, actorUserId, decision, reason);
        results.push({ eventId, ok: true });
      } catch (err) {
        results.push({
          eventId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return {
      action: decision,
      total: ids.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async bulkScore(eventIds: string[]) {
    const ids = this.normalizeEventIds(eventIds);
    const results: Array<{ eventId: string; ok: boolean; jobId?: string; error?: string }> =
      [];
    for (const eventId of ids) {
      try {
        const event = await this.db.models.NewsEvent.findByPk(eventId);
        if (!event) throw new NotFoundException('Event not found');
        const job = await this.scoreQueue.add(
          'score',
          { eventId, reason: 'manual' },
          { jobId: `score-${eventId}-${Date.now()}` },
        );
        results.push({ eventId, ok: true, jobId: String(job.id) });
      } catch (err) {
        results.push({
          eventId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return {
      action: 'score',
      total: ids.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  private async articleIdsForEvents(eventIds: string[]): Promise<string[]> {
    const links = await this.db.models.NewsEventArticle.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      attributes: ['articleId', 'role', 'eventId'],
    });
    const byEvent = new Map<string, string[]>();
    for (const link of links) {
      const eid = link.getDataValue('eventId');
      const aid = link.getDataValue('articleId');
      const list = byEvent.get(eid) ?? [];
      if (link.getDataValue('role') === 'PRIMARY') list.unshift(aid);
      else list.push(aid);
      byEvent.set(eid, list);
    }
    const out = new Set<string>();
    for (const eid of eventIds) {
      const list = byEvent.get(eid) ?? [];
      // primary first, then up to 2 supporting — enough to refresh the event
      for (const aid of list.slice(0, 3)) out.add(aid);
    }
    return [...out];
  }

  async bulkReextract(
    eventIds: string[],
    opts?: { recluster?: boolean; actorUserId?: string },
  ) {
    const ids = this.normalizeEventIds(eventIds);
    const articleIds = await this.articleIdsForEvents(ids);
    if (articleIds.length === 0) {
      throw new BadRequestException('No articles linked to selected events');
    }

    const results: Array<{
      articleId: string;
      ok: boolean;
      jobId?: string;
      error?: string;
    }> = [];

    for (const articleId of articleIds) {
      try {
        const article = await this.db.models.RawArticle.findByPk(articleId, {
          include: [{ association: 'content' }],
        });
        if (!article) throw new NotFoundException('Article not found');
        const status = article.getDataValue('status') as ArticleStatus;
        if (!canExtract(status)) {
          throw new BadRequestException(`Cannot extract from status ${status}`);
        }
        const content = (article as unknown as { content?: unknown }).content;
        if (!content) {
          throw new BadRequestException('Parsed content missing; run parse first');
        }
        const job = await this.extractQueue.add(
          'extract',
          { articleId, reason: 'manual' },
          { jobId: `extract-${articleId}-${Date.now()}` },
        );
        results.push({ articleId, ok: true, jobId: String(job.id) });
      } catch (err) {
        results.push({
          articleId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (opts?.actorUserId) {
      await this.db.models.AuditLog.create({
        id: randomUUID(),
        actorUserId: opts.actorUserId,
        action: 'editorial.bulk_reextract',
        entityType: 'NewsEvent',
        entityId: ids[0]!,
        before: { eventIds: ids },
        after: {
          articleIds,
          succeeded: results.filter((r) => r.ok).length,
          recluster: Boolean(opts?.recluster),
        },
        ip: null,
      });
    }

    return {
      action: 'reextract',
      eventCount: ids.length,
      articleCount: articleIds.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      note: opts?.recluster
        ? 'Extract queued; clustering runs automatically after each extract completes'
        : 'Extract queued; use «کلاستر مجدد» if you only need re-clustering',
      results,
    };
  }

  async bulkRecluster(eventIds: string[]) {
    const ids = this.normalizeEventIds(eventIds);
    const articleIds = await this.articleIdsForEvents(ids);
    const results: Array<{
      articleId: string;
      ok: boolean;
      jobId?: string;
      error?: string;
    }> = [];

    for (const articleId of articleIds) {
      try {
        const article = await this.db.models.RawArticle.findByPk(articleId);
        if (!article) throw new NotFoundException('Article not found');
        const status = article.getDataValue('status') as ArticleStatus;
        if (!canCluster(status)) {
          throw new BadRequestException(`Cannot cluster from status ${status}`);
        }
        const job = await this.clusterQueue.add(
          'cluster',
          { articleId, reason: 'manual' },
          { jobId: `cluster-${articleId}-${Date.now()}` },
        );
        results.push({ articleId, ok: true, jobId: String(job.id) });
      } catch (err) {
        results.push({
          articleId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      action: 'recluster',
      eventCount: ids.length,
      articleCount: articleIds.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async reextractEvent(eventId: string, actorUserId?: string) {
    return this.bulkReextract([eventId], { recluster: true, actorUserId });
  }
}
