import { Queue, Worker, type ConnectionOptions, type JobsOptions, type Processor } from 'bullmq';
import type { QueueName } from '@footcast/shared';

export interface CrawlSourceJobData {
  sourceId: string;
  crawlRunId: string;
  trigger: 'schedule' | 'manual' | 'retry';
}

export interface FetchArticleJobData {
  articleId: string;
  sourceId: string;
  url: string;
}

export interface ParseArticleJobData {
  articleId: string;
  reason?: 'fetch_complete' | 'manual' | 'retry';
}

export interface ExtractArticleJobData {
  articleId: string;
  reason?: 'parse_complete' | 'manual' | 'retry';
}

export interface ClusterEventJobData {
  articleId: string;
  reason?: 'extract_complete' | 'manual' | 'retry';
}

export interface ScoreEventJobData {
  eventId: string;
  reason?: 'cluster_complete' | 'manual' | 'retry';
}

export function redisConnectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };
}

export function createQueue<T>(
  name: QueueName,
  redisUrl: string,
  defaultJobOptions?: JobsOptions,
): Queue<T> {
  return new Queue<T>(name, {
    connection: redisConnectionFromUrl(redisUrl),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 500,
      ...defaultJobOptions,
    },
  });
}

export function createWorker<T>(
  name: QueueName,
  redisUrl: string,
  processor: Processor<T>,
  concurrency = 2,
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection: redisConnectionFromUrl(redisUrl),
    concurrency,
  });
}

export type { Queue, Worker, JobsOptions };
