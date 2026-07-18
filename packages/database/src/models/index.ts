import {
  DataTypes,
  Sequelize,
  type ModelStatic,
  type Model,
} from 'sequelize';
import {
  ArticleStatus,
  CoverageScope,
  CrawlRunStatus,
  CrawlTrigger,
  EpisodeStatus,
  EventStatus,
  FeedType,
  HealthStatus,
  SourceType,
} from '@footcast/shared';
import type {
  AiRequestAttrs,
  AppSettingAttrs,
  ArticleContentAttrs,
  ArticleEmbeddingAttrs,
  ArticleExtractionAttrs,
  AuditLogAttrs,
  CrawlErrorAttrs,
  CrawlRunAttrs,
  EditorialDecisionAttrs,
  EditorialNoteAttrs,
  EditorialRuleAttrs,
  EditorialScoreAttrs,
  EditorialScoreOverrideAttrs,
  EntityAliasAttrs,
  EntityAttrs,
  EventTimelineItemAttrs,
  ClusterDecisionLogAttrs,
  ClusteringEvaluationAttrs,
  CompetitionAttrs,
  CoverageTargetAttrs,
  DailyRundownAttrs,
  DailyRundownItemAttrs,
  EditorialEntityWeightAttrs,
  EditorialTeamAttrs,
  IntakeWaveAttrs,
  NewsEventArticleAttrs,
  NewsEventCompetitionAttrs,
  NewsEventTeamAttrs,
  NewsEventTrackedEventAttrs,
  TrackedEventAttrs,
  NewsEventAttrs,
  NewsEventConflictAttrs,
  NotificationAttrs,
  PodcastAudioAttrs,
  PodcastEpisodeAttrs,
  PodcastEpisodeItemAttrs,
  PodcastPublicationAttrs,
  PodcastScriptVersionAttrs,
  PermissionAttrs,
  PromptTemplateAttrs,
  PromptVersionAttrs,
  RawArticleAttrs,
  RefreshTokenAttrs,
  RoleAttrs,
  SourceAttrs,
  SourceFeedAttrs,
  SourceHealthAttrs,
  UserAttrs,
  WaveEventObservationAttrs,
} from './types.js';

export type DbModels = {
  User: ModelStatic<Model<UserAttrs>>;
  Role: ModelStatic<Model<RoleAttrs>>;
  Permission: ModelStatic<Model<PermissionAttrs>>;
  UserRole: ModelStatic<Model<{ userId: string; roleId: string }>>;
  RolePermission: ModelStatic<Model<{ roleId: string; permissionId: string }>>;
  Source: ModelStatic<Model<SourceAttrs>>;
  SourceFeed: ModelStatic<Model<SourceFeedAttrs>>;
  SourceHealth: ModelStatic<Model<SourceHealthAttrs>>;
  RawArticle: ModelStatic<Model<RawArticleAttrs>>;
  ArticleContent: ModelStatic<Model<ArticleContentAttrs>>;
  CrawlRun: ModelStatic<Model<CrawlRunAttrs>>;
  CrawlError: ModelStatic<Model<CrawlErrorAttrs>>;
  PromptTemplate: ModelStatic<Model<PromptTemplateAttrs>>;
  PromptVersion: ModelStatic<Model<PromptVersionAttrs>>;
  AiRequest: ModelStatic<Model<AiRequestAttrs>>;
  ArticleExtraction: ModelStatic<Model<ArticleExtractionAttrs>>;
  NewsEvent: ModelStatic<Model<NewsEventAttrs>>;
  NewsEventArticle: ModelStatic<Model<NewsEventArticleAttrs>>;
  NewsEventConflict: ModelStatic<Model<NewsEventConflictAttrs>>;
  EventTimelineItem: ModelStatic<Model<EventTimelineItemAttrs>>;
  ClusterDecisionLog: ModelStatic<Model<ClusterDecisionLogAttrs>>;
  ClusteringEvaluation: ModelStatic<Model<ClusteringEvaluationAttrs>>;
  Entity: ModelStatic<Model<EntityAttrs>>;
  EntityAlias: ModelStatic<Model<EntityAliasAttrs>>;
  ArticleEmbedding: ModelStatic<Model<ArticleEmbeddingAttrs>>;
  EditorialRule: ModelStatic<Model<EditorialRuleAttrs>>;
  EditorialScore: ModelStatic<Model<EditorialScoreAttrs>>;
  EditorialScoreOverride: ModelStatic<Model<EditorialScoreOverrideAttrs>>;
  EditorialDecision: ModelStatic<Model<EditorialDecisionAttrs>>;
  EditorialNote: ModelStatic<Model<EditorialNoteAttrs>>;
  PodcastEpisode: ModelStatic<Model<PodcastEpisodeAttrs>>;
  PodcastEpisodeItem: ModelStatic<Model<PodcastEpisodeItemAttrs>>;
  PodcastScriptVersion: ModelStatic<Model<PodcastScriptVersionAttrs>>;
  PodcastAudio: ModelStatic<Model<PodcastAudioAttrs>>;
  PodcastPublication: ModelStatic<Model<PodcastPublicationAttrs>>;
  IntakeWave: ModelStatic<Model<IntakeWaveAttrs>>;
  WaveEventObservation: ModelStatic<Model<WaveEventObservationAttrs>>;
  DailyRundown: ModelStatic<Model<DailyRundownAttrs>>;
  DailyRundownItem: ModelStatic<Model<DailyRundownItemAttrs>>;
  EditorialTeam: ModelStatic<Model<EditorialTeamAttrs>>;
  Competition: ModelStatic<Model<CompetitionAttrs>>;
  TrackedEvent: ModelStatic<Model<TrackedEventAttrs>>;
  NewsEventTeam: ModelStatic<Model<NewsEventTeamAttrs>>;
  NewsEventCompetition: ModelStatic<Model<NewsEventCompetitionAttrs>>;
  NewsEventTrackedEvent: ModelStatic<Model<NewsEventTrackedEventAttrs>>;
  CoverageTarget: ModelStatic<Model<CoverageTargetAttrs>>;
  EditorialEntityWeight: ModelStatic<Model<EditorialEntityWeightAttrs>>;
  Notification: ModelStatic<Model<NotificationAttrs>>;
  AppSetting: ModelStatic<Model<AppSettingAttrs>>;
  AuditLog: ModelStatic<Model<AuditLogAttrs>>;
  RefreshToken: ModelStatic<Model<RefreshTokenAttrs>>;
};

export function initModels(sequelize: Sequelize): DbModels {
  const User = sequelize.define<Model<UserAttrs>>(
    'User',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      displayName: { type: DataTypes.STRING(120), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'users', underscored: true },
  );

  const Role = sequelize.define<Model<RoleAttrs>>(
    'Role',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255), allowNull: true },
    },
    { tableName: 'roles', underscored: true },
  );

  const Permission = sequelize.define<Model<PermissionAttrs>>(
    'Permission',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      code: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255), allowNull: true },
    },
    { tableName: 'permissions', underscored: true },
  );

  const UserRole = sequelize.define(
    'UserRole',
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      roleId: { type: DataTypes.UUID, primaryKey: true },
    },
    { tableName: 'user_roles', underscored: true, timestamps: false },
  );

  const RolePermission = sequelize.define(
    'RolePermission',
    {
      roleId: { type: DataTypes.UUID, primaryKey: true },
      permissionId: { type: DataTypes.UUID, primaryKey: true },
    },
    { tableName: 'role_permissions', underscored: true, timestamps: false },
  );

  const Source = sequelize.define<Model<SourceAttrs>>(
    'Source',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      sourceType: {
        type: DataTypes.STRING(64),
        allowNull: false,
        validate: { isIn: [Object.values(SourceType)] },
      },
      countryCode: { type: DataTypes.STRING(2), allowNull: true },
      language: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'fa' },
      baseUrl: { type: DataTypes.STRING(500), allowNull: false },
      rssUrl: { type: DataTypes.STRING(500), allowNull: true },
      sitemapUrl: { type: DataTypes.STRING(500), allowNull: true },
      credibilitySeed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
      fetchIntervalSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 900 },
      requiresJavascript: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      rateLimitPerMinute: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      coverageScope: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: CoverageScope.IRAN,
        validate: { isIn: [Object.values(CoverageScope)] },
      },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'sources', underscored: true },
  );

  const SourceFeed = sequelize.define<Model<SourceFeedAttrs>>(
    'SourceFeed',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      sourceId: { type: DataTypes.UUID, allowNull: false },
      feedType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        validate: { isIn: [Object.values(FeedType)] },
      },
      url: { type: DataTypes.STRING(500), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastEtag: { type: DataTypes.STRING(255), allowNull: true },
      lastModified: { type: DataTypes.STRING(255), allowNull: true },
      lastFetchedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'source_feeds', underscored: true },
  );

  const SourceHealth = sequelize.define<Model<SourceHealthAttrs>>(
    'SourceHealth',
    {
      sourceId: { type: DataTypes.UUID, primaryKey: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: HealthStatus.UNKNOWN,
        validate: { isIn: [Object.values(HealthStatus)] },
      },
      lastSuccessAt: { type: DataTypes.DATE, allowNull: true },
      lastErrorAt: { type: DataTypes.DATE, allowNull: true },
      consecutiveFailures: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastErrorMessage: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: 'source_health', underscored: true, updatedAt: true, createdAt: false },
  );

  const RawArticle = sequelize.define<Model<RawArticleAttrs>>(
    'RawArticle',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      sourceId: { type: DataTypes.UUID, allowNull: false },
      canonicalUrl: { type: DataTypes.STRING(1000), allowNull: false },
      urlHash: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(500), allowNull: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ArticleStatus.DISCOVERED,
        validate: { isIn: [Object.values(ArticleStatus)] },
      },
      discoveredAt: { type: DataTypes.DATE, allowNull: false },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      fetchedAt: { type: DataTypes.DATE, allowNull: true },
      parsedAt: { type: DataTypes.DATE, allowNull: true },
      contentHash: { type: DataTypes.STRING(64), allowNull: true },
      httpStatus: { type: DataTypes.INTEGER, allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      idempotencyKey: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      storagePath: { type: DataTypes.STRING(1000), allowNull: true },
    },
    { tableName: 'raw_articles', underscored: true },
  );

  const ArticleContent = sequelize.define<Model<ArticleContentAttrs>>(
    'ArticleContent',
    {
      articleId: { type: DataTypes.UUID, primaryKey: true },
      storagePath: { type: DataTypes.STRING(1000), allowNull: true },
      extractedTitle: { type: DataTypes.STRING(500), allowNull: true },
      byline: { type: DataTypes.STRING(300), allowNull: true },
      language: { type: DataTypes.STRING(16), allowNull: true },
      textContent: { type: DataTypes.TEXT, allowNull: false },
      htmlContent: { type: DataTypes.TEXT, allowNull: true },
      wordCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      charCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      parserVersion: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '1.0.0' },
      contentHash: { type: DataTypes.STRING(64), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      parsedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: 'article_contents', underscored: true },
  );

  const AppSetting = sequelize.define<Model<AppSettingAttrs>>(
    'AppSetting',
    {
      key: { type: DataTypes.STRING(120), primaryKey: true },
      value: { type: DataTypes.JSONB, allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
    },
    { tableName: 'app_settings', underscored: true, createdAt: false, updatedAt: true },
  );

  const AuditLog = sequelize.define<Model<AuditLogAttrs>>(
    'AuditLog',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      actorUserId: { type: DataTypes.UUID, allowNull: true },
      action: { type: DataTypes.STRING(120), allowNull: false },
      entityType: { type: DataTypes.STRING(120), allowNull: false },
      entityId: { type: DataTypes.STRING(120), allowNull: true },
      before: { type: DataTypes.JSONB, allowNull: true },
      after: { type: DataTypes.JSONB, allowNull: true },
      ip: { type: DataTypes.STRING(64), allowNull: true },
    },
    { tableName: 'audit_logs', underscored: true, updatedAt: false },
  );

  const RefreshToken = sequelize.define<Model<RefreshTokenAttrs>>(
    'RefreshToken',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      replacedByTokenId: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'refresh_tokens', underscored: true, updatedAt: false },
  );

  const CrawlRun = sequelize.define<Model<CrawlRunAttrs>>(
    'CrawlRun',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      sourceId: { type: DataTypes.UUID, allowNull: false },
      sourceFeedId: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: CrawlRunStatus.PENDING,
        validate: { isIn: [Object.values(CrawlRunStatus)] },
      },
      trigger: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: CrawlTrigger.SCHEDULE,
        validate: { isIn: [Object.values(CrawlTrigger)] },
      },
      jobId: { type: DataTypes.STRING(128), allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      discoveredCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      fetchedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      errorCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      feedUrl: { type: DataTypes.STRING(500), allowNull: true },
      httpStatus: { type: DataTypes.INTEGER, allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'crawl_runs', underscored: true },
  );

  const CrawlError = sequelize.define<Model<CrawlErrorAttrs>>(
    'CrawlError',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      crawlRunId: { type: DataTypes.UUID, allowNull: false },
      sourceId: { type: DataTypes.UUID, allowNull: false },
      url: { type: DataTypes.STRING(1000), allowNull: true },
      code: { type: DataTypes.STRING(64), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: 'crawl_errors', underscored: true, updatedAt: false },
  );

  const PromptTemplate = sequelize.define<Model<PromptTemplateAttrs>>(
    'PromptTemplate',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      pipelineStage: { type: DataTypes.STRING(64), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
    },
    { tableName: 'prompt_templates', underscored: true },
  );

  const PromptVersion = sequelize.define<Model<PromptVersionAttrs>>(
    'PromptVersion',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      templateId: { type: DataTypes.UUID, allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false },
      provider: { type: DataTypes.STRING(64), allowNull: false },
      model: { type: DataTypes.STRING(120), allowNull: false },
      systemPrompt: { type: DataTypes.TEXT, allowNull: false },
      userPromptTemplate: { type: DataTypes.TEXT, allowNull: false },
      jsonSchema: { type: DataTypes.JSONB, allowNull: true },
      temperature: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.2 },
      maxTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2000 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdBy: { type: DataTypes.STRING(120), allowNull: true },
    },
    { tableName: 'prompt_versions', underscored: true },
  );

  const AiRequest = sequelize.define<Model<AiRequestAttrs>>(
    'AiRequest',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      provider: { type: DataTypes.STRING(64), allowNull: false },
      model: { type: DataTypes.STRING(120), allowNull: false },
      pipelineStage: { type: DataTypes.STRING(64), allowNull: false },
      promptVersionId: { type: DataTypes.UUID, allowNull: true },
      relatedArticleId: { type: DataTypes.UUID, allowNull: true },
      relatedEpisodeId: { type: DataTypes.UUID, allowNull: true },
      inputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      outputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      cachedInputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      reasoningTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      estimatedCost: { type: DataTypes.DECIMAL(12, 6), allowNull: false, defaultValue: 0 },
      actualCost: { type: DataTypes.DECIMAL(12, 6), allowNull: true },
      latencyMs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.STRING(32), allowNull: false },
      error: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'ai_requests', underscored: true, updatedAt: false },
  );

  const ArticleExtraction = sequelize.define<Model<ArticleExtractionAttrs>>(
    'ArticleExtraction',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      articleId: { type: DataTypes.UUID, allowNull: false },
      promptVersionId: { type: DataTypes.UUID, allowNull: true },
      aiRequestId: { type: DataTypes.UUID, allowNull: true },
      cardJson: { type: DataTypes.JSONB, allowNull: false },
      isRelevant: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      scope: { type: DataTypes.STRING(32), allowNull: true },
      category: { type: DataTypes.STRING(64), allowNull: true },
      headlineFa: { type: DataTypes.STRING(500), allowNull: true },
      summaryFa: { type: DataTypes.TEXT, allowNull: true },
      officialStatus: { type: DataTypes.STRING(64), allowNull: true },
      importanceScore: { type: DataTypes.INTEGER, allowNull: true },
      credibilityScore: { type: DataTypes.INTEGER, allowNull: true },
      freshnessScore: { type: DataTypes.INTEGER, allowNull: true },
      validationErrors: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'article_extractions', underscored: true },
  );

  const NewsEvent = sequelize.define<Model<NewsEventAttrs>>(
    'NewsEvent',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      title: { type: DataTypes.STRING(500), allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: EventStatus.NEW,
        validate: { isIn: [Object.values(EventStatus)] },
      },
      scope: { type: DataTypes.STRING(32), allowNull: true },
      category: { type: DataTypes.STRING(64), allowNull: true },
      officialStatus: { type: DataTypes.STRING(64), allowNull: true },
      importanceScore: { type: DataTypes.INTEGER, allowNull: true },
      credibilityScore: { type: DataTypes.INTEGER, allowNull: true },
      freshnessScore: { type: DataTypes.INTEGER, allowNull: true },
      podcastValueScore: { type: DataTypes.FLOAT, allowNull: true },
      effectiveFinalScore: { type: DataTypes.FLOAT, allowNull: true },
      recommendation: { type: DataTypes.STRING(64), allowNull: true },
      primaryArticleId: { type: DataTypes.UUID, allowNull: true },
      articleCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      independentSourceCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      eventAction: { type: DataTypes.STRING(64), allowNull: true },
      eventSignature: { type: DataTypes.JSONB, allowNull: true },
      latestDevelopmentSummary: { type: DataTypes.TEXT, allowNull: true },
      mergedIntoEventId: { type: DataTypes.UUID, allowNull: true },
      fingerprint: { type: DataTypes.STRING(64), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      firstSeenAt: { type: DataTypes.DATE, allowNull: false },
      lastSeenAt: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: 'news_events', underscored: true },
  );

  const NewsEventArticle = sequelize.define<Model<NewsEventArticleAttrs>>(
    'NewsEventArticle',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      eventId: { type: DataTypes.UUID, allowNull: false },
      articleId: { type: DataTypes.UUID, allowNull: false, unique: true },
      extractionId: { type: DataTypes.UUID, allowNull: true },
      role: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'PRIMARY' },
      matchMethod: { type: DataTypes.STRING(32), allowNull: true },
      similarityScore: { type: DataTypes.FLOAT, allowNull: true },
      relationshipDecision: { type: DataTypes.STRING(64), allowNull: true },
      similarityBreakdown: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'news_event_articles', underscored: true },
  );

  const EventTimelineItem = sequelize.define<Model<EventTimelineItemAttrs>>(
    'EventTimelineItem',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      newsEventId: { type: DataTypes.UUID, allowNull: false },
      rawArticleId: { type: DataTypes.UUID, allowNull: true },
      sourceId: { type: DataTypes.UUID, allowNull: true },
      developmentType: { type: DataTypes.STRING(64), allowNull: false },
      action: { type: DataTypes.STRING(64), allowNull: true },
      summary: { type: DataTypes.TEXT, allowNull: false },
      occurredAt: { type: DataTypes.DATE, allowNull: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      isMajorDevelopment: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    { tableName: 'event_timeline_items', underscored: true },
  );

  const ClusterDecisionLog = sequelize.define<Model<ClusterDecisionLogAttrs>>(
    'ClusterDecisionLog',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      rawArticleId: { type: DataTypes.UUID, allowNull: false },
      selectedEventId: { type: DataTypes.UUID, allowNull: true },
      decision: { type: DataTypes.STRING(32), allowNull: false },
      relationship: { type: DataTypes.STRING(64), allowNull: true },
      finalSimilarity: { type: DataTypes.FLOAT, allowNull: true },
      similarityBreakdown: { type: DataTypes.JSONB, allowNull: true },
      candidateSnapshot: { type: DataTypes.JSONB, allowNull: true },
      thresholdPolicyVersion: { type: DataTypes.STRING(32), allowNull: false },
      aiUsed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      aiProvider: { type: DataTypes.STRING(64), allowNull: true },
      aiModel: { type: DataTypes.STRING(64), allowNull: true },
      aiConfidence: { type: DataTypes.FLOAT, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      processingDurationMs: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'cluster_decision_logs', underscored: true, updatedAt: false },
  );

  const ClusteringEvaluation = sequelize.define<Model<ClusteringEvaluationAttrs>>(
    'ClusteringEvaluation',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      rawArticleId: { type: DataTypes.UUID, allowNull: false },
      predictedEventId: { type: DataTypes.UUID, allowNull: true },
      predictedRelationship: { type: DataTypes.STRING(64), allowNull: true },
      predictedScore: { type: DataTypes.FLOAT, allowNull: true },
      expectedEventId: { type: DataTypes.UUID, allowNull: true },
      expectedRelationship: { type: DataTypes.STRING(64), allowNull: false },
      verdict: { type: DataTypes.STRING(64), allowNull: false },
      reviewerId: { type: DataTypes.UUID, allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      decisionLogId: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'clustering_evaluations', underscored: true },
  );

  const Entity = sequelize.define<Model<EntityAttrs>>(
    'Entity',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      type: { type: DataTypes.STRING(32), allowNull: false },
      canonicalName: { type: DataTypes.STRING(255), allowNull: false },
      normalizedName: { type: DataTypes.STRING(255), allowNull: false },
      externalId: { type: DataTypes.STRING(128), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'entities', underscored: true },
  );

  const EntityAlias = sequelize.define<Model<EntityAliasAttrs>>(
    'EntityAlias',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      entityId: { type: DataTypes.UUID, allowNull: false },
      alias: { type: DataTypes.STRING(255), allowNull: false },
      normalizedAlias: { type: DataTypes.STRING(255), allowNull: false },
      language: { type: DataTypes.STRING(8), allowNull: true },
      sourceId: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'entity_aliases', underscored: true },
  );

  const NewsEventConflict = sequelize.define<Model<NewsEventConflictAttrs>>(
    'NewsEventConflict',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      eventId: { type: DataTypes.UUID, allowNull: false },
      articleId: { type: DataTypes.UUID, allowNull: false },
      otherEventId: { type: DataTypes.UUID, allowNull: true },
      conflictType: { type: DataTypes.STRING(64), allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'open' },
      details: { type: DataTypes.JSONB, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'news_event_conflicts', underscored: true },
  );

  const ArticleEmbedding = sequelize.define<Model<ArticleEmbeddingAttrs>>(
    'ArticleEmbedding',
    {
      articleId: { type: DataTypes.UUID, primaryKey: true },
      extractionId: { type: DataTypes.UUID, allowNull: true },
      provider: { type: DataTypes.STRING(64), allowNull: false },
      model: { type: DataTypes.STRING(120), allowNull: false },
      dimensions: { type: DataTypes.INTEGER, allowNull: false },
      embedding: { type: DataTypes.JSONB, allowNull: false },
      contentHash: { type: DataTypes.STRING(64), allowNull: false },
    },
    { tableName: 'article_embeddings', underscored: true },
  );

  const EditorialRule = sequelize.define<Model<EditorialRuleAttrs>>(
    'EditorialRule',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      code: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      titleFa: { type: DataTypes.STRING(255), allowNull: false },
      descriptionFa: { type: DataTypes.TEXT, allowNull: true },
      severity: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'soft' },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      config: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'editorial_rules', underscored: true },
  );

  const EditorialScore = sequelize.define<Model<EditorialScoreAttrs>>(
    'EditorialScore',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      eventId: { type: DataTypes.UUID, allowNull: false },
      finalScore: { type: DataTypes.FLOAT, allowNull: false },
      credibilityScore: { type: DataTypes.FLOAT, allowNull: true },
      importanceScore: { type: DataTypes.FLOAT, allowNull: true },
      podcastValueScore: { type: DataTypes.FLOAT, allowNull: true },
      rawFinalScore: { type: DataTypes.FLOAT, allowNull: true },
      totalBonus: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      totalPenalty: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      recommendation: { type: DataTypes.STRING(64), allowNull: true },
      factors: { type: DataTypes.JSONB, allowNull: false },
      penalties: { type: DataTypes.JSONB, allowNull: false },
      ruleHits: { type: DataTypes.JSONB, allowNull: false },
      breakdown: { type: DataTypes.JSONB, allowNull: true },
      reasons: { type: DataTypes.JSONB, allowNull: true },
      bonuses: { type: DataTypes.JSONB, allowNull: true },
      penaltyItems: { type: DataTypes.JSONB, allowNull: true },
      inputSnapshot: { type: DataTypes.JSONB, allowNull: true },
      scorerVersion: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '1.0.0' },
    },
    { tableName: 'editorial_scores', underscored: true },
  );

  const EditorialScoreOverride = sequelize.define<Model<EditorialScoreOverrideAttrs>>(
    'EditorialScoreOverride',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      newsEventId: { type: DataTypes.UUID, allowNull: false },
      automaticFinalScore: { type: DataTypes.FLOAT, allowNull: false },
      overriddenFinalScore: { type: DataTypes.FLOAT, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'editorial_score_overrides',
      underscored: true,
      updatedAt: false,
    },
  );

  const EditorialDecision = sequelize.define<Model<EditorialDecisionAttrs>>(
    'EditorialDecision',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      eventId: { type: DataTypes.UUID, allowNull: false },
      actorUserId: { type: DataTypes.UUID, allowNull: true },
      decision: { type: DataTypes.STRING(32), allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: true },
      previousStatus: { type: DataTypes.STRING(32), allowNull: true },
      nextStatus: { type: DataTypes.STRING(32), allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'editorial_decisions', underscored: true, updatedAt: false },
  );

  const EditorialNote = sequelize.define<Model<EditorialNoteAttrs>>(
    'EditorialNote',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      eventId: { type: DataTypes.UUID, allowNull: false },
      authorUserId: { type: DataTypes.UUID, allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: 'editorial_notes', underscored: true },
  );

  const PodcastEpisode = sequelize.define<Model<PodcastEpisodeAttrs>>(
    'PodcastEpisode',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      title: { type: DataTypes.STRING(300), allowNull: false },
      slug: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: EpisodeStatus.DRAFT,
        validate: { isIn: [Object.values(EpisodeStatus)] },
      },
      language: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'fa' },
      targetDurationMin: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
      hostNotes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      currentScriptVersionId: { type: DataTypes.UUID, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'podcast_episodes', underscored: true },
  );

  const PodcastEpisodeItem = sequelize.define<Model<PodcastEpisodeItemAttrs>>(
    'PodcastEpisodeItem',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      episodeId: { type: DataTypes.UUID, allowNull: false },
      eventId: { type: DataTypes.UUID, allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isSelected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      editorNote: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: 'podcast_episode_items', underscored: true },
  );

  const PodcastScriptVersion = sequelize.define<Model<PodcastScriptVersionAttrs>>(
    'PodcastScriptVersion',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      episodeId: { type: DataTypes.UUID, allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
      title: { type: DataTypes.STRING(300), allowNull: false },
      bodyMd: { type: DataTypes.TEXT, allowNull: false },
      wordCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      estimatedDurationSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      claimsJson: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      segmentsJson: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      factCheckJson: { type: DataTypes.JSONB, allowNull: true },
      generator: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'mock-v1' },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'podcast_script_versions', underscored: true },
  );

  const PodcastAudio = sequelize.define<Model<PodcastAudioAttrs>>(
    'PodcastAudio',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      episodeId: { type: DataTypes.UUID, allowNull: false },
      scriptVersionId: { type: DataTypes.UUID, allowNull: true },
      provider: { type: DataTypes.STRING(64), allowNull: false },
      model: { type: DataTypes.STRING(120), allowNull: false },
      voiceId: { type: DataTypes.STRING(120), allowNull: false },
      mimeType: { type: DataTypes.STRING(64), allowNull: false },
      storagePath: { type: DataTypes.STRING(1000), allowNull: false },
      publicUrl: { type: DataTypes.STRING(1000), allowNull: true },
      fileSizeBytes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      durationSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      reportedDurationSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'ready' },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'podcast_audios', underscored: true },
  );

  const PodcastPublication = sequelize.define<Model<PodcastPublicationAttrs>>(
    'PodcastPublication',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      episodeId: { type: DataTypes.UUID, allowNull: false, unique: true },
      audioId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(300), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      audioUrl: { type: DataTypes.STRING(1000), allowNull: false },
      guid: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      publishedAt: { type: DataTypes.DATE, allowNull: false },
      rssMetadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'podcast_publications', underscored: true },
  );

  const Notification = sequelize.define<Model<NotificationAttrs>>(
    'Notification',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      type: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: true },
      entityType: { type: DataTypes.STRING(64), allowNull: true },
      entityId: { type: DataTypes.STRING(64), allowNull: true },
      href: { type: DataTypes.STRING(500), allowNull: true },
      readAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'notifications', underscored: true, updatedAt: false },
  );

  User.belongsToMany(Role, {
    through: UserRole,
    foreignKey: 'userId',
    otherKey: 'roleId',
    as: 'roles',
  });
  Role.belongsToMany(User, {
    through: UserRole,
    foreignKey: 'roleId',
    otherKey: 'userId',
    as: 'users',
  });
  Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: 'roleId',
    otherKey: 'permissionId',
    as: 'permissions',
  });
  Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: 'permissionId',
    otherKey: 'roleId',
    as: 'roles',
  });

  Source.hasMany(SourceFeed, { foreignKey: 'sourceId', as: 'feeds' });
  SourceFeed.belongsTo(Source, { foreignKey: 'sourceId', as: 'source' });
  Source.hasOne(SourceHealth, { foreignKey: 'sourceId', as: 'health' });
  SourceHealth.belongsTo(Source, { foreignKey: 'sourceId', as: 'source' });
  Source.hasMany(RawArticle, { foreignKey: 'sourceId', as: 'articles' });
  RawArticle.belongsTo(Source, { foreignKey: 'sourceId', as: 'source' });
  RawArticle.hasOne(ArticleContent, { foreignKey: 'articleId', as: 'content' });
  ArticleContent.belongsTo(RawArticle, { foreignKey: 'articleId', as: 'article' });
  RawArticle.hasMany(ArticleExtraction, { foreignKey: 'articleId', as: 'extractions' });
  ArticleExtraction.belongsTo(RawArticle, { foreignKey: 'articleId', as: 'article' });
  RawArticle.hasOne(ArticleEmbedding, { foreignKey: 'articleId', as: 'embedding' });
  ArticleEmbedding.belongsTo(RawArticle, { foreignKey: 'articleId', as: 'article' });
  NewsEvent.hasMany(NewsEventArticle, { foreignKey: 'eventId', as: 'articles' });
  NewsEventArticle.belongsTo(NewsEvent, { foreignKey: 'eventId', as: 'event' });
  RawArticle.hasOne(NewsEventArticle, { foreignKey: 'articleId', as: 'eventLink' });
  NewsEventArticle.belongsTo(RawArticle, { foreignKey: 'articleId', as: 'article' });
  NewsEvent.hasMany(NewsEventConflict, { foreignKey: 'eventId', as: 'conflicts' });
  NewsEventConflict.belongsTo(NewsEvent, { foreignKey: 'eventId', as: 'event' });
  NewsEvent.hasMany(EventTimelineItem, {
    foreignKey: 'newsEventId',
    as: 'timelineItems',
  });
  EventTimelineItem.belongsTo(NewsEvent, {
    foreignKey: 'newsEventId',
    as: 'event',
  });
  NewsEvent.belongsTo(NewsEvent, {
    foreignKey: 'mergedIntoEventId',
    as: 'mergedInto',
  });
  ClusterDecisionLog.belongsTo(RawArticle, {
    foreignKey: 'rawArticleId',
    as: 'article',
  });
  ClusterDecisionLog.belongsTo(NewsEvent, {
    foreignKey: 'selectedEventId',
    as: 'selectedEvent',
  });
  ClusteringEvaluation.belongsTo(RawArticle, {
    foreignKey: 'rawArticleId',
    as: 'article',
  });
  ClusteringEvaluation.belongsTo(ClusterDecisionLog, {
    foreignKey: 'decisionLogId',
    as: 'decisionLog',
  });

  const IntakeWave = sequelize.define<Model<IntakeWaveAttrs>>(
    'IntakeWave',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      editorialDate: { type: DataTypes.DATEONLY, allowNull: false },
      timezone: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'Asia/Tehran',
      },
      label: { type: DataTypes.STRING(120), allowNull: false },
      profile: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'FULL',
      },
      scheduledAt: { type: DataTypes.DATE, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'RUNNING',
      },
      sourcesChecked: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      articlesDiscovered: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      articlesNew: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      exactDuplicates: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      nearDuplicates: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      eventsCreated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      eventsUpdated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failedSources: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'intake_waves', underscored: true },
  );

  const WaveEventObservation = sequelize.define<Model<WaveEventObservationAttrs>>(
    'WaveEventObservation',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      waveId: { type: DataTypes.UUID, allowNull: false },
      newsEventId: { type: DataTypes.UUID, allowNull: false },
      observationType: { type: DataTypes.STRING(64), allowNull: false },
      previousVersionId: { type: DataTypes.UUID, allowNull: true },
      currentVersionId: { type: DataTypes.UUID, allowNull: true },
      rawArticleIds: { type: DataTypes.JSONB, allowNull: true },
      detectedAt: { type: DataTypes.DATE, allowNull: false },
      isSeenByEditor: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      seenAt: { type: DataTypes.DATE, allowNull: true },
      significanceScore: { type: DataTypes.FLOAT, allowNull: true },
      summary: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'wave_event_observations', underscored: true },
  );

  const DailyRundown = sequelize.define<Model<DailyRundownAttrs>>(
    'DailyRundown',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      editorialDate: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
      timezone: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'Asia/Tehran',
      },
      deadlineAt: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'COLLECTING',
      },
      targetDurationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 600,
      },
      lockedAt: { type: DataTypes.DATE, allowNull: true },
      lockedBy: { type: DataTypes.UUID, allowNull: true },
      finalizedAt: { type: DataTypes.DATE, allowNull: true },
      reopenReason: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: 'daily_rundowns', underscored: true },
  );

  const DailyRundownItem = sequelize.define<Model<DailyRundownItemAttrs>>(
    'DailyRundownItem',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      rundownId: { type: DataTypes.UUID, allowNull: false },
      newsEventId: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'SHORTLISTED',
      },
      section: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'MAIN',
      },
      editorialPriority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
      },
      effectiveScore: { type: DataTypes.FLOAT, allowNull: true },
      estimatedDurationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60,
      },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      addedBy: { type: DataTypes.UUID, allowNull: true },
      addedAt: { type: DataTypes.DATE, allowNull: false },
      removedAt: { type: DataTypes.DATE, allowNull: true },
      removalReason: { type: DataTypes.TEXT, allowNull: true },
      isLeadStory: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isPinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      editorNote: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: 'daily_rundown_items', underscored: true },
  );

  IntakeWave.hasMany(WaveEventObservation, {
    foreignKey: 'waveId',
    as: 'observations',
  });
  WaveEventObservation.belongsTo(IntakeWave, {
    foreignKey: 'waveId',
    as: 'wave',
  });
  WaveEventObservation.belongsTo(NewsEvent, {
    foreignKey: 'newsEventId',
    as: 'event',
  });
  NewsEvent.hasMany(WaveEventObservation, {
    foreignKey: 'newsEventId',
    as: 'waveObservations',
  });
  DailyRundown.hasMany(DailyRundownItem, {
    foreignKey: 'rundownId',
    as: 'items',
  });
  DailyRundownItem.belongsTo(DailyRundown, {
    foreignKey: 'rundownId',
    as: 'rundown',
  });
  DailyRundownItem.belongsTo(NewsEvent, {
    foreignKey: 'newsEventId',
    as: 'event',
  });
  NewsEvent.hasMany(DailyRundownItem, {
    foreignKey: 'newsEventId',
    as: 'rundownItems',
  });

  const EditorialTeam = sequelize.define<Model<EditorialTeamAttrs>>(
    'EditorialTeam',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      nameFa: { type: DataTypes.STRING(120), allowNull: false },
      nameEn: { type: DataTypes.STRING(120), allowNull: true },
      scope: { type: DataTypes.STRING(32), allowNull: true },
      isKeyTeam: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      aliases: { type: DataTypes.JSONB, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'editorial_teams', underscored: true },
  );

  const Competition = sequelize.define<Model<CompetitionAttrs>>(
    'Competition',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      nameFa: { type: DataTypes.STRING(120), allowNull: false },
      nameEn: { type: DataTypes.STRING(120), allowNull: true },
      kind: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'LEAGUE' },
      region: { type: DataTypes.STRING(32), allowNull: true },
      aliases: { type: DataTypes.JSONB, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'competitions', underscored: true },
  );

  const TrackedEvent = sequelize.define<Model<TrackedEventAttrs>>(
    'TrackedEvent',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      type: { type: DataTypes.STRING(64), allowNull: false },
      competitionId: { type: DataTypes.UUID, allowNull: true },
      startsAt: { type: DataTypes.DATE, allowNull: true },
      endsAt: { type: DataTypes.DATE, allowNull: true },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
      targetNewsCount: { type: DataTypes.INTEGER, allowNull: true },
      targetDurationSeconds: { type: DataTypes.INTEGER, allowNull: true },
      activeBoost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      aliases: { type: DataTypes.JSONB, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'tracked_events', underscored: true },
  );

  const NewsEventTeam = sequelize.define<Model<NewsEventTeamAttrs>>(
    'NewsEventTeam',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      newsEventId: { type: DataTypes.UUID, allowNull: false },
      teamId: { type: DataTypes.UUID, allowNull: false },
      role: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'PRIMARY' },
    },
    { tableName: 'news_event_teams', underscored: true },
  );

  const NewsEventCompetition = sequelize.define<Model<NewsEventCompetitionAttrs>>(
    'NewsEventCompetition',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      newsEventId: { type: DataTypes.UUID, allowNull: false },
      competitionId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'news_event_competitions', underscored: true },
  );

  const NewsEventTrackedEvent = sequelize.define<Model<NewsEventTrackedEventAttrs>>(
    'NewsEventTrackedEvent',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      newsEventId: { type: DataTypes.UUID, allowNull: false },
      trackedEventId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'news_event_tracked_events', underscored: true },
  );

  const CoverageTarget = sequelize.define<Model<CoverageTargetAttrs>>(
    'CoverageTarget',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      dimension: { type: DataTypes.STRING(32), allowNull: false },
      key: { type: DataTypes.STRING(64), allowNull: false },
      label: { type: DataTypes.STRING(120), allowNull: true },
      minSelectedCount: { type: DataTypes.INTEGER, allowNull: true },
      maxSelectedCount: { type: DataTypes.INTEGER, allowNull: true },
      minDurationSeconds: { type: DataTypes.INTEGER, allowNull: true },
      maxDurationSeconds: { type: DataTypes.INTEGER, allowNull: true },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
      enforcement: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'SOFT',
      },
      editorialProfileId: { type: DataTypes.STRING(64), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'coverage_targets', underscored: true },
  );

  const EditorialEntityWeight = sequelize.define<Model<EditorialEntityWeightAttrs>>(
    'EditorialEntityWeight',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      entityType: { type: DataTypes.STRING(32), allowNull: false },
      entityId: { type: DataTypes.UUID, allowNull: false },
      entityKey: { type: DataTypes.STRING(64), allowNull: false },
      baseWeight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
      audienceWeight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
      eventBoost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      effectiveFrom: { type: DataTypes.DATE, allowNull: true },
      effectiveTo: { type: DataTypes.DATE, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'editorial_entity_weights', underscored: true },
  );

  NewsEvent.belongsToMany(EditorialTeam, {
    through: NewsEventTeam,
    foreignKey: 'newsEventId',
    otherKey: 'teamId',
    as: 'teams',
  });
  EditorialTeam.belongsToMany(NewsEvent, {
    through: NewsEventTeam,
    foreignKey: 'teamId',
    otherKey: 'newsEventId',
    as: 'events',
  });
  NewsEvent.belongsToMany(Competition, {
    through: NewsEventCompetition,
    foreignKey: 'newsEventId',
    otherKey: 'competitionId',
    as: 'competitions',
  });
  Competition.belongsToMany(NewsEvent, {
    through: NewsEventCompetition,
    foreignKey: 'competitionId',
    otherKey: 'newsEventId',
    as: 'events',
  });
  NewsEvent.belongsToMany(TrackedEvent, {
    through: NewsEventTrackedEvent,
    foreignKey: 'newsEventId',
    otherKey: 'trackedEventId',
    as: 'trackedEvents',
  });
  TrackedEvent.belongsToMany(NewsEvent, {
    through: NewsEventTrackedEvent,
    foreignKey: 'trackedEventId',
    otherKey: 'newsEventId',
    as: 'events',
  });
  TrackedEvent.belongsTo(Competition, {
    foreignKey: 'competitionId',
    as: 'competition',
  });

  Entity.hasMany(EntityAlias, { foreignKey: 'entityId', as: 'aliases' });
  EntityAlias.belongsTo(Entity, { foreignKey: 'entityId', as: 'entity' });
  NewsEvent.hasMany(EditorialScore, { foreignKey: 'eventId', as: 'scores' });
  EditorialScore.belongsTo(NewsEvent, { foreignKey: 'eventId', as: 'event' });
  NewsEvent.hasMany(EditorialScoreOverride, {
    foreignKey: 'newsEventId',
    as: 'scoreOverrides',
  });
  EditorialScoreOverride.belongsTo(NewsEvent, {
    foreignKey: 'newsEventId',
    as: 'event',
  });
  NewsEvent.hasMany(EditorialDecision, { foreignKey: 'eventId', as: 'decisions' });
  EditorialDecision.belongsTo(NewsEvent, { foreignKey: 'eventId', as: 'event' });
  NewsEvent.hasMany(EditorialNote, { foreignKey: 'eventId', as: 'notes' });
  EditorialNote.belongsTo(NewsEvent, { foreignKey: 'eventId', as: 'event' });
  PodcastEpisode.hasMany(PodcastEpisodeItem, { foreignKey: 'episodeId', as: 'items' });
  PodcastEpisodeItem.belongsTo(PodcastEpisode, { foreignKey: 'episodeId', as: 'episode' });
  PodcastEpisodeItem.belongsTo(NewsEvent, { foreignKey: 'eventId', as: 'event' });
  NewsEvent.hasMany(PodcastEpisodeItem, { foreignKey: 'eventId', as: 'podcastItems' });
  PodcastEpisode.hasMany(PodcastScriptVersion, { foreignKey: 'episodeId', as: 'scripts' });
  PodcastScriptVersion.belongsTo(PodcastEpisode, { foreignKey: 'episodeId', as: 'episode' });
  PodcastEpisode.hasMany(PodcastAudio, { foreignKey: 'episodeId', as: 'audios' });
  PodcastAudio.belongsTo(PodcastEpisode, { foreignKey: 'episodeId', as: 'episode' });
  PodcastEpisode.hasOne(PodcastPublication, { foreignKey: 'episodeId', as: 'publication' });
  PodcastPublication.belongsTo(PodcastEpisode, { foreignKey: 'episodeId', as: 'episode' });
  PodcastPublication.belongsTo(PodcastAudio, { foreignKey: 'audioId', as: 'audio' });
  PodcastEpisode.hasMany(AiRequest, { foreignKey: 'relatedEpisodeId', as: 'aiRequests' });
  AiRequest.belongsTo(PodcastEpisode, { foreignKey: 'relatedEpisodeId', as: 'episode' });
  User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
  Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  PromptTemplate.hasMany(PromptVersion, { foreignKey: 'templateId', as: 'versions' });
  PromptVersion.belongsTo(PromptTemplate, { foreignKey: 'templateId', as: 'template' });
  Source.hasMany(CrawlRun, { foreignKey: 'sourceId', as: 'crawlRuns' });
  CrawlRun.belongsTo(Source, { foreignKey: 'sourceId', as: 'source' });
  CrawlRun.hasMany(CrawlError, { foreignKey: 'crawlRunId', as: 'errors' });
  CrawlError.belongsTo(CrawlRun, { foreignKey: 'crawlRunId', as: 'crawlRun' });
  User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
  RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  return {
    User,
    Role,
    Permission,
    UserRole,
    RolePermission,
    Source,
    SourceFeed,
    SourceHealth,
    RawArticle,
    ArticleContent,
    CrawlRun,
    CrawlError,
    PromptTemplate,
    PromptVersion,
    AiRequest,
    ArticleExtraction,
    NewsEvent,
    NewsEventArticle,
    NewsEventConflict,
    EventTimelineItem,
    ClusterDecisionLog,
    ClusteringEvaluation,
    Entity,
    EntityAlias,
    ArticleEmbedding,
    EditorialRule,
    EditorialScore,
    EditorialScoreOverride,
    EditorialDecision,
    EditorialNote,
    PodcastEpisode,
    PodcastEpisodeItem,
    PodcastScriptVersion,
    PodcastAudio,
    PodcastPublication,
    IntakeWave,
    WaveEventObservation,
    DailyRundown,
    DailyRundownItem,
    EditorialTeam,
    Competition,
    TrackedEvent,
    NewsEventTeam,
    NewsEventCompetition,
    NewsEventTrackedEvent,
    CoverageTarget,
    EditorialEntityWeight,
    Notification,
    AppSetting,
    AuditLog,
    RefreshToken,
  };
}
