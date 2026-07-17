import { Global, Module, type OnModuleDestroy } from '@nestjs/common';
import { getConfig } from '@footcast/config';
import {
  createQueue,
  type ClusterEventJobData,
  type CrawlSourceJobData,
  type ExtractArticleJobData,
  type FactCheckScriptJobData,
  type FetchArticleJobData,
  type GenerateAudioJobData,
  type GeneratePodcastJobData,
  type ParseArticleJobData,
  type PublishEpisodeJobData,
  type ScoreEventJobData,
} from '@footcast/queue';
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
    {
      provide: GENERATE_PODCAST_QUEUE,
      useFactory: () =>
        createQueue<GeneratePodcastJobData>('generate-podcast', getConfig().REDIS_URL),
    },
    {
      provide: FACT_CHECK_SCRIPT_QUEUE,
      useFactory: () =>
        createQueue<FactCheckScriptJobData>('fact-check-script', getConfig().REDIS_URL),
    },
    {
      provide: GENERATE_AUDIO_QUEUE,
      useFactory: () =>
        createQueue<GenerateAudioJobData>('generate-audio', getConfig().REDIS_URL),
    },
    {
      provide: PUBLISH_EPISODE_QUEUE,
      useFactory: () =>
        createQueue<PublishEpisodeJobData>('publish-episode', getConfig().REDIS_URL),
    },
  ],
  exports: [
    CRAWL_SOURCE_QUEUE,
    FETCH_ARTICLE_QUEUE,
    PARSE_ARTICLE_QUEUE,
    EXTRACT_ARTICLE_QUEUE,
    CLUSTER_EVENT_QUEUE,
    SCORE_EVENT_QUEUE,
    GENERATE_PODCAST_QUEUE,
    FACT_CHECK_SCRIPT_QUEUE,
    GENERATE_AUDIO_QUEUE,
    PUBLISH_EPISODE_QUEUE,
  ],
})
export class QueueModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy(): Promise<void> {}
}
