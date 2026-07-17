import { randomUUID } from 'node:crypto';
import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import type { CrawlSourceJobData, FetchArticleJobData, Queue } from '@footcast/queue';
import {
  CrawlRunStatus,
  CrawlTrigger,
  FeedType,
  HealthStatus,
} from '@footcast/shared';
import { fetchFeedItems, persistDiscoveredArticles } from './discover.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processCrawlSourceJob(
  db: Database,
  logger: Logger,
  fetchQueue: Queue<FetchArticleJobData>,
  data: CrawlSourceJobData,
): Promise<void> {
  const run = await db.models.CrawlRun.findByPk(data.crawlRunId);
  if (!run) {
    logger.warn('Crawl run missing', { crawlRunId: data.crawlRunId });
    return;
  }

  const source = await db.models.Source.findByPk(data.sourceId, {
    include: [{ association: 'feeds' }, { association: 'health' }],
  });
  if (!source || !source.getDataValue('isActive')) {
    await run.update({
      status: CrawlRunStatus.FAILED,
      finishedAt: new Date(),
      message: 'Source inactive or missing',
    });
    return;
  }

  await run.update({
    status: CrawlRunStatus.RUNNING,
    startedAt: new Date(),
  });

  const feeds =
    (
      source as unknown as {
        feeds?: Array<{
          getDataValue: (k: string) => unknown;
          update: (v: Record<string, unknown>) => Promise<unknown>;
        }>;
      }
    ).feeds ?? [];

  const activeFeeds = feeds.filter((f) => f.getDataValue('isActive') === true);
  if (activeFeeds.length === 0) {
    await run.update({
      status: CrawlRunStatus.FAILED,
      finishedAt: new Date(),
      errorCount: 1,
      message: 'No active feeds',
    });
    await recordError(db, data.crawlRunId, data.sourceId, null, 'NO_FEEDS', 'No active feeds');
    await markHealth(db, data.sourceId, false, 'No active feeds');
    return;
  }

  const rateLimit = source.getDataValue('rateLimitPerMinute') || 10;
  const delayMs = Math.ceil(60_000 / rateLimit);
  let discovered = 0;
  let errors = 0;
  const createdArticleIds: string[] = [];
  let lastHttp: number | null = null;
  let lastFeedUrl: string | null = null;

  for (const feed of activeFeeds) {
    const feedUrl = String(feed.getDataValue('url'));
    const feedType = feed.getDataValue('feedType') as FeedType;
    const feedId = String(feed.getDataValue('id'));
    lastFeedUrl = feedUrl;

    try {
      await sleep(delayMs);
      const result = await fetchFeedItems(feedType, feedUrl);
      lastHttp = result.httpStatus;
      await feed.update({
        lastEtag: result.etag,
        lastModified: result.lastModified,
        lastFetchedAt: new Date(),
      });
      await run.update({ sourceFeedId: feedId, feedUrl, httpStatus: result.httpStatus });

      const persisted = await persistDiscoveredArticles(db, data.sourceId, result.items);
      discovered += persisted.createdIds.length;
      createdArticleIds.push(...persisted.createdIds);

      logger.info('Feed crawled', {
        sourceId: data.sourceId,
        feedUrl,
        discovered: persisted.createdIds.length,
        skipped: persisted.skipped,
      });
    } catch (error: unknown) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : 'FEED_FETCH_FAILED';
      const httpStatus =
        error && typeof error === 'object' && 'httpStatus' in error
          ? Number((error as { httpStatus: number }).httpStatus)
          : null;
      lastHttp = httpStatus;
      await recordError(db, data.crawlRunId, data.sourceId, feedUrl, code, message);
      logger.warn('Feed crawl failed', { sourceId: data.sourceId, feedUrl, message });
    }
  }

  for (const articleId of createdArticleIds) {
    const article = await db.models.RawArticle.findByPk(articleId);
    if (!article) continue;
    try {
      await fetchQueue.add(
        'fetch',
        {
          articleId,
          sourceId: data.sourceId,
          url: article.getDataValue('canonicalUrl'),
        },
        {
          jobId: `fetch-${articleId}`,
          priority: source.getDataValue('priority'),
        },
      );
    } catch (error: unknown) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      await recordError(
        db,
        data.crawlRunId,
        data.sourceId,
        article.getDataValue('canonicalUrl'),
        'FETCH_ENQUEUE_FAILED',
        message,
      );
    }
  }

  const status =
    errors === 0
      ? CrawlRunStatus.SUCCESS
      : discovered > 0
        ? CrawlRunStatus.PARTIAL
        : CrawlRunStatus.FAILED;

  await run.update({
    status,
    finishedAt: new Date(),
    discoveredCount: discovered,
    errorCount: errors,
    feedUrl: lastFeedUrl,
    httpStatus: lastHttp,
    message: `discovered=${discovered} errors=${errors}`,
    metadata: { trigger: data.trigger, createdArticleIds },
  });

  await markHealth(db, data.sourceId, status !== CrawlRunStatus.FAILED, run.getDataValue('message'));
}

async function recordError(
  db: Database,
  crawlRunId: string,
  sourceId: string,
  url: string | null,
  code: string,
  message: string,
): Promise<void> {
  await db.models.CrawlError.create({
    id: randomUUID(),
    crawlRunId,
    sourceId,
    url,
    code,
    message,
  });
}

async function markHealth(
  db: Database,
  sourceId: string,
  ok: boolean,
  message: string | null,
): Promise<void> {
  const health = await db.models.SourceHealth.findByPk(sourceId);
  if (!health) {
    await db.models.SourceHealth.create({
      sourceId,
      status: ok ? HealthStatus.HEALTHY : HealthStatus.DOWN,
      lastSuccessAt: ok ? new Date() : null,
      lastErrorAt: ok ? null : new Date(),
      consecutiveFailures: ok ? 0 : 1,
      lastErrorMessage: ok ? null : message,
    });
    return;
  }
  if (ok) {
    await health.update({
      status: HealthStatus.HEALTHY,
      lastSuccessAt: new Date(),
      consecutiveFailures: 0,
      lastErrorMessage: null,
    });
    return;
  }
  const failures = health.getDataValue('consecutiveFailures') + 1;
  await health.update({
    status: failures >= 3 ? HealthStatus.DOWN : HealthStatus.DEGRADED,
    lastErrorAt: new Date(),
    consecutiveFailures: failures,
    lastErrorMessage: message,
  });
}

export async function createPendingCrawlRun(
  db: Database,
  sourceId: string,
  trigger: CrawlTrigger,
): Promise<string> {
  const id = randomUUID();
  await db.models.CrawlRun.create({
    id,
    sourceId,
    sourceFeedId: null,
    status: CrawlRunStatus.PENDING,
    trigger,
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
  return id;
}
