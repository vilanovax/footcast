import { randomUUID } from 'node:crypto';
import {
  createAiProviderFromEnv,
  estimateCostUsd,
  renderPromptTemplate,
  validateArticleCard,
} from '@footcast/ai';
import { assertTransition } from '@footcast/article-pipeline';
import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import type { ClusterEventJobData, ExtractArticleJobData, Queue } from '@footcast/queue';
import { ArticleStatus } from '@footcast/shared';

export async function processExtractArticleJob(
  db: Database,
  logger: Logger,
  clusterQueue: Queue<ClusterEventJobData> | null,
  data: ExtractArticleJobData,
): Promise<void> {
  const article = await db.models.RawArticle.findByPk(data.articleId, {
    include: [{ association: 'content' }, { association: 'source' }],
  });
  if (!article) {
    logger.warn('Article missing for extract', { articleId: data.articleId });
    return;
  }

  const content = (
    article as unknown as {
      content?: { getDataValue: (k: string) => unknown };
    }
  ).content;
  if (!content) {
    throw new Error('Parsed content missing; run parse first');
  }

  const promptVersion = await db.models.PromptVersion.findOne({
    where: { isActive: true },
    include: [
      {
        association: 'template',
        where: { pipelineStage: 'article_extraction' },
        required: true,
      },
    ],
    order: [['version', 'DESC']],
  });
  if (!promptVersion) {
    throw new Error('No active prompt version for article_extraction');
  }

  const from = article.getDataValue('status');
  if (from !== ArticleStatus.EXTRACTING) {
    assertTransition(from, ArticleStatus.EXTRACTING);
    await article.update({ status: ArticleStatus.EXTRACTING, errorMessage: null });
  }

  const source = (
    article as unknown as { source?: { getDataValue: (k: string) => unknown } }
  ).source;
  const textContent = String(content.getDataValue('textContent') ?? '');
  const truncated = textContent.slice(0, 12_000);
  const userPrompt = renderPromptTemplate(promptVersion.getDataValue('userPromptTemplate'), {
    articleId: data.articleId,
    sourceName: String(source?.getDataValue('name') ?? ''),
    sourceUrl: article.getDataValue('canonicalUrl'),
    title: String(article.getDataValue('title') ?? content.getDataValue('extractedTitle') ?? ''),
    textContent: truncated,
  });

  const provider = createAiProviderFromEnv();
  const requestId = randomUUID();
  let aiStatus = 'success';
  let aiError: string | null = null;

  try {
    const result = await provider.complete({
      pipelineStage: 'article_extraction',
      promptVersionId: promptVersion.getDataValue('id'),
      systemPrompt: promptVersion.getDataValue('systemPrompt'),
      userPrompt,
      temperature: promptVersion.getDataValue('temperature'),
      maxTokens: promptVersion.getDataValue('maxTokens'),
      metadata: {
        articleId: data.articleId,
        sourceName: String(source?.getDataValue('name') ?? ''),
        sourceUrl: article.getDataValue('canonicalUrl'),
        model: promptVersion.getDataValue('model'),
      },
    });

    const estimatedCost = estimateCostUsd(result.provider, result.model, result.usage);
    await db.models.AiRequest.create({
      id: requestId,
      provider: result.provider,
      model: result.model,
      pipelineStage: 'article_extraction',
      promptVersionId: promptVersion.getDataValue('id'),
      relatedArticleId: data.articleId,
      relatedEpisodeId: null,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedInputTokens: result.usage.cachedInputTokens ?? 0,
      reasoningTokens: result.usage.reasoningTokens ?? 0,
      estimatedCost,
      actualCost: estimatedCost,
      latencyMs: result.latencyMs,
      status: 'success',
      error: null,
      metadata: { reason: data.reason ?? 'manual' },
    });

    const cardInput = {
      ...(typeof result.parsed === 'object' && result.parsed ? result.parsed : {}),
      articleId: data.articleId,
    };
    const validation = validateArticleCard(cardInput);
    if (!validation.success || !validation.data) {
      await article.update({
        status: ArticleStatus.FAILED,
        errorMessage: `AI card validation failed: ${(validation.errors ?? []).join('; ')}`,
      });
      await db.models.ArticleExtraction.create({
        id: randomUUID(),
        articleId: data.articleId,
        promptVersionId: promptVersion.getDataValue('id'),
        aiRequestId: requestId,
        cardJson: cardInput as Record<string, unknown>,
        isRelevant: false,
        scope: null,
        category: null,
        headlineFa: null,
        summaryFa: null,
        officialStatus: null,
        importanceScore: null,
        credibilityScore: null,
        freshnessScore: null,
        validationErrors: validation.errors ?? [],
      });
      throw new Error(`Card validation failed: ${(validation.errors ?? []).join('; ')}`);
    }

    const card = validation.data;
    const nextStatus = card.isRelevant ? ArticleStatus.EXTRACTED : ArticleStatus.IRRELEVANT;
    assertTransition(ArticleStatus.EXTRACTING, nextStatus);

    await db.models.ArticleExtraction.create({
      id: randomUUID(),
      articleId: data.articleId,
      promptVersionId: promptVersion.getDataValue('id'),
      aiRequestId: requestId,
      cardJson: card as unknown as Record<string, unknown>,
      isRelevant: card.isRelevant,
      scope: card.scope,
      category: card.category,
      headlineFa: card.headlineFa,
      summaryFa: card.summaryFa,
      officialStatus: card.officialStatus,
      importanceScore: card.importanceScore,
      credibilityScore: card.credibilityScore,
      freshnessScore: card.freshnessScore,
      validationErrors: null,
    });

    await article.update({
      status: nextStatus,
      errorMessage: null,
      title: card.headlineFa || article.getDataValue('title'),
    });

    if (nextStatus === ArticleStatus.EXTRACTED && clusterQueue) {
      await clusterQueue.add(
        'cluster',
        { articleId: data.articleId, reason: 'extract_complete' },
        { jobId: `cluster-${data.articleId}-${Date.now()}` },
      );
    }

    logger.info('Article extracted', {
      articleId: data.articleId,
      isRelevant: card.isRelevant,
      category: card.category,
      importanceScore: card.importanceScore,
      provider: result.provider,
      estimatedCost,
      enqueuedCluster: nextStatus === ArticleStatus.EXTRACTED && Boolean(clusterQueue),
    });
  } catch (error: unknown) {
    aiStatus = 'failed';
    aiError = error instanceof Error ? error.message : String(error);
    const existing = await db.models.AiRequest.findByPk(requestId);
    if (!existing) {
      await db.models.AiRequest.create({
        id: requestId,
        provider: provider.name,
        model: 'unknown',
        pipelineStage: 'article_extraction',
        promptVersionId: promptVersion.getDataValue('id'),
        relatedArticleId: data.articleId,
        relatedEpisodeId: null,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        estimatedCost: 0,
        actualCost: null,
        latencyMs: 0,
        status: aiStatus,
        error: aiError,
        metadata: { reason: data.reason ?? 'manual' },
      });
    }
    if (article.getDataValue('status') === ArticleStatus.EXTRACTING) {
      await article.update({
        status: ArticleStatus.FAILED,
        errorMessage: aiError,
      });
    }
    logger.warn('Article extract failed', {
      articleId: data.articleId,
      message: aiError,
    });
    throw error;
  }
}
