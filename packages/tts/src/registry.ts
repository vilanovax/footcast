import { MockTtsProvider } from './mock-provider.js';
import type { TtsProvider } from './types.js';

export function createTtsProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TtsProvider {
  const kind = (env.TTS_PROVIDER || 'mock').toLowerCase();
  if (kind === 'mock') {
    return new MockTtsProvider();
  }
  // Real providers (ElevenLabs / OpenAI) intentionally not wired without keys.
  return new MockTtsProvider();
}
