export enum ArticleStatus {
  DISCOVERED = 'DISCOVERED',
  FETCHING = 'FETCHING',
  FETCHED = 'FETCHED',
  PARSED = 'PARSED',
  EXTRACTING = 'EXTRACTING',
  EXTRACTED = 'EXTRACTED',
  IRRELEVANT = 'IRRELEVANT',
  DUPLICATE = 'DUPLICATE',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
}

export enum EventStatus {
  NEW = 'NEW',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  VERIFIED = 'VERIFIED',
  CONFLICTED = 'CONFLICTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SELECTED = 'SELECTED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum OfficialStatus {
  OFFICIAL = 'OFFICIAL',
  CONFIRMED = 'CONFIRMED',
  RELIABLE_REPORT = 'RELIABLE_REPORT',
  MULTI_SOURCE_REPORT = 'MULTI_SOURCE_REPORT',
  UNVERIFIED = 'UNVERIFIED',
  RUMOR = 'RUMOR',
  DISPUTED = 'DISPUTED',
  FALSE = 'FALSE',
}

export enum NewsCategory {
  TRANSFER = 'TRANSFER',
  CONTRACT = 'CONTRACT',
  COACH_CHANGE = 'COACH_CHANGE',
  INJURY = 'INJURY',
  SUSPENSION = 'SUSPENSION',
  MATCH_RESULT = 'MATCH_RESULT',
  MATCH_PREVIEW = 'MATCH_PREVIEW',
  LEGAL = 'LEGAL',
  DISCIPLINARY = 'DISCIPLINARY',
  MANAGEMENT = 'MANAGEMENT',
  OWNERSHIP = 'OWNERSHIP',
  NATIONAL_TEAM = 'NATIONAL_TEAM',
  TACTICAL = 'TACTICAL',
  FINANCIAL = 'FINANCIAL',
  OFF_FIELD = 'OFF_FIELD',
  OTHER = 'OTHER',
}

export enum SourceType {
  OFFICIAL_CLUB = 'OFFICIAL_CLUB',
  OFFICIAL_LEAGUE = 'OFFICIAL_LEAGUE',
  OFFICIAL_FEDERATION = 'OFFICIAL_FEDERATION',
  NEWS_AGENCY = 'NEWS_AGENCY',
  TRUSTED_NEWSPAPER = 'TRUSTED_NEWSPAPER',
  TRANSFER_REPORTER = 'TRANSFER_REPORTER',
  LOCAL_SPORTS_MEDIA = 'LOCAL_SPORTS_MEDIA',
  AGGREGATOR = 'AGGREGATOR',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  UNTRUSTED_SOURCE = 'UNTRUSTED_SOURCE',
}

export enum EpisodeStatus {
  DRAFT = 'DRAFT',
  NEWS_SELECTED = 'NEWS_SELECTED',
  SCRIPT_GENERATING = 'SCRIPT_GENERATING',
  SCRIPT_READY = 'SCRIPT_READY',
  SCRIPT_REVIEWED = 'SCRIPT_REVIEWED',
  AUDIO_GENERATING = 'AUDIO_GENERATING',
  AUDIO_READY = 'AUDIO_READY',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  FAILED = 'FAILED',
}

export enum CoverageScope {
  IRAN = 'IRAN',
  EUROPE = 'EUROPE',
  BOTH = 'BOTH',
  OTHER = 'OTHER',
}

export enum FeedType {
  RSS = 'rss',
  SITEMAP = 'sitemap',
  LIST = 'list',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  DOWN = 'down',
  UNKNOWN = 'unknown',
}

export enum CrawlRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export enum CrawlTrigger {
  SCHEDULE = 'schedule',
  MANUAL = 'manual',
  RETRY = 'retry',
}

export enum SystemRole {
  SYSTEM_ADMIN = 'system_admin',
  EDITOR = 'editor',
  REPORTER = 'reporter',
  CONTENT_MANAGER = 'content_manager',
}

export const QUEUE_NAMES = [
  'crawl-source',
  'fetch-article',
  'parse-article',
  'extract-article',
  'generate-embedding',
  'detect-duplicate',
  'cluster-event',
  'score-event',
  'verify-event',
  'generate-podcast',
  'fact-check-script',
  'generate-audio',
  'publish-episode',
  'send-notification',
  'cleanup',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
