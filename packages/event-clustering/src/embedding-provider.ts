import { EMBEDDING_DIMS, mockEmbed } from './embedding.js';

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';
  readonly model = 'hash-bow-v1';
  readonly dimensions = EMBEDDING_DIMS;

  async embed(text: string): Promise<number[]> {
    return mockEmbed(text, this.dimensions);
  }
}

/** OpenAI-compatible embeddings API. */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly model: string;
  readonly dimensions: number;

  constructor(
    private readonly opts: {
      apiKey: string;
      model?: string;
      dimensions?: number;
      baseUrl?: string;
    },
  ) {
    this.model = opts.model ?? 'text-embedding-3-small';
    this.dimensions = opts.dimensions ?? EMBEDDING_DIMS;
  }

  async embed(text: string): Promise<number[]> {
    const base = (this.opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const res = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text.slice(0, 8000),
        dimensions: this.dimensions,
      }),
    });
    if (!res.ok) {
      throw new Error(`Embedding HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vec = json.data?.[0]?.embedding;
    if (!vec || vec.length === 0) throw new Error('Empty embedding');
    return vec;
  }
}

let activeProvider: EmbeddingProvider = new MockEmbeddingProvider();
let allowMock = true;

export function configureEmbeddingRuntime(opts: {
  allowMock?: boolean;
  provider?: EmbeddingProvider;
}): void {
  if (opts.allowMock != null) allowMock = opts.allowMock;
  if (opts.provider) activeProvider = opts.provider;
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!allowMock && activeProvider.name === 'mock') {
    throw new Error(
      'Mock embedding provider is disabled in this environment. Set EMBEDDING_PROVIDER to a real provider.',
    );
  }
  return activeProvider;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  activeProvider = provider;
}

export function resetEmbeddingProvider(): void {
  activeProvider = new MockEmbeddingProvider();
  allowMock = true;
}

export function createEmbeddingProvider(opts: {
  provider: 'mock' | 'openai';
  apiKey?: string | null;
  allowMock?: boolean;
  model?: string;
}): EmbeddingProvider {
  if (opts.provider === 'openai') {
    if (!opts.apiKey) {
      throw new Error('OPENAI_API_KEY required for openai embedding provider');
    }
    return new OpenAiEmbeddingProvider({
      apiKey: opts.apiKey,
      model: opts.model,
    });
  }
  if (opts.allowMock === false) {
    throw new Error('Mock embedding provider is not allowed');
  }
  return new MockEmbeddingProvider();
}
