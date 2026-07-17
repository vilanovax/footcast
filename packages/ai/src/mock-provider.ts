import { NewsCategory, OfficialStatus } from '@footcast/shared';
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from './types.js';

function guessCategory(text: string): NewsCategory {
  const t = text.toLowerCase();
  if (/transfer|نقل.?انتقال|خرید|فروش/.test(t)) return NewsCategory.TRANSFER;
  if (/coach|مربی|سرمربی/.test(t)) return NewsCategory.COACH_CHANGE;
  if (/injur|مصدوم/.test(t)) return NewsCategory.INJURY;
  if (/national|تیم ملی/.test(t)) return NewsCategory.NATIONAL_TEAM;
  if (/result|نتیجه|گل/.test(t)) return NewsCategory.MATCH_RESULT;
  return NewsCategory.OTHER;
}

function guessScope(text: string): 'iran' | 'europe' | 'other' {
  if (/استقلال|پرسپولیس|سپاهان|تراکتور|ایران|لیگ برتر خلیج/.test(text)) return 'iran';
  if (/premier league|la liga|serie a|bundesliga|champions league|manchester|liverpool|real madrid/.test(
    text.toLowerCase(),
  )) {
    return 'europe';
  }
  return 'other';
}

/** Mock provider for offline/dev/tests — no external calls, no cost. */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const started = Date.now();
    const text = request.userPrompt;
    const articleId =
      request.metadata?.articleId ?? '00000000-0000-0000-0000-000000000000';
    const titleMatch = text.match(/Title:\s*(.+)/);
    const title = (titleMatch?.[1] ?? 'خبر فوتبال').trim().slice(0, 200);
    const scope = guessScope(text);
    const category = guessCategory(text);
    const isFootball =
      /football|soccer|فوتبال|باشگاه|لیگ|استقلال|پرسپولیس|transfer|coach|goal/i.test(text);

    const payload = {
      articleId,
      isRelevant: isFootball,
      scope,
      category,
      headlineFa: title.length > 3 ? title : 'خبر فوتبال',
      summaryFa: (() => {
        const body = text.split(/Article text:\n?/i)[1] ?? text;
        const cleaned = body.replace(/\s+/g, ' ').trim().slice(0, 400);
        return cleaned.length >= 10
          ? cleaned
          : 'خلاصه آزمایشی استخراج‌شده توسط MockAiProvider.';
      })(),
      league: null,
      clubs: [],
      people: [],
      facts: isFootball
        ? [
            {
              claim: title,
              status: 'unverified',
              confidence: 0.55,
              sourceText: title,
            },
          ]
        : [],
      numbers: [],
      quotes: [],
      officialStatus: OfficialStatus.UNVERIFIED,
      sourceType: 'trusted_media',
      importanceScore: isFootball ? 62 : 15,
      credibilityScore: 55,
      freshnessScore: 70,
      nationalRelevanceScore: scope === 'iran' ? 70 : 20,
      duplicateProbability: 0.08,
      publishedAt: null,
      eventOccurredAt: null,
      sourceName: request.metadata?.sourceName,
      sourceUrl: request.metadata?.sourceUrl,
      uncertainties: ['mock_extraction'],
      rejectionReasons: isFootball ? [] : ['not_football_related'],
    };

    return {
      content: JSON.stringify(payload),
      parsed: payload,
      usage: {
        inputTokens: Math.max(50, Math.round(request.userPrompt.length / 4)),
        outputTokens: Math.max(40, Math.round(JSON.stringify(payload).length / 4)),
      },
      latencyMs: Date.now() - started,
      provider: this.name,
      model: 'mock-v1',
    };
  }
}
