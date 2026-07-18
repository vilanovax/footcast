import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { assertTransition } from '@footcast/article-pipeline';
import { getConfig } from '@footcast/config';
import { tagNewsEventTaxonomy, type Database } from '@footcast/database';
import {
  buildAliasMap,
  buildEventSignatureFromCard,
  claimsFromCard,
  computeEventSimilarity,
  contentFingerprint,
  createClusterAiJudge,
  decideFromSimilarity,
  embeddingTextFromCard,
  getEmbeddingProvider,
  isExactDuplicate,
  isNearDuplicate,
  resolveEntityNames,
  sharesPrimaryEntity,
} from '@footcast/event-clustering';
import type { Logger } from '@footcast/logger';
import type { ClusterEventJobData, Queue, ScoreEventJobData } from '@footcast/queue';
import {
  ArticleStatus,
  CLUSTERING_POLICY,
  CLUSTER_THRESHOLDS,
  EventStatus,
  OfficialStatus,
  WaveObservationType,
  categoryTimeWindowHours,
  countsAsIndependentSource,
  normalizeScope,
  type EventSignature,
} from '@footcast/shared';
import {
  observationTypeFromCluster,
  recordWaveObservation,
} from './intake-wave.js';

async function loadAliasMap(db: Database) {
  const aliases = await db.models.EntityAlias.findAll({
    include: [{ association: 'entity', where: { isActive: true }, required: true }],
  });
  return buildAliasMap(
    aliases.map((row) => {
      const entity = (row as unknown as { entity?: { getDataValue: (k: string) => unknown } }).entity;
      return {
        normalizedAlias: String(row.getDataValue('normalizedAlias')),
        canonicalNormalized: String(entity?.getDataValue('normalizedName') ?? row.getDataValue('normalizedAlias')),
      };
    }),
  );
}

async function writeDecisionLog(
  db: Database,
  args: {
    articleId: string;
    selectedEventId: string | null;
    decision: string;
    relationship: string | null;
    score: number | null;
    breakdown?: Record<string, unknown> | null;
    candidates?: unknown;
    aiUsed: boolean;
    aiProvider?: string | null;
    aiModel?: string | null;
    aiConfidence?: number;
    reason: string;
    startedAt: number;
  },
): Promise<void> {
  await db.models.ClusterDecisionLog.create({
    id: randomUUID(),
    rawArticleId: args.articleId,
    selectedEventId: args.selectedEventId,
    decision: args.decision,
    relationship: args.relationship,
    finalSimilarity: args.score,
    similarityBreakdown: args.breakdown ?? null,
    candidateSnapshot: args.candidates ?? null,
    thresholdPolicyVersion: CLUSTERING_POLICY.version,
    aiUsed: args.aiUsed,
    aiProvider: args.aiUsed ? (args.aiProvider ?? 'mock') : null,
    aiModel: args.aiUsed ? (args.aiModel ?? 'MockClusterAiJudge') : null,
    aiConfidence: args.aiConfidence ?? null,
    reason: args.reason,
    processingDurationMs: Date.now() - args.startedAt,
  });
}



async function enqueueScore(
  scoreQueue: Queue<ScoreEventJobData> | null,
  eventId: string,
): Promise<void> {
  if (!scoreQueue) return;
  await scoreQueue.add(
    'score',
    { eventId, reason: 'cluster_complete' },
    { jobId: `score-${eventId}-${Date.now()}` },
  );
}

function namesFromCard(card: Record<string, unknown>, key: 'clubs' | 'people'): string[] {
  const raw = card[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name: unknown }).name);
      }
      return '';
    })
    .filter(Boolean);
}

const OFFICIAL_RANK: Record<string, number> = {
  [OfficialStatus.FALSE]: 0,
  [OfficialStatus.DISPUTED]: 1,
  [OfficialStatus.RUMOR]: 2,
  [OfficialStatus.UNVERIFIED]: 3,
  [OfficialStatus.RELIABLE_REPORT]: 4,
  [OfficialStatus.MULTI_SOURCE_REPORT]: 5,
  [OfficialStatus.CONFIRMED]: 6,
  [OfficialStatus.OFFICIAL]: 7,
};

function strongerOfficial(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return (OFFICIAL_RANK[b] ?? 0) > (OFFICIAL_RANK[a] ?? 0) ? b : a;
}

async function recountIndependentSources(
  db: Database,
  eventId: string,
): Promise<number> {
  const links = await db.models.NewsEventArticle.findAll({
    where: { eventId },
    include: [{ association: 'article', attributes: ['sourceId'] }],
  });
  const sourceIds = new Set<string>();
  for (const link of links) {
    if (!countsAsIndependentSource(link.getDataValue('role'))) continue;
    const article = (link as unknown as { article?: { getDataValue: (k: string) => unknown } })
      .article;
    const sid = article?.getDataValue('sourceId');
    if (sid) sourceIds.add(String(sid));
  }
  return Math.max(1, sourceIds.size);
}

async function addTimelineItem(
  db: Database,
  args: {
    eventId: string;
    articleId: string;
    sourceId: string | null;
    developmentType: string;
    action: string | null;
    summary: string;
    occurredAt: Date | null;
    publishedAt: Date | null;
    isMajor: boolean;
  },
): Promise<void> {
  await db.models.EventTimelineItem.create({
    id: randomUUID(),
    newsEventId: args.eventId,
    rawArticleId: args.articleId,
    sourceId: args.sourceId,
    developmentType: args.developmentType,
    action: args.action,
    summary: args.summary.slice(0, 2000),
    occurredAt: args.occurredAt,
    publishedAt: args.publishedAt,
    isMajorDevelopment: args.isMajor,
  });
}

export async function processClusterEventJob(
  db: Database,
  logger: Logger,
  scoreQueue: Queue<ScoreEventJobData> | null,
  data: ClusterEventJobData,
): Promise<void> {
  const article = await db.models.RawArticle.findByPk(data.articleId, {
    include: [{ association: 'source' }],
  });
  if (!article) {
    logger.warn('Article missing for cluster', { articleId: data.articleId });
    return;
  }

  const status = article.getDataValue('status');
  if (status === ArticleStatus.IRRELEVANT) {
    logger.info('Skip cluster for irrelevant article', { articleId: data.articleId });
    return;
  }
  if (status !== ArticleStatus.EXTRACTED && status !== ArticleStatus.DUPLICATE) {
    throw new Error(`Cannot cluster from status ${status}`);
  }

  const existingLink = await db.models.NewsEventArticle.findOne({
    where: { articleId: data.articleId },
  });
  if (existingLink && data.reason !== 'manual') {
    logger.info('Article already linked to event', {
      articleId: data.articleId,
      eventId: existingLink.getDataValue('eventId'),
    });
    return;
  }

  const extraction = await db.models.ArticleExtraction.findOne({
    where: { articleId: data.articleId },
    order: [['createdAt', 'DESC']],
  });
  if (!extraction) {
    throw new Error('Extraction missing; run extract first');
  }

  const startedAt = Date.now();
  let aiUsed = false;
  let aiConfidence: number | undefined;

  const card = (extraction.getDataValue('cardJson') ?? {}) as Record<string, unknown>;
  const headline =
    extraction.getDataValue('headlineFa') ?? article.getDataValue('title') ?? 'Untitled';
  const summary = extraction.getDataValue('summaryFa') ?? '';
  const category = extraction.getDataValue('category');
  const scope = normalizeScope(extraction.getDataValue('scope'));
  const aliasMap = await loadAliasMap(db);
  const clubs = resolveEntityNames(namesFromCard(card, 'clubs'), aliasMap);
  const people = resolveEntityNames(namesFromCard(card, 'people'), aliasMap);
  const signature = buildEventSignatureFromCard({
    ...card,
    category: category ?? card.category,
    headlineFa: headline,
    summaryFa: summary,
    clubs: clubs.map((name) => ({ name })),
    people: people.map((name) => ({ name })),
  });
  signature.primaryEntities = resolveEntityNames(signature.primaryEntities, aliasMap);
  signature.secondaryEntities = resolveEntityNames(signature.secondaryEntities, aliasMap);
  const claims = claimsFromCard(card);
  const fingerprint = contentFingerprint([headline, summary, category ?? '', signature.action ?? '']);
  const embedText = embeddingTextFromCard({
    headlineFa: headline,
    summaryFa: summary,
    category,
    clubs,
    people,
  });
  const provider = getEmbeddingProvider();
  const embedding = await provider.embed(
    [signature.eventType, signature.action ?? '', embedText, ...signature.primaryEntities].join(
      ' ',
    ),
  );

  await db.models.ArticleEmbedding.upsert({
    articleId: data.articleId,
    extractionId: extraction.getDataValue('id'),
    provider: provider.name,
    model: provider.model,
    dimensions: provider.dimensions,
    embedding,
    contentHash: fingerprint,
  });

  const articleTime =
    article.getDataValue('publishedAt') ?? article.getDataValue('discoveredAt');
  const windowHours = categoryTimeWindowHours(category);
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const sourceId = article.getDataValue('sourceId');

  // --- Exact duplicate via fingerprint / content hash ---
  const hashHit = await db.models.ArticleEmbedding.findOne({
    where: {
      contentHash: fingerprint,
      articleId: { [Op.ne]: data.articleId },
    },
  });

  type Ranked = {
    eventId: string;
    articleId: string;
    signature: EventSignature;
    headline: string;
    summary: string;
    claims: string[];
    embedding: number[];
    exact: boolean;
    near: boolean;
    nearScore: number;
    breakdown: ReturnType<typeof computeEventSimilarity>;
  };

  const ranked: Ranked[] = [];

  if (hashHit) {
    const linked = await db.models.NewsEventArticle.findOne({
      where: { articleId: hashHit.getDataValue('articleId') },
    });
    if (linked) {
      const event = await db.models.NewsEvent.findByPk(linked.getDataValue('eventId'));
      if (event) {
        const candSig =
          (event.getDataValue('eventSignature') as EventSignature | null) ??
          ({
            eventType: event.getDataValue('category') ?? 'OTHER',
            action: event.getDataValue('eventAction'),
            primaryEntities: [],
            secondaryEntities: [],
          } satisfies EventSignature);
        const breakdown = computeEventSimilarity({
          incoming: signature,
          candidate: candSig,
          titleA: headline,
          titleB: event.getDataValue('title'),
          embeddingA: embedding,
          embeddingB: hashHit.getDataValue('embedding') ?? embedding,
          claimsA: claims,
          claimsB: [],
        });
        ranked.push({
          eventId: event.getDataValue('id'),
          articleId: hashHit.getDataValue('articleId'),
          signature: candSig,
          headline: event.getDataValue('title'),
          summary: event.getDataValue('summary') ?? '',
          claims: [],
          embedding: hashHit.getDataValue('embedding') ?? [],
          exact: true,
          near: true,
          nearScore: 1,
          breakdown: { ...breakdown, eventSimilarity: 1 },
        });
      }
    }
  }

  if (ranked.length === 0) {
    const recentEvents = await db.models.NewsEvent.findAll({
      where: {
        lastSeenAt: { [Op.gte]: since },
        ...(category
          ? {
              [Op.or]: [
                { category },
                {
                  category: {
                    [Op.in]:
                      category === 'TRANSFER'
                        ? ['TRANSFER', 'CONTRACT']
                        : category === 'CONTRACT'
                          ? ['TRANSFER', 'CONTRACT']
                          : category === 'MATCH_RESULT'
                            ? ['MATCH_RESULT', 'MATCH_PREVIEW']
                            : category === 'MATCH_PREVIEW'
                              ? ['MATCH_RESULT', 'MATCH_PREVIEW']
                              : [category],
                  },
                },
              ],
            }
          : {}),
      },
      limit: CLUSTER_THRESHOLDS.maxCandidates,
      order: [['lastSeenAt', 'DESC']],
    });

    for (const event of recentEvents) {
      const eventId = event.getDataValue('id');
      const primaryArticleId = event.getDataValue('primaryArticleId');
      let candHeadline = event.getDataValue('title');
      let candSummary = event.getDataValue('summary') ?? '';
      let candClaims: string[] = [];
      let candEmbed: number[] = [];
      let candSig =
        (event.getDataValue('eventSignature') as EventSignature | null) ?? null;

      if (primaryArticleId) {
        const otherExtraction = await db.models.ArticleExtraction.findOne({
          where: { articleId: primaryArticleId },
          order: [['createdAt', 'DESC']],
        });
        const otherCard = (otherExtraction?.getDataValue('cardJson') ?? {}) as Record<
          string,
          unknown
        >;
        if (!candSig) {
          candSig = buildEventSignatureFromCard({
            ...otherCard,
            category: event.getDataValue('category') ?? otherCard.category,
            headlineFa: candHeadline,
            summaryFa: candSummary,
          });
        }
        candClaims = claimsFromCard(otherCard);
        candHeadline =
          otherExtraction?.getDataValue('headlineFa') ?? candHeadline;
        candSummary = otherExtraction?.getDataValue('summaryFa') ?? candSummary;
        const otherEmbed = await db.models.ArticleEmbedding.findByPk(primaryArticleId);
        candEmbed = otherEmbed?.getDataValue('embedding') ?? [];
      }

      if (!candSig) {
        candSig = {
          eventType: event.getDataValue('category') ?? 'OTHER',
          action: event.getDataValue('eventAction'),
          primaryEntities: [],
          secondaryEntities: [],
          occurredAt: event.getDataValue('lastSeenAt')?.toISOString?.() ?? null,
        };
      }

      // Candidate filter: shared primary entity OR same matchId
      if (
        !sharesPrimaryEntity(signature, candSig) &&
        !(signature.matchId && candSig.matchId && signature.matchId === candSig.matchId)
      ) {
        // Allow if both have empty entities (cold start) — still score but won't auto-merge easily
        if (signature.primaryEntities.length > 0 && candSig.primaryEntities.length > 0) {
          continue;
        }
      }

      if (candEmbed.length === 0) {
        candEmbed = await provider.embed(
          embeddingTextFromCard({
            headlineFa: candHeadline,
            summaryFa: candSummary,
            category: event.getDataValue('category'),
          }),
        );
      }

      const breakdown = computeEventSimilarity({
        incoming: signature,
        candidate: candSig,
        titleA: headline,
        titleB: candHeadline,
        embeddingA: embedding,
        embeddingB: candEmbed,
        claimsA: claims,
        claimsB: candClaims,
      });

      const near = isNearDuplicate({
        titleA: headline,
        titleB: candHeadline,
        contentPartsA: [headline, summary],
        contentPartsB: [candHeadline, candSummary],
        claimsA: claims,
        claimsB: candClaims,
        entityOverlap: breakdown.entitySimilarity,
      });

      ranked.push({
        eventId,
        articleId: primaryArticleId ?? eventId,
        signature: candSig,
        headline: candHeadline,
        summary: candSummary,
        claims: candClaims,
        embedding: candEmbed,
        exact: false,
        near: near.isNear,
        nearScore: near.score,
        breakdown,
      });
    }

    ranked.sort((a, b) => b.breakdown.eventSimilarity - a.breakdown.eventSimilarity);
  }

  const best = ranked[0];
  let decision = best
    ? decideFromSimilarity({
        eventId: best.eventId,
        exactDuplicate: isExactDuplicate({ contentHashMatch: best.exact }),
        nearDuplicate: best.near,
        nearScore: best.nearScore,
        breakdown: best.breakdown,
        incoming: signature,
        candidate: best.signature,
      })
    : {
        kind: 'create' as const,
        method: null,
        score: 0,
        reason: 'no_candidates',
        relationshipDecision: 'UNRELATED' as const,
        storedRole: 'BACKGROUND' as const,
        recommendedAction: 'CREATE_NEW_EVENT' as const,
      };

  let aiProviderName: string | null = null;
  let aiModelName: string | null = null;

  if (decision.needsAiBoundary && best) {
    const config = getConfig();
    const sharedPrimary =
      best.breakdown.sharedPrimaryEntities.length > 0 || best.breakdown.sameMatchId;
    const categoryOk = best.breakdown.eventTypeSimilarity >= 0.4;

    if (!config.CLUSTER_AI_JUDGE_ENABLED || !sharedPrimary || !categoryOk) {
      decision = {
        kind: 'create',
        method: null,
        score: best.breakdown.eventSimilarity,
        reason: config.CLUSTER_AI_JUDGE_ENABLED
          ? 'ai_boundary_gates_failed_prefer_create'
          : 'ai_boundary_disabled_prefer_create',
        relationshipDecision: 'UNRELATED',
        storedRole: 'BACKGROUND',
        recommendedAction: 'CREATE_NEW_EVENT',
        breakdown: best.breakdown,
      };
    } else {
      const timeline = await db.models.EventTimelineItem.findAll({
        where: { newsEventId: best.eventId },
        order: [['occurredAt', 'DESC']],
        limit: 5,
      });
      const aiJudge = createClusterAiJudge({
        enabled: true,
        apiKey: process.env.OPENAI_API_KEY ?? null,
        model: process.env.CLUSTER_AI_MODEL,
      });
      aiProviderName = aiJudge.name;
      aiModelName = aiJudge.model;
      try {
        const ai = await aiJudge.judge({
          incoming: signature,
          candidate: best.signature,
          incomingHeadline: headline,
          incomingSummary: summary,
          candidateHeadline: best.headline,
          candidateSummary: best.summary,
          incomingClaims: claims,
          candidateClaims: best.claims,
          latestTimelineSummaries: timeline.map((t) => t.getDataValue('summary')),
          breakdown: best.breakdown,
        });
        decision = decideFromSimilarity({
          eventId: best.eventId,
          exactDuplicate: false,
          nearDuplicate: best.near,
          nearScore: best.nearScore,
          breakdown: best.breakdown,
          incoming: signature,
          candidate: best.signature,
          aiDecision: {
            relationship: ai.relationship,
            confidence: ai.confidence,
            recommendedAction: ai.recommendedAction,
          },
        });
        decision.aiConfidence = ai.confidence;
        decision.reason = `${decision.reason}:${ai.reason}`;
        aiUsed = true;
        aiConfidence = ai.confidence;
      } catch (err) {
        logger.warn('AI boundary judge failed — prefer create', {
          err: err instanceof Error ? err.message : String(err),
        });
        decision = {
          kind: 'create',
          method: 'ai_boundary',
          score: best.breakdown.eventSimilarity,
          reason: 'ai_failure_prefer_create',
          relationshipDecision: 'UNRELATED',
          storedRole: 'BACKGROUND',
          recommendedAction: 'CREATE_NEW_EVENT',
          breakdown: best.breakdown,
        };
        aiUsed = true;
      }
    }
  }

  if (existingLink && data.reason === 'manual') {
    await existingLink.destroy();
  }

  const now = new Date();
  const occurredAt = signature.occurredAt ? new Date(signature.occurredAt) : articleTime;
  const publishedAt = article.getDataValue('publishedAt');

  if (decision.kind === 'create' || !decision.eventId) {
    const eventId = randomUUID();
    await db.models.NewsEvent.create({
      id: eventId,
      title: headline.slice(0, 500),
      summary: summary || null,
      status: EventStatus.NEW,
      scope,
      category,
      officialStatus: extraction.getDataValue('officialStatus'),
      importanceScore: extraction.getDataValue('importanceScore'),
      credibilityScore: extraction.getDataValue('credibilityScore'),
      freshnessScore: extraction.getDataValue('freshnessScore'),
      primaryArticleId: data.articleId,
      articleCount: 1,
      independentSourceCount: 1,
      eventAction: signature.action,
      eventSignature: signature as unknown as Record<string, unknown>,
      latestDevelopmentSummary: headline.slice(0, 500),
      fingerprint,
      metadata: {
        createdBy: 'cluster-event',
        reason: data.reason ?? 'extract_complete',
        decision,
      },
      firstSeenAt: now,
      lastSeenAt: now,
    });
    await db.models.NewsEventArticle.create({
      id: randomUUID(),
      eventId,
      articleId: data.articleId,
      extractionId: extraction.getDataValue('id'),
      role: 'PRIMARY',
      matchMethod: null,
      similarityScore: null,
      relationshipDecision: 'SAME_EVENT',
      similarityBreakdown: null,
    });
    await addTimelineItem(db, {
      eventId,
      articleId: data.articleId,
      sourceId,
      developmentType: 'PRIMARY',
      action: signature.action,
      summary: headline,
      occurredAt,
      publishedAt,
      isMajor: true,
    });
    if (status !== ArticleStatus.EXTRACTED) {
      assertTransition(status, ArticleStatus.EXTRACTED);
      await article.update({ status: ArticleStatus.EXTRACTED, errorMessage: null });
    }
    await enqueueScore(scoreQueue, eventId);
    await writeDecisionLog(db, {
      articleId: data.articleId,
      selectedEventId: eventId,
      decision: 'create',
      relationship: 'SAME_EVENT',
      score: decision.score,
      breakdown: decision.breakdown as unknown as Record<string, unknown> | null,
      candidates: ranked.slice(0, 5).map((c) => ({
        eventId: c.eventId,
        score: c.breakdown.eventSimilarity,
        near: c.near,
        exact: c.exact,
      })),
      aiUsed,
      aiProvider: aiProviderName,
      aiModel: aiModelName,
      aiConfidence,
      reason: decision.reason,
      startedAt,
    });
    await recordWaveObservation(db, {
      newsEventId: eventId,
      observationType: WaveObservationType.NEW_EVENT,
      rawArticleId: data.articleId,
      summary: headline.slice(0, 500),
    });
    try {
      await tagNewsEventTaxonomy(db, eventId);
    } catch (err) {
      logger.warn('Taxonomy tag failed on create', {
        eventId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    logger.info('Created news event', {
      articleId: data.articleId,
      eventId,
      decision: decision.reason,
      action: signature.action,
    });
    return;
  }

  const event = await db.models.NewsEvent.findByPk(decision.eventId);
  if (!event) {
    throw new Error(`Target event missing: ${decision.eventId}`);
  }

  const role = decision.storedRole;
  const isDup = role === 'EXACT_DUPLICATE' || role === 'NEAR_DUPLICATE';
  const isDevelopment = role === 'NEW_DEVELOPMENT';
  const isConflict = decision.kind === 'conflict' || role === 'CONFLICTING';

  await db.models.NewsEventArticle.create({
    id: randomUUID(),
    eventId: decision.eventId,
    articleId: data.articleId,
    extractionId: extraction.getDataValue('id'),
    role,
    matchMethod: decision.method,
    similarityScore: decision.score,
    relationshipDecision: decision.relationshipDecision,
    similarityBreakdown: decision.breakdown
      ? (decision.breakdown as unknown as Record<string, unknown>)
      : null,
  });

  const articleCount = event.getDataValue('articleCount') + 1;
  const independentSourceCount = await recountIndependentSources(db, decision.eventId);

  const patch: Record<string, unknown> = {
    articleCount,
    independentSourceCount,
    lastSeenAt: now,
    metadata: {
      ...(event.getDataValue('metadata') ?? {}),
      lastCluster: { articleId: data.articleId, decision },
    },
  };

  if (isDevelopment || role === 'SUPPORTING' || role === 'PRIMARY') {
    patch.officialStatus = strongerOfficial(
      event.getDataValue('officialStatus'),
      extraction.getDataValue('officialStatus'),
    );
  }

  if (isDevelopment) {
    patch.eventAction = signature.action ?? event.getDataValue('eventAction');
    patch.eventSignature = {
      ...((event.getDataValue('eventSignature') as Record<string, unknown>) ?? {}),
      ...(signature as unknown as Record<string, unknown>),
      action: signature.action,
    };
    patch.latestDevelopmentSummary = headline.slice(0, 500);
    if (summary && summary.length > (event.getDataValue('summary')?.length ?? 0)) {
      patch.summary = summary;
    }
    patch.freshnessScore = Math.max(event.getDataValue('freshnessScore') ?? 0, 85);
    await addTimelineItem(db, {
      eventId: decision.eventId,
      articleId: data.articleId,
      sourceId,
      developmentType: 'NEW_DEVELOPMENT',
      action: signature.action,
      summary: headline,
      occurredAt,
      publishedAt,
      isMajor: true,
    });
  }

  if (isConflict) {
    patch.status = EventStatus.CONFLICTED;
    await db.models.NewsEventConflict.create({
      id: randomUUID(),
      eventId: decision.eventId,
      articleId: data.articleId,
      otherEventId: null,
      conflictType: 'ambiguous_match',
      status: 'open',
      details: { decision, signature },
      resolvedAt: null,
    });
  }

  await event.update(patch);

  if (isDup) {
    if (status !== ArticleStatus.DUPLICATE) {
      assertTransition(status, ArticleStatus.DUPLICATE);
      await article.update({ status: ArticleStatus.DUPLICATE, errorMessage: null });
    }
  } else if (status !== ArticleStatus.EXTRACTED) {
    assertTransition(status, ArticleStatus.EXTRACTED);
    await article.update({ status: ArticleStatus.EXTRACTED, errorMessage: null });
  }

  await enqueueScore(scoreQueue, decision.eventId);
  await writeDecisionLog(db, {
    articleId: data.articleId,
    selectedEventId: decision.eventId,
    decision: decision.kind,
    relationship: decision.relationshipDecision,
    score: decision.score,
    breakdown: decision.breakdown as unknown as Record<string, unknown> | null,
    candidates: ranked.slice(0, 5).map((c) => ({
      eventId: c.eventId,
      score: c.breakdown.eventSimilarity,
      near: c.near,
      exact: c.exact,
    })),
    aiUsed,
    aiProvider: aiProviderName,
    aiModel: aiModelName,
    aiConfidence,
    reason: decision.reason,
    startedAt,
  });

  if (!isDup) {
    let obsType = observationTypeFromCluster(role);
    const newOfficial = extraction.getDataValue('officialStatus');
    if (
      (newOfficial === OfficialStatus.OFFICIAL ||
        newOfficial === OfficialStatus.CONFIRMED) &&
      !isDevelopment &&
      !isConflict
    ) {
      obsType = WaveObservationType.OFFICIAL_CONFIRMATION;
    }
    await recordWaveObservation(db, {
      newsEventId: decision.eventId,
      observationType: obsType,
      rawArticleId: data.articleId,
      summary: headline.slice(0, 500),
    });
    try {
      await tagNewsEventTaxonomy(db, decision.eventId);
    } catch (err) {
      logger.warn('Taxonomy tag failed on attach', {
        eventId: decision.eventId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Clustered article into event', {
    articleId: data.articleId,
    eventId: decision.eventId,
    role,
    relationship: decision.relationshipDecision,
    score: decision.score,
    method: decision.method,
    reason: decision.reason,
  });
}
