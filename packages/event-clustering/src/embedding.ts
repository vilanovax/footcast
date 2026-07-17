import { tokenize } from './normalize.js';

export const EMBEDDING_DIMS = 256;
export const EMBEDDING_PROVIDER = 'mock';
export const EMBEDDING_MODEL = 'hash-bow-v1';

/** Deterministic bag-of-words hash embedding for offline/dev (no external API). */
export function mockEmbed(text: string, dims = EMBEDDING_DIMS): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    vec[0] = 1;
    return vec;
  }

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % dims;
    vec[idx] += 1;
    vec[(idx + 7) % dims] += 0.35;
    vec[(idx + 13) % dims] += 0.15;
  }

  return l2Normalize(vec);
}

export function l2Normalize(vec: number[]): number[] {
  let sumSquares = 0;
  for (const value of vec) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares) || 1;
  return vec.map((value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function embeddingTextFromCard(input: {
  headlineFa?: string | null;
  summaryFa?: string | null;
  category?: string | null;
  clubs?: string[];
  people?: string[];
}): string {
  return [
    input.headlineFa ?? '',
    input.summaryFa ?? '',
    input.category ?? '',
    ...(input.clubs ?? []),
    ...(input.people ?? []),
  ]
    .filter(Boolean)
    .join(' ');
}
