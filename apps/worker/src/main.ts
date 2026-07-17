import { getConfig } from '@footcast/config';
import { authenticateDatabase, getDatabase } from '@footcast/database';
import { createLogger } from '@footcast/logger';
import {
  createQueue,
  createWorker,
  type ClusterEventJobData,
  type ExtractArticleJobData,
  type ParseArticleJobData,
  type ScoreEventJobData,
} from '@footcast/queue';
import { processParseArticleJob } from './services/parse-article.js';
import { processExtractArticleJob } from './services/extract-article.js';
import { processClusterEventJob } from './services/cluster-event.js';
import { processScoreEventJob } from './services/score-event.js';

async function main(): Promise<void> {
  const config = getConfig();
  const logger = createLogger({ service: 'worker' });
  const db = getDatabase(config.DATABASE_URL);
  await authenticateDatabase(db);

  const extractQueue = createQueue<ExtractArticleJobData>('extract-article', config.REDIS_URL);
  const clusterQueue = createQueue<ClusterEventJobData>('cluster-event', config.REDIS_URL);
  const scoreQueue = createQueue<ScoreEventJobData>('score-event', config.REDIS_URL);

  const parseWorker = createWorker<ParseArticleJobData>(
    'parse-article',
    config.REDIS_URL,
    async (job) => {
      const child = logger.child({ jobId: String(job.id), articleId: job.data.articleId });
      await processParseArticleJob(db, child, extractQueue, job.data);
    },
    4,
  );

  const extractWorker = createWorker<ExtractArticleJobData>(
    'extract-article',
    config.REDIS_URL,
    async (job) => {
      const child = logger.child({ jobId: String(job.id), articleId: job.data.articleId });
      await processExtractArticleJob(db, child, clusterQueue, job.data);
    },
    2,
  );

  const clusterWorker = createWorker<ClusterEventJobData>(
    'cluster-event',
    config.REDIS_URL,
    async (job) => {
      const child = logger.child({ jobId: String(job.id), articleId: job.data.articleId });
      await processClusterEventJob(db, child, scoreQueue, job.data);
    },
    2,
  );

  const scoreWorker = createWorker<ScoreEventJobData>(
    'score-event',
    config.REDIS_URL,
    async (job) => {
      const child = logger.child({ jobId: String(job.id), eventId: job.data.eventId });
      await processScoreEventJob(db, child, job.data);
    },
    2,
  );

  for (const [name, worker] of [
    ['parse-article', parseWorker],
    ['extract-article', extractWorker],
    ['cluster-event', clusterWorker],
    ['score-event', scoreWorker],
  ] as const) {
    worker.on('failed', (job, err) => {
      logger.error(`${name} job failed`, {
        jobId: job?.id,
        error: err.message,
        attemptsMade: job?.attemptsMade,
      });
    });
    worker.on('error', (err) => logger.error(`${name} worker error`, { error: err.message }));
  }

  logger.info('Worker online', {
    queues: ['parse-article', 'extract-article', 'cluster-event', 'score-event'],
    aiProvider: process.env.AI_PROVIDER || 'mock',
  });

  const shutdown = async () => {
    await parseWorker.close();
    await extractWorker.close();
    await clusterWorker.close();
    await scoreWorker.close();
    await extractQueue.close();
    await clusterQueue.close();
    await scoreQueue.close();
    await db.sequelize.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  const logger = createLogger({ service: 'worker' });
  logger.error('Worker failed to start', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
