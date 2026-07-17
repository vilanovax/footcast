import { MockAiProvider } from './mock-provider.js';
import { OpenAiCompatibleProvider } from './openai-compatible.js';
import type { AiProvider } from './types.js';

export function createAiProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AiProvider {
  const kind = (env.AI_PROVIDER || 'mock').toLowerCase();
  if (kind === 'openai_compatible' || kind === 'openai') {
    const baseUrl = env.AI_BASE_URL;
    const apiKey = env.AI_API_KEY;
    const model = env.AI_MODEL || 'gpt-4o-mini';
    if (!baseUrl || !apiKey) {
      throw new Error('AI_BASE_URL and AI_API_KEY required for openai_compatible provider');
    }
    return new OpenAiCompatibleProvider(baseUrl, apiKey, model);
  }
  return new MockAiProvider();
}
