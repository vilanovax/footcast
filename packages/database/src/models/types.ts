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
  relatedEpisodeId: string | null;
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

export interface NotificationAttrs {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  readAt: Date | null;
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
  /** @deprecated mirrors effectiveFinalScore / automatic final for legacy clients */
  importanceScore: number | null;
  credibilityScore: number | null;
  freshnessScore: number | null;
  podcastValueScore: number | null;
  effectiveFinalScore: number | null;
  recommendation: string | null;
  primaryArticleId: string | null;
  articleCount: number;
  independentSourceCount: number;
  eventAction: string | null;
  eventSignature: Record<string, unknown> | null;
  latestDevelopmentSummary: string | null;
  mergedIntoEventId: string | null;
  fingerprint: string | null;
  metadata: Record<string, unknown> | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClusterDecisionLogAttrs {
  id: string;
  rawArticleId: string;
  selectedEventId: string | null;
  decision: string;
  relationship: string | null;
  finalSimilarity: number | null;
  similarityBreakdown: Record<string, unknown> | null;
  candidateSnapshot: unknown;
  thresholdPolicyVersion: string;
  aiUsed: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  aiConfidence: number | null;
  reason: string | null;
  processingDurationMs: number | null;
  createdAt?: Date;
}

export interface ClusteringEvaluationAttrs {
  id: string;
  rawArticleId: string;
  predictedEventId: string | null;
  predictedRelationship: string | null;
  predictedScore: number | null;
  expectedEventId: string | null;
  expectedRelationship: string;
  verdict: string;
  reviewerId: string | null;
  note: string | null;
  decisionLogId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EntityAttrs {
  id: string;
  type: string;
  canonicalName: string;
  normalizedName: string;
  externalId: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EntityAliasAttrs {
  id: string;
  entityId: string;
  alias: string;
  normalizedAlias: string;
  language: string | null;
  sourceId: string | null;
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
  relationshipDecision: string | null;
  similarityBreakdown: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EventTimelineItemAttrs {
  id: string;
  newsEventId: string;
  rawArticleId: string | null;
  sourceId: string | null;
  developmentType: string;
  action: string | null;
  summary: string;
  occurredAt: Date | null;
  publishedAt: Date | null;
  isMajorDevelopment: boolean;
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
  credibilityScore: number | null;
  importanceScore: number | null;
  podcastValueScore: number | null;
  rawFinalScore: number | null;
  totalBonus: number;
  totalPenalty: number;
  recommendation: string | null;
  factors: Record<string, unknown>;
  penalties: Record<string, unknown>;
  ruleHits: string[];
  breakdown: Record<string, unknown> | null;
  reasons: unknown[] | null;
  bonuses: unknown[] | null;
  penaltyItems: unknown[] | null;
  inputSnapshot: Record<string, unknown> | null;
  scorerVersion: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EditorialScoreOverrideAttrs {
  id: string;
  newsEventId: string;
  automaticFinalScore: number;
  overriddenFinalScore: number;
  reason: string;
  userId: string | null;
  createdAt?: Date;
  revokedAt: Date | null;
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

export interface IntakeWaveAttrs {
  id: string;
  editorialDate: string;
  timezone: string;
  label: string;
  profile: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  status: string;
  sourcesChecked: number;
  articlesDiscovered: number;
  articlesNew: number;
  exactDuplicates: number;
  nearDuplicates: number;
  eventsCreated: number;
  eventsUpdated: number;
  failedSources: number;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WaveEventObservationAttrs {
  id: string;
  waveId: string;
  newsEventId: string;
  observationType: string;
  previousVersionId: string | null;
  currentVersionId: string | null;
  rawArticleIds: string[] | null;
  detectedAt: Date;
  isSeenByEditor: boolean;
  seenAt: Date | null;
  significanceScore: number | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DailyRundownAttrs {
  id: string;
  editorialDate: string;
  timezone: string;
  deadlineAt: Date;
  status: string;
  targetDurationSeconds: number;
  lockedAt: Date | null;
  lockedBy: string | null;
  finalizedAt: Date | null;
  reopenReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DailyRundownItemAttrs {
  id: string;
  rundownId: string;
  newsEventId: string;
  status: string;
  section: string;
  editorialPriority: number;
  effectiveScore: number | null;
  estimatedDurationSeconds: number;
  position: number;
  addedBy: string | null;
  addedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
  isLeadStory: boolean;
  isPinned: boolean;
  editorNote: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EditorialTeamAttrs {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string | null;
  scope: string | null;
  isKeyTeam: boolean;
  aliases: string[] | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CompetitionAttrs {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string | null;
  kind: string;
  region: string | null;
  aliases: string[] | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TrackedEventAttrs {
  id: string;
  slug: string;
  title: string;
  type: string;
  competitionId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  targetNewsCount: number | null;
  targetDurationSeconds: number | null;
  activeBoost: number;
  aliases: string[] | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NewsEventTeamAttrs {
  id: string;
  newsEventId: string;
  teamId: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NewsEventCompetitionAttrs {
  id: string;
  newsEventId: string;
  competitionId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NewsEventTrackedEventAttrs {
  id: string;
  newsEventId: string;
  trackedEventId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CoverageTargetAttrs {
  id: string;
  dimension: string;
  key: string;
  label: string | null;
  minSelectedCount: number | null;
  maxSelectedCount: number | null;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  priority: number;
  enforcement: string;
  editorialProfileId: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EditorialEntityWeightAttrs {
  id: string;
  entityType: string;
  entityId: string;
  entityKey: string;
  baseWeight: number;
  audienceWeight: number;
  eventBoost: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
