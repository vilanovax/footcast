import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NewsCategory, OfficialStatus } from '@footcast/shared';
import { validateArticleCard } from './article-card.js';
import { MockAiProvider } from './mock-provider.js';
import { estimateCostUsd } from './cost.js';

describe('articleCardSchema', () => {
  it('accepts a valid football card', () => {
    const result = validateArticleCard({
      articleId: '11111111-1111-4111-8111-111111111111',
      isRelevant: true,
      scope: 'europe',
      category: NewsCategory.TRANSFER,
      headlineFa: 'انتقال بازیکن به باشگاه جدید',
      summaryFa: 'گزارش منابع نزدیک به باشگاه از مذاکره برای انتقال خبر می‌دهد.',
      clubs: [{ name: 'Arsenal' }],
      people: [{ name: 'Player X', role: 'forward' }],
      facts: [
        {
          claim: 'مذاکره در جریان است',
          status: 'unverified',
          confidence: 0.5,
        },
      ],
      numbers: [],
      quotes: [],
      officialStatus: OfficialStatus.UNVERIFIED,
      sourceType: 'trusted_media',
      importanceScore: 70,
      credibilityScore: 60,
      freshnessScore: 80,
      nationalRelevanceScore: 10,
      duplicateProbability: 0.1,
      uncertainties: [],
      rejectionReasons: [],
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.category, NewsCategory.TRANSFER);
  });

  it('rejects incomplete cards', () => {
    const result = validateArticleCard({ articleId: 'not-a-uuid', isRelevant: true });
    assert.equal(result.success, false);
    assert.ok((result.errors?.length ?? 0) > 0);
  });
});

describe('MockAiProvider', () => {
  it('returns a schema-valid card for football text', async () => {
    const provider = new MockAiProvider();
    const articleId = '22222222-2222-4222-8222-222222222222';
    const completion = await provider.complete({
      pipelineStage: 'article_extraction',
      promptVersionId: '33333333-3333-4333-8333-333333333333',
      systemPrompt: 'extract',
      userPrompt:
        'Title: Liverpool sign midfielder\n\nArticle text:\nFootball transfer news about Liverpool and Premier League.',
      temperature: 0.2,
      maxTokens: 1000,
      metadata: {
        articleId,
        sourceName: 'Guardian',
        sourceUrl: 'https://example.com/a',
      },
    });
    const card = {
      ...(completion.parsed as Record<string, unknown>),
      articleId,
    };
    const validation = validateArticleCard(card);
    assert.equal(validation.success, true);
    assert.equal(validation.data?.isRelevant, true);
    assert.equal(completion.provider, 'mock');
    assert.ok(estimateCostUsd('mock', 'mock-v1', completion.usage) === 0);
  });
});
