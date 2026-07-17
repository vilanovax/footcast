import { getConfig } from '@footcast/config';
import { authenticateDatabase, getDatabase } from '@footcast/database';
import { createLogger } from '@footcast/logger';
import {
  createQueue,
  createWorker,
  type CrawlSourceJobData,
  type FetchArticleJobData,
  type ParseArticleJobData,
} from '@footcast/queue';
import { processCrawlSourceJob } from './services/crawl-source.js';
import { processFetchArticleJob } from './services/fetch-article.js';
import { startScheduler } from './scheduler.js';

async function main(): Promise<void> {
  const config = getConfig();
  const logger = createLogger({ service: 'crawler' });
  const db = getDatabase(config.DATABASE_URL);
  await authenticateDatabase(db);

  const crawlQueue = createQueue<CrawlSourceJobData>('crawl-source', config.REDIS_URL);
  const fetchQueue = createQueue<FetchArticleJobData>('fetch-article', config.REDIS_URL);
  const parseQueue = createQueue<ParseArticleJobData>('parse-article', config.REDIS_URL);

  const crawlWorker = createWorker<CrawlSourceJobData>(
    'crawl-source',
    config.REDIS_URL,
    async (job) => {
      const child = logger.child({ jobId: String(job.id), sourceId: job.data.sourceId });
      await processCrawlSourceJob(db, child, fetchQueue, job.data);
    },
    2,
  );

  const fetchWorker = createWorker<FetchArticleJobData>(
    'fetch-article',
    config.REDIS_URL,
    async (job) => {
      const child = logger.child({ jobId: String(job.id), articleId: job.data.articleId });
      await processFetchArticleJob(db, child, parseQueue, job.data);
    },
    4,
  );

  crawlWorker.on('failed', (job, err) => {
    logger.error('crawl-source job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });
  fetchWorker.on('failed', (job, err) => {
    logger.error('fetch-article job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });
  crawlWorker.on('error', (err) => logger.error('crawl worker error', { error: err.message }));
  fetchWorker.on('error', (err) => logger.error('fetch worker error', { error: err.message }));

  const scheduler = startScheduler(db, logger, crawlQueue, 60_000);
  logger.info('Crawler online', {
    queues: ['crawl-source', 'fetch-article'],
    schedulerMs: 60_000,
  });

  const shutdown = async () => {
    clearInterval(scheduler);
    await crawlWorker.close();
    await fetchWorker.close();
    await crawlQueue.close();
    await fetchQueue.close();
    await parseQueue.close();
    await db.sequelize.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  const logger = createLogger({ service: 'crawler' });
  logger.error('Crawler failed to start', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
