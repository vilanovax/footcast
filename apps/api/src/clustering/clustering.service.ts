import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { randomUUID } from 'node:crypto';
import type { Database } from '@footcast/database';
import {
  computeEvaluationMetrics,
  normalizeForMatch,
} from '@footcast/event-clustering';
import { CLUSTERING_POLICY } from '@footcast/shared';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

export type CreateEvaluationInput = {
  rawArticleId: string;
  expectedRelationship: string;
  verdict: string;
  expectedEventId?: string | null;
  note?: string | null;
  reviewerId?: string | null;
};

@Injectable()
export class ClusteringService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async listQueue(page = 1, pageSize = 20) {
    const limit = Math.min(Math.max(pageSize, 1), 50);
    const offset = (Math.max(page, 1) - 1) * limit;

    const evaluated = await this.db.models.ClusteringEvaluation.findAll({
      attributes: ['rawArticleId'],
      group: ['rawArticleId'],
      raw: true,
    });
    const evaluatedIds = new Set(
      evaluated.map((r) => String((r as unknown as { rawArticleId: string }).rawArticleId)),
    );

    const logs = await this.db.models.ClusterDecisionLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 500,
    });

    const pending = logs.filter((l) => !evaluatedIds.has(l.getDataValue('rawArticleId')));
    const slice = pending.slice(offset, offset + limit);
    const articleIds = slice.map((l) => l.getDataValue('rawArticleId'));
    const articles = articleIds.length
      ? await this.db.models.RawArticle.findAll({
          where: { id: { [Op.in]: articleIds } },
          include: [{ association: 'source' }],
        })
      : [];
    const byId = new Map(articles.map((a) => [a.getDataValue('id'), a]));

    return {
      data: slice.map((log) => {
        const article = byId.get(log.getDataValue('rawArticleId'));
        const source = (
          article as unknown as { source?: { getDataValue: (k: string) => unknown } }
        )?.source;
        return {
          decisionLog: log.toJSON(),
          article: article
            ? {
                id: article.getDataValue('id'),
                title: article.getDataValue('title'),
                canonicalUrl: article.getDataValue('canonicalUrl'),
                publishedAt: article.getDataValue('publishedAt'),
                status: article.getDataValue('status'),
                source: source
                  ? {
                      id: source.getDataValue('id'),
                      name: source.getDataValue('name'),
                    }
                  : null,
              }
            : null,
        };
      }),
      meta: {
        page: Math.max(page, 1),
        pageSize: limit,
        total: pending.length,
        policyVersion: CLUSTERING_POLICY.version,
        targets: CLUSTERING_POLICY.targets,
      },
    };
  }

  async getReviewItem(rawArticleId: string) {
    const article = await this.db.models.RawArticle.findByPk(rawArticleId, {
      include: [{ association: 'source' }],
    });
    if (!article) throw new NotFoundException('Article not found');

    const log = await this.db.models.ClusterDecisionLog.findOne({
      where: { rawArticleId },
      order: [['createdAt', 'DESC']],
    });
    const link = await this.db.models.NewsEventArticle.findOne({
      where: { articleId: rawArticleId },
    });
    const eventId =
      log?.getDataValue('selectedEventId') ?? link?.getDataValue('eventId') ?? null;
    const event = eventId
      ? await this.db.models.NewsEvent.findByPk(eventId, {
          include: [
            {
              association: 'articles',
              include: [{ association: 'article', include: [{ association: 'source' }] }],
            },
            {
              association: 'timelineItems',
              separate: true,
              limit: 20,
              order: [['occurredAt', 'DESC']],
            },
          ],
        })
      : null;
    const extraction = await this.db.models.ArticleExtraction.findOne({
      where: { articleId: rawArticleId },
      order: [['createdAt', 'DESC']],
    });
    const evaluations = await this.db.models.ClusteringEvaluation.findAll({
      where: { rawArticleId },
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    return {
      article: article.toJSON(),
      extraction: extraction?.toJSON() ?? null,
      decisionLog: log?.toJSON() ?? null,
      event: event?.toJSON() ?? null,
      link: link?.toJSON() ?? null,
      evaluations: evaluations.map((e) => e.toJSON()),
      policyVersion: CLUSTERING_POLICY.version,
    };
  }

  async createEvaluation(input: CreateEvaluationInput) {
    const article = await this.db.models.RawArticle.findByPk(input.rawArticleId);
    if (!article) throw new NotFoundException('Article not found');

    const log = await this.db.models.ClusterDecisionLog.findOne({
      where: { rawArticleId: input.rawArticleId },
      order: [['createdAt', 'DESC']],
    });
    const link = await this.db.models.NewsEventArticle.findOne({
      where: { articleId: input.rawArticleId },
    });

    const row = await this.db.models.ClusteringEvaluation.create({
      id: randomUUID(),
      rawArticleId: input.rawArticleId,
      predictedEventId:
        log?.getDataValue('selectedEventId') ?? link?.getDataValue('eventId') ?? null,
      predictedRelationship:
        log?.getDataValue('relationship') ??
        link?.getDataValue('relationshipDecision') ??
        null,
      predictedScore: log?.getDataValue('finalSimilarity') ?? null,
      expectedEventId: input.expectedEventId ?? null,
      expectedRelationship: input.expectedRelationship,
      verdict: input.verdict,
      reviewerId: input.reviewerId ?? null,
      note: input.note ?? null,
      decisionLogId: log?.getDataValue('id') ?? null,
    });
    return row.toJSON();
  }

  async listEvaluations(page = 1, pageSize = 50) {
    const limit = Math.min(Math.max(pageSize, 1), 200);
    const offset = (Math.max(page, 1) - 1) * limit;
    const { rows, count } = await this.db.models.ClusteringEvaluation.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return {
      data: rows.map((r) => r.toJSON()),
      meta: { page: Math.max(page, 1), pageSize: limit, total: count },
    };
  }

  async exportEvaluations(format: 'json' | 'csv' = 'json') {
    const rows = await this.db.models.ClusteringEvaluation.findAll({
      order: [['createdAt', 'ASC']],
      limit: 5000,
    });
    const data = rows.map((r) => r.toJSON());
    if (format === 'json') return { format: 'json', data };
    const headers = [
      'id',
      'rawArticleId',
      'predictedEventId',
      'predictedRelationship',
      'predictedScore',
      'expectedEventId',
      'expectedRelationship',
      'verdict',
      'note',
      'createdAt',
    ];
    const lines = [headers.join(',')];
    for (const row of data) {
      const rec = row as unknown as Record<string, unknown>;
      lines.push(
        headers
          .map((h) => {
            const v = rec[h];
            const s = v == null ? '' : String(v).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(','),
      );
    }
    return { format: 'csv', csv: lines.join('\n'), count: data.length };
  }

  async metrics(filters?: {
    relationship?: string;
    aiUsed?: boolean;
    scoreMin?: number;
    scoreMax?: number;
    from?: string;
    to?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.relationship) where.expectedRelationship = filters.relationship;
    if (filters?.from || filters?.to) {
      where.createdAt = {
        ...(filters.from ? { [Op.gte]: new Date(filters.from) } : {}),
        ...(filters.to ? { [Op.lte]: new Date(filters.to) } : {}),
      };
    }
    if (filters?.scoreMin != null || filters?.scoreMax != null) {
      where.predictedScore = {
        ...(filters.scoreMin != null ? { [Op.gte]: filters.scoreMin } : {}),
        ...(filters.scoreMax != null ? { [Op.lte]: filters.scoreMax } : {}),
      };
    }

    let rows = await this.db.models.ClusteringEvaluation.findAll({ where });
    if (filters?.aiUsed != null) {
      const logIds = rows
        .map((r) => r.getDataValue('decisionLogId'))
        .filter((id): id is string => Boolean(id));
      const logs = logIds.length
        ? await this.db.models.ClusterDecisionLog.findAll({
            where: { id: { [Op.in]: logIds }, aiUsed: filters.aiUsed },
            attributes: ['id'],
          })
        : [];
      const ok = new Set(logs.map((l) => l.getDataValue('id')));
      rows = rows.filter((r) => {
        const id = r.getDataValue('decisionLogId');
        return id ? ok.has(id) : !filters.aiUsed;
      });
    }

    const computed = computeEvaluationMetrics(
      rows.map((row) => ({
        verdict: row.getDataValue('verdict'),
        expectedRelationship: row.getDataValue('expectedRelationship'),
        predictedRelationship: row.getDataValue('predictedRelationship'),
      })),
    );
    const {
      evaluatedCount: total,
      byVerdict,
      falseMergeRate: falseMerge,
      missedMergeRate: missedMerge,
      wrongRelationshipRate: wrongRel,
      exactDuplicatePrecision,
      exactDuplicateRecall,
      nearDuplicatePrecision,
      nearDuplicateRecall,
      sameEventPrecision,
      sameEventRecall,
      newDevelopmentPrecision,
      newDevelopmentRecall,
    } = computed;

    const logWhere: Record<string, unknown> = {};
    if (filters?.aiUsed != null) logWhere.aiUsed = filters.aiUsed;
    if (filters?.from || filters?.to) {
      logWhere.createdAt = {
        ...(filters.from ? { [Op.gte]: new Date(filters.from) } : {}),
        ...(filters.to ? { [Op.lte]: new Date(filters.to) } : {}),
      };
    }

    const logs = await this.db.models.ClusterDecisionLog.findAll({
      attributes: [
        'decision',
        'aiUsed',
        'processingDurationMs',
        'candidateSnapshot',
      ],
      where: logWhere,
      limit: 2000,
      order: [['createdAt', 'DESC']],
    });
    let aiBoundary = 0;
    let autoMerge = 0;
    let newEvent = 0;
    let candSum = 0;
    let latencySum = 0;
    for (const log of logs) {
      const d = log.getDataValue('decision');
      if (log.getDataValue('aiUsed')) aiBoundary += 1;
      if (d === 'attach') autoMerge += 1;
      if (d === 'create') newEvent += 1;
      const snap = log.getDataValue('candidateSnapshot');
      if (Array.isArray(snap)) candSum += snap.length;
      latencySum += log.getDataValue('processingDurationMs') ?? 0;
    }
    const nLogs = Math.max(1, logs.length);

    return {
      evaluatedCount: total,
      policyVersion: CLUSTERING_POLICY.version,
      targets: CLUSTERING_POLICY.targets,
      filters: filters ?? {},
      byVerdict,
      exactDuplicatePrecision,
      exactDuplicateRecall,
      nearDuplicatePrecision,
      nearDuplicateRecall,
      sameEventPrecision,
      sameEventRecall,
      newDevelopmentPrecision,
      newDevelopmentRecall,
      falseMergeRate: falseMerge,
      missedMergeRate: missedMerge,
      wrongRelationshipRate: wrongRel,
      aiBoundaryRate: aiBoundary / nLogs,
      autoMergeRate: autoMerge / nLogs,
      newEventRate: newEvent / nLogs,
      averageCandidateCount: candSum / nLogs,
      averageClusteringLatency: latencySum / nLogs,
      meetsTargets:
        total >= 100
          ? {
              exactDuplicateRecall:
                (exactDuplicateRecall ?? 0) >=
                CLUSTERING_POLICY.targets.exactDuplicateRecall,
              nearDuplicateRecall:
                (nearDuplicateRecall ?? 0) >=
                CLUSTERING_POLICY.targets.nearDuplicateRecall,
              sameEventRecall:
                (sameEventRecall ?? 0) >= CLUSTERING_POLICY.targets.sameEventRecall,
              newDevelopmentRecall:
                (newDevelopmentRecall ?? 0) >=
                CLUSTERING_POLICY.targets.newDevelopmentRecall,
              falseMergeRate:
                falseMerge <= CLUSTERING_POLICY.targets.falseMergeRateMax,
            }
          : { insufficientData: true, need: 100, have: total },
    };
  }

  async errorReport() {
    const rows = await this.db.models.ClusteringEvaluation.findAll({
      where: {
        verdict: { [Op.in]: ['WRONG_MERGE', 'MISSED_MERGE', 'WRONG_RELATIONSHIP'] },
      },
      limit: 500,
      order: [['createdAt', 'DESC']],
    });
    const byVerdict: Record<string, number> = {};
    const missedCandidate: string[] = [];
    const falseMerges: string[] = [];
    for (const row of rows) {
      const v = row.getDataValue('verdict');
      byVerdict[v] = (byVerdict[v] ?? 0) + 1;
      const note = row.getDataValue('note') ?? '';
      if (v === 'WRONG_MERGE') falseMerges.push(String(row.getDataValue('rawArticleId')));
      if (v === 'MISSED_MERGE') missedCandidate.push(String(row.getDataValue('rawArticleId')));
      if (/alias|entity/i.test(note)) {
        // counted below via note scan
      }
    }
    const aliasHints = rows.filter((r) =>
      /alias|entity|پرسپولیس|استقلال/i.test(r.getDataValue('note') ?? ''),
    ).length;
    const embeddingHints = rows.filter((r) =>
      /embed|semantic|vector/i.test(r.getDataValue('note') ?? ''),
    ).length;
    const ruleHints = rows.filter((r) =>
      /rule|threshold|policy/i.test(r.getDataValue('note') ?? ''),
    ).length;

    return {
      evaluatedErrors: rows.length,
      byVerdict,
      falseMergeArticleIds: falseMerges.slice(0, 50),
      missedMergeArticleIds: missedCandidate.slice(0, 50),
      hypothesisCounts: {
        aliasGaps: aliasHints,
        embeddingIssues: embeddingHints,
        ruleOrThreshold: ruleHints,
      },
      guidance: {
        falseMergePriority: 'False Merge > Missed Merge — tighten autoMerge before raising recall',
        nextSteps: [
          'Inspect WRONG_MERGE notes for shared-entity false positives',
          'Add EntityAlias for recurring FA/EN name variants',
          'Bump CLUSTERING_POLICY.version when changing thresholds',
          'Re-run fixture suite + export evaluations after policy change',
        ],
      },
      policyVersion: CLUSTERING_POLICY.version,
    };
  }

  async listEntities() {
    const rows = await this.db.models.Entity.findAll({
      include: [{ association: 'aliases' }],
      order: [['canonicalName', 'ASC']],
    });
    return rows.map((r) => r.toJSON());
  }

  async createEntity(input: {
    type: string;
    canonicalName: string;
    aliases?: Array<{ alias: string; language?: string }>;
  }) {
    const id = randomUUID();
    const normalizedName = normalizeForMatch(input.canonicalName);
    if (!normalizedName) throw new BadRequestException('Invalid name');
    await this.db.models.Entity.create({
      id,
      type: input.type,
      canonicalName: input.canonicalName.trim(),
      normalizedName,
      externalId: null,
      isActive: true,
    });
    for (const a of input.aliases ?? []) {
      await this.db.models.EntityAlias.create({
        id: randomUUID(),
        entityId: id,
        alias: a.alias.trim(),
        normalizedAlias: normalizeForMatch(a.alias),
        language: a.language ?? null,
        sourceId: null,
      });
    }
    return this.db.models.Entity.findByPk(id, {
      include: [{ association: 'aliases' }],
    }).then((r) => r?.toJSON());
  }

  async addAlias(entityId: string, alias: string, language?: string) {
    const entity = await this.db.models.Entity.findByPk(entityId);
    if (!entity) throw new NotFoundException('Entity not found');
    const normalizedAlias = normalizeForMatch(alias);
    if (!normalizedAlias) throw new BadRequestException('Invalid alias');
    const row = await this.db.models.EntityAlias.create({
      id: randomUUID(),
      entityId,
      alias: alias.trim(),
      normalizedAlias,
      language: language ?? null,
      sourceId: null,
    });
    return row.toJSON();
  }

  async searchEvents(q: string, limit = 20) {
    const rows = await this.db.models.NewsEvent.findAll({
      where: {
        status: { [Op.notIn]: ['MERGED', 'ARCHIVED'] },
        ...(q.trim()
          ? { title: { [Op.iLike]: `%${q.trim()}%` } }
          : {}),
      },
      order: [['lastSeenAt', 'DESC']],
      limit: Math.min(limit, 50),
    });
    return rows.map((r) => r.toJSON());
  }

  /**
   * Backfill minimal ClusterDecisionLog rows from existing NewsEventArticle links
   * so the evaluation queue can review articles clustered before PR-B.
   */
  async backfillDecisionLogs(limit = 500) {
    const existing = await this.db.models.ClusterDecisionLog.findAll({
      attributes: ['rawArticleId'],
      group: ['rawArticleId'],
      raw: true,
    });
    const have = new Set(
      existing.map((r) => String((r as unknown as { rawArticleId: string }).rawArticleId)),
    );
    const links = await this.db.models.NewsEventArticle.findAll({
      order: [['createdAt', 'DESC']],
      limit: Math.min(Math.max(limit, 1), 2000),
    });
    let created = 0;
    for (const link of links) {
      const articleId = link.getDataValue('articleId');
      if (have.has(articleId)) continue;
      await this.db.models.ClusterDecisionLog.create({
        id: randomUUID(),
        rawArticleId: articleId,
        selectedEventId: link.getDataValue('eventId'),
        decision: 'attach',
        relationship:
          link.getDataValue('relationshipDecision') ??
          link.getDataValue('role') ??
          null,
        finalSimilarity: link.getDataValue('similarityScore'),
        similarityBreakdown:
          (link.getDataValue('similarityBreakdown') as Record<string, unknown> | null) ??
          null,
        candidateSnapshot: null,
        thresholdPolicyVersion: 'pre-2.1.0-backfill',
        aiUsed: false,
        aiProvider: null,
        aiModel: null,
        aiConfidence: null,
        reason: 'backfill_from_news_event_article',
        processingDurationMs: null,
      });
      have.add(articleId);
      created += 1;
    }
    return {
      created,
      policyVersion: CLUSTERING_POLICY.version,
      note: 'Historical rows tagged thresholdPolicyVersion=pre-2.1.0-backfill',
    };
  }
}
