import { NewsCategory, OfficialStatus, assessFootballRelevance } from '@footcast/shared';
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from './types.js';

function guessCategory(text: string): NewsCategory {
  const t = text.toLowerCase();
  if (/transfer|نقل.?انتقال|خرید بازیکن|فروش بازیکن|پیوستن/.test(t)) {
    return NewsCategory.TRANSFER;
  }
  if (/coach|مربی|سرمربی/.test(t)) return NewsCategory.COACH_CHANGE;
  if (/injur|مصدوم/.test(t)) return NewsCategory.INJURY;
  if (/national|تیم ملی/.test(t)) return NewsCategory.NATIONAL_TEAM;
  if (/result|نتیجه|گل\b|برد|باخت|تساوی/.test(t)) return NewsCategory.MATCH_RESULT;
  return NewsCategory.OTHER;
}

function guessScope(text: string): 'iran' | 'europe' | 'other' {
  if (/استقلال|پرسپولیس|سپاهان|تراکتور|ایران|لیگ برتر|خلیج فارس/.test(text)) {
    return 'iran';
  }
  if (
    /premier league|la liga|serie a|bundesliga|champions league|manchester|liverpool|real madrid|barcelona|arsenal|chelsea/i.test(
      text,
    )
  ) {
    return 'europe';
  }
  return 'other';
}

function extractTitleAndBody(text: string): { title: string; body: string } {
  const titleMatch = text.match(/Title:\s*(.+)/);
  const title = (titleMatch?.[1] ?? 'خبر فوتبال').trim().slice(0, 200);
  const body = (text.split(/Article text:\n?/i)[1] ?? text).replace(/\s+/g, ' ').trim();
  return { title, body };
}

/** Mock provider for offline/dev/tests — no external calls, no cost. */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const started = Date.now();
    const { title, body } = extractTitleAndBody(request.userPrompt);
    const articleId =
      request.metadata?.articleId ?? '00000000-0000-0000-0000-000000000000';
    const relevance = assessFootballRelevance({
      title,
      summary: body.slice(0, 280),
      leadText: body.slice(0, 500),
    });
    const isFootball = relevance.isFootball;
    const scope = guessScope(`${title}\n${body.slice(0, 400)}`);
    const category = isFootball ? guessCategory(`${title}\n${body.slice(0, 400)}`) : NewsCategory.OTHER;

    const payload = {
      articleId,
      isRelevant: isFootball,
      scope,
      category,
      headlineFa: title.length > 3 ? title : 'خبر فوتبال',
      summaryFa:
        body.length >= 10
          ? body.slice(0, 400)
          : 'خلاصه آزمایشی استخراج‌شده توسط MockAiProvider.',
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
      importanceScore: isFootball ? 62 : 8,
      credibilityScore: 55,
      freshnessScore: 70,
      nationalRelevanceScore: scope === 'iran' ? 70 : 20,
      duplicateProbability: 0.08,
      action:
        category === NewsCategory.TRANSFER
          ? /رسمی|official|امضا/i.test(title)
            ? 'TRANSFER_OFFICIAL'
            : /پیشنهاد|offer/i.test(title)
              ? 'OFFER_SUBMITTED'
              : /مذاکر|negotiat/i.test(title)
                ? 'NEGOTIATION_STARTED'
                : 'INTEREST_REPORTED'
          : category === NewsCategory.INJURY
            ? 'INJURY_REPORTED'
            : category === NewsCategory.COACH_CHANGE
              ? 'COACH_UNDER_PRESSURE'
              : category === NewsCategory.MATCH_RESULT
                ? 'MATCH_RESULT'
                : 'GENERIC_UPDATE',
      matchId: null,
      publishedAt: null,
      eventOccurredAt: null,
      sourceName: request.metadata?.sourceName,
      sourceUrl: request.metadata?.sourceUrl,
      uncertainties: ['mock_extraction', ...relevance.reasons],
      rejectionReasons: isFootball ? [] : ['not_football_related', ...relevance.reasons],
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
