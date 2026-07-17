import { Inject, Injectable } from '@nestjs/common';
import { ArticleStatus, EpisodeStatus, HealthStatus } from '@footcast/shared';
import { Op, type Database } from '@footcast/database';
import { col, fn, literal } from 'sequelize';
import {
  computeAcceptanceRate,
  roundMetric,
  sumTokens,
} from '@footcast/reporting';
import type { Queue } from '@footcast/queue';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import {
  CLUSTER_EVENT_QUEUE,
  CRAWL_SOURCE_QUEUE,
  EXTRACT_ARTICLE_QUEUE,
  FACT_CHECK_SCRIPT_QUEUE,
  FETCH_ARTICLE_QUEUE,
  GENERATE_AUDIO_QUEUE,
  GENERATE_PODCAST_QUEUE,
  PARSE_ARTICLE_QUEUE,
  PUBLISH_EPISODE_QUEUE,
  SCORE_EVENT_QUEUE,
} from '../queue/queue.tokens.js';

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(CRAWL_SOURCE_QUEUE) private readonly crawlQueue: Queue,
    @Inject(FETCH_ARTICLE_QUEUE) private readonly fetchQueue: Queue,
    @Inject(PARSE_ARTICLE_QUEUE) private readonly parseQueue: Queue,
    @Inject(EXTRACT_ARTICLE_QUEUE) private readonly extractQueue: Queue,
    @Inject(CLUSTER_EVENT_QUEUE) private readonly clusterQueue: Queue,
    @Inject(SCORE_EVENT_QUEUE) private readonly scoreQueue: Queue,
    @Inject(GENERATE_PODCAST_QUEUE) private readonly podcastQueue: Queue,
    @Inject(FACT_CHECK_SCRIPT_QUEUE) private readonly factCheckQueue: Queue,
    @Inject(GENERATE_AUDIO_QUEUE) private readonly audioQueue: Queue,
    @Inject(PUBLISH_EPISODE_QUEUE) private readonly publishQueue: Queue,
  ) {}

  async summary() {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const last24h = hoursAgo(24);
    const last7d = daysAgo(7);

    const [
      activeSources,
      erroredSources,
      articlesToday,
      discovered,
      failed,
      productNameEn,
      productNameFa,
      lastCrawl,
      parsed,
      episodesProduced,
      episodesPublished,
      aiCost24h,
      aiInputTokens24h,
      aiOutputTokens24h,
      aiAvgLatency,
      aiRequestCount24h,
      approveCount,
      rejectCount,
      lastAi,
      crawlRuns7d,
      crawlErrors7d,
      crawlDiscovered7d,
      queueDepths,
    ] = await Promise.all([
      this.db.models.Source.count({ where: { isActive: true } }),
      this.db.models.SourceHealth.count({
        where: { status: { [Op.in]: [HealthStatus.DOWN, HealthStatus.DEGRADED] } },
      }),
      this.db.models.RawArticle.count({
        where: { discoveredAt: { [Op.gte]: startOfDay } },
      }),
      this.db.models.RawArticle.count({
        where: {
          status: {
            [Op.in]: [ArticleStatus.DISCOVERED, ArticleStatus.FETCHED, ArticleStatus.FETCHING],
          },
        },
      }),
      this.db.models.RawArticle.count({ where: { status: ArticleStatus.FAILED } }),
      this.db.models.AppSetting.findByPk('product.name.en'),
      this.db.models.AppSetting.findByPk('product.name.fa'),
      this.db.models.CrawlRun.findOne({ order: [['createdAt', 'DESC']] }),
      this.db.models.RawArticle.count({ where: { status: ArticleStatus.PARSED } }),
      this.db.models.PodcastEpisode.count({
        where: {
          status: {
            [Op.in]: [
              EpisodeStatus.SCRIPT_READY,
              EpisodeStatus.SCRIPT_REVIEWED,
              EpisodeStatus.APPROVED,
              EpisodeStatus.AUDIO_READY,
              EpisodeStatus.PUBLISHED,
            ],
          },
        },
      }),
      this.db.models.PodcastEpisode.count({
        where: { status: EpisodeStatus.PUBLISHED },
      }),
      this.db.models.AiRequest.sum('estimatedCost', {
        where: { createdAt: { [Op.gte]: last24h } },
      }),
      this.db.models.AiRequest.sum('inputTokens', {
        where: { createdAt: { [Op.gte]: last24h } },
      }),
      this.db.models.AiRequest.sum('outputTokens', {
        where: { createdAt: { [Op.gte]: last24h } },
      }),
      this.db.models.AiRequest.findOne({
        attributes: [[fn('AVG', col('latency_ms')), 'avgLatencyMs']],
        where: { createdAt: { [Op.gte]: last24h } },
        raw: true,
      }) as Promise<{ avgLatencyMs?: string | number } | null>,
      this.db.models.AiRequest.count({
        where: { createdAt: { [Op.gte]: last24h } },
      }),
      this.db.models.EditorialDecision.count({
        where: { decision: 'approve', createdAt: { [Op.gte]: last7d } },
      }),
      this.db.models.EditorialDecision.count({
        where: { decision: 'reject', createdAt: { [Op.gte]: last7d } },
      }),
      this.db.models.AiRequest.findOne({ order: [['createdAt', 'DESC']] }),
      this.db.models.CrawlRun.count({
        where: { createdAt: { [Op.gte]: last7d } },
      }),
      this.db.models.CrawlRun.sum('errorCount', {
        where: { createdAt: { [Op.gte]: last7d } },
      }),
      this.db.models.CrawlRun.sum('discoveredCount', {
        where: { createdAt: { [Op.gte]: last7d } },
      }),
      this.queueDepths(),
    ]);

    const acceptance = computeAcceptanceRate({
      approve: approveCount,
      reject: rejectCount,
    });
    const tokens24h = sumTokens({
      inputTokens: Number(aiInputTokens24h ?? 0),
      outputTokens: Number(aiOutputTokens24h ?? 0),
    });
    const avgLatencyMs = roundMetric(
      Number((aiAvgLatency as { avgLatencyMs?: string | number } | null)?.avgLatencyMs ?? 0) ||
        null,
      1,
    );

    const crawlAvgMsRow = (await this.db.models.CrawlRun.findOne({
      attributes: [
        [
          literal(
            `AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)`,
          ),
          'avgDurationMs',
        ],
      ],
      where: {
        createdAt: { [Op.gte]: last7d },
        startedAt: { [Op.ne]: null },
        finishedAt: { [Op.ne]: null },
      },
      raw: true,
    })) as { avgDurationMs?: string | number } | null;

    return {
      productName: {
        en: productNameEn?.getDataValue('value') ?? 'Football Newsroom',
        fa: productNameFa?.getDataValue('value') ?? 'اتاق خبر فوتبال',
      },
      window: {
        costHours: 24,
        acceptanceDays: 7,
      },
      sources: {
        active: activeSources,
        errored: erroredSources,
        crawlRuns7d,
        crawlErrors7d: Number(crawlErrors7d ?? 0),
        crawlDiscovered7d: Number(crawlDiscovered7d ?? 0),
        avgCrawlDurationMs: roundMetric(Number(crawlAvgMsRow?.avgDurationMs ?? 0) || null, 1),
      },
      articles: {
        discoveredToday: articlesToday,
        pending: discovered,
        failed,
        parsed,
      },
      episodes: {
        produced: episodesProduced,
        published: episodesPublished,
      },
      costs: {
        last24h: roundMetric(Number(aiCost24h ?? 0), 6) ?? 0,
        tokens: tokens24h,
        inputTokens: Number(aiInputTokens24h ?? 0),
        outputTokens: Number(aiOutputTokens24h ?? 0),
        requests: aiRequestCount24h,
      },
      latency: {
        aiAvgMs: avgLatencyMs,
        crawlAvgMs: roundMetric(Number(crawlAvgMsRow?.avgDurationMs ?? 0) || null, 1),
      },
      editorial: {
        windowDays: 7,
        ...acceptance,
        acceptanceRatePct:
          acceptance.rate === null ? null : roundMetric(acceptance.rate * 100, 1),
      },
      queues: queueDepths,
      pipeline: {
        lastCrawlerRunAt:
          lastCrawl?.getDataValue('finishedAt') ??
          lastCrawl?.getDataValue('createdAt') ??
          null,
        lastNewsPipelineAt: lastAi?.getDataValue('createdAt') ?? null,
      },
    };
  }

  private async queueDepths(): Promise<
    Array<{ name: string; waiting: number; active: number; failed: number; delayed: number }>
  > {
    const entries: Array<[string, Queue]> = [
      ['crawl-source', this.crawlQueue],
      ['fetch-article', this.fetchQueue],
      ['parse-article', this.parseQueue],
      ['extract-article', this.extractQueue],
      ['cluster-event', this.clusterQueue],
      ['score-event', this.scoreQueue],
      ['generate-podcast', this.podcastQueue],
      ['fact-check-script', this.factCheckQueue],
      ['generate-audio', this.audioQueue],
      ['publish-episode', this.publishQueue],
    ];
    const rows = await Promise.all(
      entries.map(async ([name, queue]) => {
        const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
        };
      }),
    );
    return rows;
  }
}
