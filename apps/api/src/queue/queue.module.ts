import { Global, Module, type OnModuleDestroy } from '@nestjs/common';
import { getConfig } from '@footcast/config';
import {
  createQueue,
  type ClusterEventJobData,
  type CrawlSourceJobData,
  type ExtractArticleJobData,
  type FetchArticleJobData,
  type ParseArticleJobData,
  type ScoreEventJobData,
} from '@footcast/queue';
import {
  CLUSTER_EVENT_QUEUE,
  CRAWL_SOURCE_QUEUE,
  EXTRACT_ARTICLE_QUEUE,
  FETCH_ARTICLE_QUEUE,
  PARSE_ARTICLE_QUEUE,
  SCORE_EVENT_QUEUE,
} from './queue.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: CRAWL_SOURCE_QUEUE,
      useFactory: () => createQueue<CrawlSourceJobData>('crawl-source', getConfig().REDIS_URL),
    },
    {
      provide: FETCH_ARTICLE_QUEUE,
      useFactory: () => createQueue<FetchArticleJobData>('fetch-article', getConfig().REDIS_URL),
    },
    {
      provide: PARSE_ARTICLE_QUEUE,
      useFactory: () => createQueue<ParseArticleJobData>('parse-article', getConfig().REDIS_URL),
    },
    {
      provide: EXTRACT_ARTICLE_QUEUE,
      useFactory: () =>
        createQueue<ExtractArticleJobData>('extract-article', getConfig().REDIS_URL),
    },
    {
      provide: CLUSTER_EVENT_QUEUE,
      useFactory: () =>
        createQueue<ClusterEventJobData>('cluster-event', getConfig().REDIS_URL),
    },
    {
      provide: SCORE_EVENT_QUEUE,
      useFactory: () => createQueue<ScoreEventJobData>('score-event', getConfig().REDIS_URL),
    },
  ],
  exports: [
    CRAWL_SOURCE_QUEUE,
    FETCH_ARTICLE_QUEUE,
    PARSE_ARTICLE_QUEUE,
    EXTRACT_ARTICLE_QUEUE,
    CLUSTER_EVENT_QUEUE,
    SCORE_EVENT_QUEUE,
  ],
})
export class QueueModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy(): Promise<void> {
    // Queues closed with process exit; Nest will GC providers.
  }
}
