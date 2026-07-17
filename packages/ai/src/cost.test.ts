import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateCostUsd } from './cost.js';
import { validateArticleCard } from './article-card.js';
import { OfficialStatus, NewsCategory } from '@footcast/shared';
import { MockAiProvider } from './mock-provider.js';
import { renderPromptTemplate } from './prompt.js';

describe('estimateCostUsd', () => {
  it('returns zero for mock', () => {
    assert.equal(
      estimateCostUsd('mock', 'mock-v1', { inputTokens: 1000, outputTokens: 500 }),
      0,
    );
  });

  it('estimates positive cost for openai mini', () => {
    const cost = estimateCostUsd('openai', 'gpt-4o-mini', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    assert.ok(cost > 0);
  });
});

describe('validateArticleCard', () => {
  it('accepts valid card', () => {
    const result = validateArticleCard({
      articleId: '11111111-1111-1111-1111-111111111111',
      isRelevant: true,
      scope: 'iran',
      category: NewsCategory.TRANSFER,
      headlineFa: 'انتقال بازیکن',
      summaryFa: 'باشگاه استقلال برای جذب بازیکن مذاکره کرده است.',
      clubs: [],
      people: [],
      facts: [],
      numbers: [],
      quotes: [],
      officialStatus: OfficialStatus.UNVERIFIED,
      sourceType: 'trusted_media',
      importanceScore: 70,
      credibilityScore: 60,
      freshnessScore: 80,
      nationalRelevanceScore: 50,
      duplicateProbability: 0.1,
      uncertainties: [],
      rejectionReasons: [],
    });
    assert.equal(result.success, true);
  });
});

describe('MockAiProvider', () => {
  it('returns parseable football card', async () => {
    const provider = new MockAiProvider();
    const result = await provider.complete({
      pipelineStage: 'article_extraction',
      promptVersionId: '11111111-1111-1111-1111-111111111111',
      systemPrompt: 'extract',
      userPrompt: 'Title: خرید بازیکن استقلال\nArticle text:\nنقل و انتقال فوتبال استقلال',
      metadata: { articleId: '11111111-1111-1111-1111-111111111111' },
    });
    assert.equal(result.provider, 'mock');
    assert.ok(result.parsed);
  });
});

describe('renderPromptTemplate', () => {
  it('substitutes variables', () => {
    assert.equal(renderPromptTemplate('Hello {{name}}', { name: 'Rex' }), 'Hello Rex');
  });
});
