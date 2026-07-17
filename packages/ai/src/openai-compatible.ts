import type { AiCompletionRequest, AiCompletionResult, AiProvider } from './types.js';

/**
 * OpenAI-compatible chat completions adapter.
 * Disabled unless AI_PROVIDER=openai_compatible and AI_BASE_URL + AI_API_KEY are set.
 * Never logs the API key.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai_compatible';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const started = Date.now();
    const model = request.metadata?.model || this.defaultModel;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI provider HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
    const content = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = undefined;
    }

    return {
      content,
      parsed,
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        cachedInputTokens: json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
      latencyMs: Date.now() - started,
      provider: this.name,
      model,
    };
  }
}
