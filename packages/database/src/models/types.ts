import type {
  ArticleStatus,
  CoverageScope,
  CrawlRunStatus,
  CrawlTrigger,
  FeedType,
  HealthStatus,
  SourceType,
} from '@footcast/shared';

export interface UserAttrs {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RoleAttrs {
  id: string;
  name: string;
  description: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermissionAttrs {
  id: string;
  code: string;
  description: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SourceAttrs {
  id: string;
  name: string;
  slug: string;
  sourceType: SourceType;
  countryCode: string | null;
  language: string;
  baseUrl: string;
  rssUrl: string | null;
  sitemapUrl: string | null;
  credibilitySeed: number;
  priority: number;
  fetchIntervalSec: number;
  requiresJavascript: boolean;
  rateLimitPerMinute: number;
  isActive: boolean;
  coverageScope: CoverageScope;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SourceFeedAttrs {
  id: string;
  sourceId: string;
  feedType: FeedType;
  url: string;
  isActive: boolean;
  lastEtag: string | null;
  lastModified: string | null;
  lastFetchedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SourceHealthAttrs {
  sourceId: string;
  status: HealthStatus;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  consecutiveFailures: number;
  lastErrorMessage: string | null;
  updatedAt?: Date;
}

export interface RawArticleAttrs {
  id: string;
  sourceId: string;
  canonicalUrl: string;
  urlHash: string;
  title: string | null;
  status: ArticleStatus;
  discoveredAt: Date;
  publishedAt: Date | null;
  fetchedAt: Date | null;
  parsedAt: Date | null;
  contentHash: string | null;
  httpStatus: number | null;
  errorMessage: string | null;
  idempotencyKey: string;
  attemptCount: number;
  storagePath: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ArticleContentAttrs {
  articleId: string;
  storagePath: string | null;
  extractedTitle: string | null;
  byline: string | null;
  language: string | null;
  textContent: string;
  htmlContent: string | null;
  wordCount: number;
  charCount: number;
  parserVersion: string;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  parsedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AppSettingAttrs {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt?: Date;
}

export interface AuditLogAttrs {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt?: Date;
}

export interface RefreshTokenAttrs {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt?: Date;
}

export interface CrawlRunAttrs {
  id: string;
  sourceId: string;
  sourceFeedId: string | null;
  status: CrawlRunStatus;
  trigger: CrawlTrigger;
  jobId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  discoveredCount: number;
  fetchedCount: number;
  errorCount: number;
  feedUrl: string | null;
  httpStatus: number | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CrawlErrorAttrs {
  id: string;
  crawlRunId: string;
  sourceId: string;
  url: string | null;
  code: string;
  message: string;
  createdAt?: Date;
}

export interface PromptTemplateAttrs {
  id: string;
  name: string;
  pipelineStage: string;
  description: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PromptVersionAttrs {
  id: string;
  templateId: string;
  version: number;
  provider: string;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
  jsonSchema: unknown;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiRequestAttrs {
  id: string;
  provider: string;
  model: string;
  pipelineStage: string;
  promptVersionId: string | null;
  relatedArticleId: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  estimatedCost: number;
  actualCost: number | null;
  latencyMs: number;
  status: string;
  error: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
}

export interface ArticleExtractionAttrs {
  id: string;
  articleId: string;
  promptVersionId: string | null;
  aiRequestId: string | null;
  cardJson: Record<string, unknown>;
  isRelevant: boolean;
  scope: string | null;
  category: string | null;
  headlineFa: string | null;
  summaryFa: string | null;
  officialStatus: string | null;
  importanceScore: number | null;
  credibilityScore: number | null;
  freshnessScore: number | null;
  validationErrors: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NewsEventAttrs {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  scope: string | null;
  category: string | null;
  officialStatus: string | null;
  importanceScore: number | null;
  credibilityScore: number | null;
  freshnessScore: number | null;
  primaryArticleId: string | null;
  articleCount: number;
  fingerprint: string | null;
  metadata: Record<string, unknown> | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NewsEventArticleAttrs {
  id: string;
  eventId: string;
  articleId: string;
  extractionId: string | null;
  role: string;
  matchMethod: string | null;
  similarityScore: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NewsEventConflictAttrs {
  id: string;
  eventId: string;
  articleId: string;
  otherEventId: string | null;
  conflictType: string;
  status: string;
  details: Record<string, unknown> | null;
  resolvedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ArticleEmbeddingAttrs {
  articleId: string;
  extractionId: string | null;
  provider: string;
  model: string;
  dimensions: number;
  embedding: number[];
  contentHash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EditorialRuleAttrs {
  id: string;
  code: string;
  titleFa: string;
  descriptionFa: string | null;
  severity: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EditorialScoreAttrs {
  id: string;
  eventId: string;
  finalScore: number;
  factors: Record<string, unknown>;
  penalties: Record<string, unknown>;
  ruleHits: string[];
  breakdown: Record<string, unknown> | null;
  scorerVersion: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EditorialDecisionAttrs {
  id: string;
  eventId: string;
  actorUserId: string | null;
  decision: string;
  reason: string | null;
  previousStatus: string | null;
  nextStatus: string;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
}

export interface EditorialNoteAttrs {
  id: string;
  eventId: string;
  authorUserId: string | null;
  body: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PodcastEpisodeAttrs {
  id: string;
  title: string;
  slug: string;
  status: string;
  language: string;
  targetDurationMin: number;
  hostNotes: string | null;
  createdBy: string | null;
  currentScriptVersionId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PodcastEpisodeItemAttrs {
  id: string;
  episodeId: string;
  eventId: string;
  sortOrder: number;
  isSelected: boolean;
  editorNote: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PodcastScriptVersionAttrs {
  id: string;
  episodeId: string;
  version: number;
  status: string;
  title: string;
  bodyMd: string;
  wordCount: number;
  estimatedDurationSec: number;
  claimsJson: unknown[];
  segmentsJson: unknown[];
  factCheckJson: Record<string, unknown> | null;
  generator: string;
  createdBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PodcastAudioAttrs {
  id: string;
  episodeId: string;
  scriptVersionId: string | null;
  provider: string;
  model: string;
  voiceId: string;
  mimeType: string;
  storagePath: string;
  publicUrl: string | null;
  fileSizeBytes: number;
  durationSec: number;
  reportedDurationSec: number;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PodcastPublicationAttrs {
  id: string;
  episodeId: string;
  audioId: string;
  title: string;
  description: string | null;
  audioUrl: string;
  guid: string;
  publishedAt: Date;
  rssMetadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}
