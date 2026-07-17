import { Inject, Injectable } from '@nestjs/common';
import { Op, type Database } from '@footcast/database';
import { col, fn, literal } from 'sequelize';
import {
  computeAcceptanceRate,
  crawlSuccessRate,
  roundMetric,
  sumTokens,
} from '@footcast/reporting';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async overview(days = 7) {
    const since = daysAgo(days);
    const [cost, inputTokens, outputTokens, avgLatency, approve, reject, published] =
      await Promise.all([
        this.db.models.AiRequest.sum('estimatedCost', {
          where: { createdAt: { [Op.gte]: since } },
        }),
        this.db.models.AiRequest.sum('inputTokens', {
          where: { createdAt: { [Op.gte]: since } },
        }),
        this.db.models.AiRequest.sum('outputTokens', {
          where: { createdAt: { [Op.gte]: since } },
        }),
        this.db.models.AiRequest.findOne({
          attributes: [[fn('AVG', col('latency_ms')), 'avgLatencyMs']],
          where: { createdAt: { [Op.gte]: since } },
          raw: true,
        }) as Promise<{ avgLatencyMs?: string | number } | null>,
        this.db.models.EditorialDecision.count({
          where: { decision: 'approve', createdAt: { [Op.gte]: since } },
        }),
        this.db.models.EditorialDecision.count({
          where: { decision: 'reject', createdAt: { [Op.gte]: since } },
        }),
        this.db.models.PodcastPublication.count({
          where: { publishedAt: { [Op.gte]: since } },
        }),
      ]);

    const acceptance = computeAcceptanceRate({ approve, reject });
    return {
      days,
      cost: roundMetric(Number(cost ?? 0), 6) ?? 0,
      tokens: sumTokens({
        inputTokens: Number(inputTokens ?? 0),
        outputTokens: Number(outputTokens ?? 0),
      }),
      avgLatencyMs: roundMetric(Number(avgLatency?.avgLatencyMs ?? 0) || null, 1),
      editorial: {
        ...acceptance,
        acceptanceRatePct:
          acceptance.rate === null ? null : roundMetric(acceptance.rate * 100, 1),
      },
      episodesPublished: published,
    };
  }

  async modelPerformance(days = 7) {
    const since = daysAgo(days);
    const rows = (await this.db.models.AiRequest.findAll({
      attributes: [
        'pipelineStage',
        'provider',
        'model',
        [fn('COUNT', col('AiRequest.id')), 'requests'],
        [fn('SUM', col('AiRequest.input_tokens')), 'inputTokens'],
        [fn('SUM', col('AiRequest.output_tokens')), 'outputTokens'],
        [fn('SUM', col('AiRequest.estimated_cost')), 'estimatedCost'],
        [fn('AVG', col('AiRequest.latency_ms')), 'avgLatencyMs'],
        [
          fn(
            'SUM',
            literal(
              `CASE WHEN "AiRequest"."status" IN ('error','failed') THEN 1 ELSE 0 END`,
            ),
          ),
          'errors',
        ],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: ['pipelineStage', 'provider', 'model'],
      order: [[literal('"estimatedCost"'), 'DESC NULLS LAST']],
      raw: true,
    })) as unknown as Array<Record<string, unknown>>;

    return {
      days,
      models: rows.map((row) => {
        const inputTokens = Number(row.inputTokens ?? 0);
        const outputTokens = Number(row.outputTokens ?? 0);
        const requests = Number(row.requests ?? 0);
        const errors = Number(row.errors ?? 0);
        return {
          pipelineStage: String(row.pipelineStage ?? ''),
          provider: String(row.provider ?? ''),
          model: String(row.model ?? ''),
          requests,
          inputTokens,
          outputTokens,
          tokens: sumTokens({ inputTokens, outputTokens }),
          estimatedCost: roundMetric(Number(row.estimatedCost ?? 0), 6) ?? 0,
          avgLatencyMs: roundMetric(Number(row.avgLatencyMs ?? 0) || null, 1),
          errorRate:
            requests === 0 ? null : roundMetric(errors / requests, 4),
        };
      }),
    };
  }

  async sourcePerformance(days = 7) {
    const since = daysAgo(days);
    const sources = await this.db.models.Source.findAll({
      attributes: ['id', 'name', 'slug', 'isActive'],
      include: [{ association: 'health' }],
      order: [['name', 'ASC']],
    });

    const aggs = (await this.db.models.CrawlRun.findAll({
      attributes: [
        'sourceId',
        [fn('COUNT', col('CrawlRun.id')), 'runs'],
        [fn('SUM', col('CrawlRun.discovered_count')), 'discovered'],
        [fn('SUM', col('CrawlRun.fetched_count')), 'fetched'],
        [fn('SUM', col('CrawlRun.error_count')), 'errors'],
        [
          literal(
            `AVG(EXTRACT(EPOCH FROM ("CrawlRun"."finished_at" - "CrawlRun"."started_at")) * 1000)`,
          ),
          'avgDurationMs',
        ],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: ['sourceId'],
      raw: true,
    })) as unknown as Array<Record<string, unknown>>;

    const bySource = new Map(aggs.map((row) => [String(row.sourceId), row]));

    const articleCounts = (await this.db.models.RawArticle.findAll({
      attributes: [
        'sourceId',
        [fn('COUNT', col('RawArticle.id')), 'articles'],
        [
          fn(
            'SUM',
            literal(
              `CASE WHEN "RawArticle"."status" = 'FAILED' THEN 1 ELSE 0 END`,
            ),
          ),
          'failedArticles',
        ],
      ],
      where: { discoveredAt: { [Op.gte]: since } },
      group: ['sourceId'],
      raw: true,
    })) as unknown as Array<Record<string, unknown>>;
    const articlesBySource = new Map(
      articleCounts.map((row) => [String(row.sourceId), row]),
    );

    return {
      days,
      sources: sources.map((source) => {
        const id = source.getDataValue('id');
        const crawl = bySource.get(id);
        const arts = articlesBySource.get(id);
        const discovered = Number(crawl?.discovered ?? 0);
        const errors = Number(crawl?.errors ?? 0);
        const json = source.toJSON() as {
          health?: { status?: string; consecutiveFailures?: number } | null;
        };
        return {
          id,
          name: source.getDataValue('name'),
          slug: source.getDataValue('slug'),
          isActive: source.getDataValue('isActive'),
          healthStatus: json.health?.status ?? null,
          consecutiveFailures: Number(json.health?.consecutiveFailures ?? 0),
          runs: Number(crawl?.runs ?? 0),
          discovered,
          fetched: Number(crawl?.fetched ?? 0),
          errors,
          successRate: crawlSuccessRate(discovered, errors),
          avgDurationMs: roundMetric(Number(crawl?.avgDurationMs ?? 0) || null, 1),
          articles: Number(arts?.articles ?? 0),
          failedArticles: Number(arts?.failedArticles ?? 0),
        };
      }),
    };
  }

  async episodeCosts(days = 30) {
    const since = daysAgo(days);
    const rows = (await this.db.models.AiRequest.findAll({
      attributes: [
        'relatedEpisodeId',
        [fn('COUNT', col('AiRequest.id')), 'requests'],
        [fn('SUM', col('AiRequest.input_tokens')), 'inputTokens'],
        [fn('SUM', col('AiRequest.output_tokens')), 'outputTokens'],
        [fn('SUM', col('AiRequest.estimated_cost')), 'estimatedCost'],
        [fn('AVG', col('AiRequest.latency_ms')), 'avgLatencyMs'],
      ],
      where: {
        relatedEpisodeId: { [Op.ne]: null },
        createdAt: { [Op.gte]: since },
      },
      group: ['relatedEpisodeId'],
      order: [[literal('"estimatedCost"'), 'DESC NULLS LAST']],
      raw: true,
    })) as unknown as Array<Record<string, unknown>>;

    const episodeIds = rows.map((row) => String(row.relatedEpisodeId)).filter(Boolean);
    const episodes = episodeIds.length
      ? await this.db.models.PodcastEpisode.findAll({
          where: { id: { [Op.in]: episodeIds } },
          attributes: ['id', 'title', 'status', 'slug'],
        })
      : [];
    const byId = new Map(
      episodes.map((ep) => [ep.getDataValue('id'), ep.toJSON()]),
    );

    return {
      days,
      episodes: rows.map((row) => {
        const episodeId = String(row.relatedEpisodeId);
        const ep = byId.get(episodeId) as
          | { title?: string; status?: string; slug?: string }
          | undefined;
        const inputTokens = Number(row.inputTokens ?? 0);
        const outputTokens = Number(row.outputTokens ?? 0);
        return {
          episodeId,
          title: ep?.title ?? episodeId,
          status: ep?.status ?? null,
          slug: ep?.slug ?? null,
          requests: Number(row.requests ?? 0),
          inputTokens,
          outputTokens,
          tokens: sumTokens({ inputTokens, outputTokens }),
          estimatedCost: roundMetric(Number(row.estimatedCost ?? 0), 6) ?? 0,
          avgLatencyMs: roundMetric(Number(row.avgLatencyMs ?? 0) || null, 1),
        };
      }),
    };
  }

  async editorialAcceptance(days = 7) {
    const since = daysAgo(days);
    const rows = (await this.db.models.EditorialDecision.findAll({
      attributes: [
        'decision',
        [fn('COUNT', col('EditorialDecision.id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: ['decision'],
      raw: true,
    })) as unknown as Array<{ decision: string; count: string | number }>;

    let approve = 0;
    let reject = 0;
    let other = 0;
    for (const row of rows) {
      const count = Number(row.count ?? 0);
      if (row.decision === 'approve') approve = count;
      else if (row.decision === 'reject') reject = count;
      else other += count;
    }
    const acceptance = computeAcceptanceRate({ approve, reject, other });
    return {
      days,
      ...acceptance,
      other,
      acceptanceRatePct:
        acceptance.rate === null ? null : roundMetric(acceptance.rate * 100, 1),
      byDecision: rows.map((row) => ({
        decision: row.decision,
        count: Number(row.count ?? 0),
      })),
    };
  }
}
