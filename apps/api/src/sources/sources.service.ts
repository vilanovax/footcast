import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Queue } from '@footcast/queue';
import type { CrawlSourceJobData } from '@footcast/queue';
import {
  CrawlRunStatus,
  CrawlTrigger,
  FeedType,
  HealthStatus,
} from '@footcast/shared';
import { Op, type Database } from '@footcast/database';
import type { CreateSourceInput, UpdateSourceInput } from '@footcast/validation';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import { CRAWL_SOURCE_QUEUE } from '../queue/queue.tokens.js';

@Injectable()
export class SourcesService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(CRAWL_SOURCE_QUEUE)
    private readonly crawlQueue: Queue<CrawlSourceJobData>,
  ) {}

  async list(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const { rows, count } = await this.db.models.Source.findAndCountAll({
      include: [
        { association: 'feeds' },
        { association: 'health' },
      ],
      order: [
        ['priority', 'ASC'],
        ['name', 'ASC'],
      ],
      limit: pageSize,
      offset,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page, pageSize, total: count },
    };
  }

  async get(id: string) {
    const source = await this.db.models.Source.findByPk(id, {
      include: [
        { association: 'feeds' },
        { association: 'health' },
      ],
    });
    if (!source) {
      throw new NotFoundException('Source not found');
    }
    return source.toJSON();
  }

  async create(input: CreateSourceInput) {
    const existing = await this.db.models.Source.findOne({ where: { slug: input.slug } });
    if (existing) {
      throw new ConflictException('Source slug already exists');
    }
    const id = randomUUID();
    const source = await this.db.models.Source.create({
      id,
      name: input.name,
      slug: input.slug,
      sourceType: input.sourceType,
      countryCode: input.countryCode ?? null,
      language: input.language,
      baseUrl: input.baseUrl,
      rssUrl: input.rssUrl ?? null,
      sitemapUrl: input.sitemapUrl ?? null,
      credibilitySeed: input.credibilitySeed,
      priority: input.priority,
      fetchIntervalSec: input.fetchIntervalSec,
      requiresJavascript: input.requiresJavascript,
      rateLimitPerMinute: input.rateLimitPerMinute,
      isActive: input.isActive,
      coverageScope: input.coverageScope,
      metadata: input.metadata ?? null,
    });

    if (input.rssUrl) {
      await this.db.models.SourceFeed.create({
        id: randomUUID(),
        sourceId: id,
        feedType: FeedType.RSS,
        url: input.rssUrl,
        isActive: true,
        lastEtag: null,
        lastModified: null,
        lastFetchedAt: null,
      });
    }
    if (input.sitemapUrl) {
      await this.db.models.SourceFeed.create({
        id: randomUUID(),
        sourceId: id,
        feedType: FeedType.SITEMAP,
        url: input.sitemapUrl,
        isActive: true,
        lastEtag: null,
        lastModified: null,
        lastFetchedAt: null,
      });
    }

    await this.db.models.SourceHealth.create({
      sourceId: id,
      status: HealthStatus.UNKNOWN,
      lastSuccessAt: null,
      lastErrorAt: null,
      consecutiveFailures: 0,
      lastErrorMessage: null,
    });

    return this.get(source.getDataValue('id'));
  }

  async update(id: string, input: UpdateSourceInput) {
    const source = await this.db.models.Source.findByPk(id);
    if (!source) {
      throw new NotFoundException('Source not found');
    }
    await source.update({
      ...input,
      countryCode: input.countryCode === undefined ? source.getDataValue('countryCode') : input.countryCode,
      rssUrl: input.rssUrl === undefined ? source.getDataValue('rssUrl') : input.rssUrl,
      sitemapUrl:
        input.sitemapUrl === undefined ? source.getDataValue('sitemapUrl') : input.sitemapUrl,
      metadata: input.metadata === undefined ? source.getDataValue('metadata') : input.metadata,
    });
    return this.get(id);
  }

  async feeds(id: string) {
    await this.get(id);
    const feeds = await this.db.models.SourceFeed.findAll({ where: { sourceId: id } });
    return feeds.map((f) => f.toJSON());
  }

  async health(id: string) {
    await this.get(id);
    const health = await this.db.models.SourceHealth.findByPk(id);
    return health?.toJSON() ?? null;
  }

  async listRuns(id: string, page = 1, pageSize = 20) {
    await this.get(id);
    const offset = (page - 1) * pageSize;
    const { rows, count } = await this.db.models.CrawlRun.findAndCountAll({
      where: { sourceId: id },
      include: [{ association: 'errors' }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page, pageSize, total: count },
    };
  }

  async getRun(sourceId: string, runId: string) {
    await this.get(sourceId);
    const run = await this.db.models.CrawlRun.findOne({
      where: { id: runId, sourceId },
      include: [{ association: 'errors' }],
    });
    if (!run) {
      throw new NotFoundException('Crawl run not found');
    }
    return run.toJSON();
  }

  async triggerCrawl(sourceId: string) {
    await this.get(sourceId);
    const active = await this.db.models.CrawlRun.findOne({
      where: {
        sourceId,
        status: { [Op.in]: [CrawlRunStatus.PENDING, CrawlRunStatus.RUNNING] },
      },
    });
    if (active) {
      return {
        queued: false,
        crawlRunId: active.getDataValue('id'),
        message: 'Crawl already in progress',
      };
    }

    const crawlRunId = randomUUID();
    await this.db.models.CrawlRun.create({
      id: crawlRunId,
      sourceId,
      sourceFeedId: null,
      status: CrawlRunStatus.PENDING,
      trigger: CrawlTrigger.MANUAL,
      jobId: null,
      startedAt: null,
      finishedAt: null,
      discoveredCount: 0,
      fetchedCount: 0,
      errorCount: 0,
      feedUrl: null,
      httpStatus: null,
      message: null,
      metadata: null,
    });

    const job = await this.crawlQueue.add(
      'crawl',
      { sourceId, crawlRunId, trigger: 'manual' },
      { jobId: `crawl-${sourceId}-${crawlRunId}` },
    );
    await this.db.models.CrawlRun.update(
      { jobId: String(job.id) },
      { where: { id: crawlRunId } },
    );

    return { queued: true, crawlRunId, jobId: String(job.id) };
  }

  /** Queue manual crawl for every active source (on-demand news search). */
  async triggerCrawlAll() {
    const sources = await this.db.models.Source.findAll({
      where: { isActive: true },
      attributes: ['id', 'name'],
      order: [
        ['priority', 'ASC'],
        ['name', 'ASC'],
      ],
    });
    const results: Array<{
      sourceId: string;
      name: string;
      queued: boolean;
      message?: string;
    }> = [];
    let queued = 0;
    let skipped = 0;
    for (const source of sources) {
      const sourceId = source.getDataValue('id');
      const name = source.getDataValue('name');
      try {
        const res = await this.triggerCrawl(sourceId);
        if (res.queued) queued += 1;
        else skipped += 1;
        results.push({
          sourceId,
          name,
          queued: res.queued,
          message: 'message' in res ? String(res.message) : undefined,
        });
      } catch (err) {
        skipped += 1;
        results.push({
          sourceId,
          name,
          queued: false,
          message: err instanceof Error ? err.message : 'failed',
        });
      }
    }
    return {
      totalSources: sources.length,
      queued,
      skipped,
      results,
    };
  }
}
