import { getConfig } from '@footcast/config';
import { authenticateDatabase, getDatabase } from '@footcast/database';
import {
  configureEmbeddingRuntime,
  createEmbeddingProvider,
} from '@footcast/event-clustering';
import { createLogger } from '@footcast/logger';
import {
  createQueue,
  createWorker,
  type ClusterEventJobData,
  type ExtractArticleJobData,
  type FactCheckScriptJobData,
  type GenerateAudioJobData,
  type GeneratePodcastJobData,
  type ParseArticleJobData,
  type PublishEpisodeJobData,
  type ScoreEventJobData,
} from '@footcast/queue';
import { processParseArticleJob } from './services/parse-article.js';
import { processExtractArticleJob } from './services/extract-article.js';
import { processClusterEventJob } from './services/cluster-event.js';
import { processScoreEventJob } from './services/score-event.js';
import { processGeneratePodcastJob } from './services/generate-podcast.js';
import { processFactCheckScriptJob } from './services/fact-check-script.js';
import { processGenerateAudioJob } from './services/generate-audio.js';
import { processPublishEpisodeJob } from './services/publish-episode.js';

async function main(): Promise<void> {
  const config = getConfig();
  const logger = createLogger({ service: 'worker' });
  const allowMock =
    config.EMBEDDING_ALLOW_MOCK ||
    config.NODE_ENV === 'development' ||
    config.NODE_ENV === 'test';
  const embeddingProvider = createEmbeddingProvider({
    provider: config.EMBEDDING_PROVIDER,
    apiKey: process.env.OPENAI_API_KEY ?? null,
    allowMock,
  });
  configureEmbeddingRuntime({ allowMock, provider: embeddingProvider });
  const db = getDatabase(config.DATABASE_URL);
  await authenticateDatabase(db);

  const extractQueue = createQueue<ExtractArticleJobData>('extract-article', config.REDIS_URL);
  const clusterQueue = createQueue<ClusterEventJobData>('cluster-event', config.REDIS_URL);
  const scoreQueue = createQueue<ScoreEventJobData>('score-event', config.REDIS_URL);
  const podcastQueue = createQueue<GeneratePodcastJobData>('generate-podcast', config.REDIS_URL);
  const factCheckQueue = createQueue<FactCheckScriptJobData>(
    'fact-check-script',
    config.REDIS_URL,
  );
  const audioQueue = createQueue<GenerateAudioJobData>('generate-audio', config.REDIS_URL);
  const publishQueue = createQueue<PublishEpisodeJobData>('publish-episode', config.REDIS_URL);

  const workers = [
    [
      'parse-article',
      createWorker<ParseArticleJobData>(
        'parse-article',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({ jobId: String(job.id), articleId: job.data.articleId });
          await processParseArticleJob(db, child, extractQueue, job.data);
        },
        4,
      ),
    ],
    [
      'extract-article',
      createWorker<ExtractArticleJobData>(
        'extract-article',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({ jobId: String(job.id), articleId: job.data.articleId });
          await processExtractArticleJob(db, child, clusterQueue, job.data);
        },
        2,
      ),
    ],
    [
      'cluster-event',
      createWorker<ClusterEventJobData>(
        'cluster-event',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({ jobId: String(job.id), articleId: job.data.articleId });
          await processClusterEventJob(db, child, scoreQueue, job.data);
        },
        2,
      ),
    ],
    [
      'score-event',
      createWorker<ScoreEventJobData>(
        'score-event',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({ jobId: String(job.id), eventId: job.data.eventId });
          await processScoreEventJob(db, child, job.data);
        },
        2,
      ),
    ],
    [
      'generate-podcast',
      createWorker<GeneratePodcastJobData>(
        'generate-podcast',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({ jobId: String(job.id), episodeId: job.data.episodeId });
          await processGeneratePodcastJob(db, child, factCheckQueue, job.data);
        },
        1,
      ),
    ],
    [
      'fact-check-script',
      createWorker<FactCheckScriptJobData>(
        'fact-check-script',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({
            jobId: String(job.id),
            episodeId: job.data.episodeId,
            scriptVersionId: job.data.scriptVersionId,
          });
          await processFactCheckScriptJob(db, child, job.data);
        },
        1,
      ),
    ],
    [
      'generate-audio',
      createWorker<GenerateAudioJobData>(
        'generate-audio',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({ jobId: String(job.id), episodeId: job.data.episodeId });
          await processGenerateAudioJob(db, child, job.data);
        },
        1,
      ),
    ],
    [
      'publish-episode',
      createWorker<PublishEpisodeJobData>(
        'publish-episode',
        config.REDIS_URL,
        async (job) => {
          const child = logger.child({ jobId: String(job.id), episodeId: job.data.episodeId });
          await processPublishEpisodeJob(db, child, job.data);
        },
        1,
      ),
    ],
  ] as const;

  for (const [name, worker] of workers) {
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
    queues: workers.map(([name]) => name),
    aiProvider: process.env.AI_PROVIDER || 'mock',
    ttsProvider: process.env.TTS_PROVIDER || 'mock',
  });

  const shutdown = async () => {
    await Promise.all(workers.map(([, w]) => w.close()));
    await extractQueue.close();
    await clusterQueue.close();
    await scoreQueue.close();
    await podcastQueue.close();
    await factCheckQueue.close();
    await audioQueue.close();
    await publishQueue.close();
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
