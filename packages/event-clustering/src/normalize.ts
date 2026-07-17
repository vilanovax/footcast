import { createHash } from 'node:crypto';

export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeForMatch(input);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 1);
}

export function contentFingerprint(parts: Array<string | null | undefined>): string {
  const joined = parts
    .map((part) => normalizeForMatch(part ?? ''))
    .filter(Boolean)
    .join('|');
  return createHash('sha256').update(joined).digest('hex');
}

export function titleSimilarity(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function entityOverlap(a: string[], b: string[]): number {
  const left = new Set(a.map((x) => normalizeForMatch(x)).filter(Boolean));
  const right = new Set(b.map((x) => normalizeForMatch(x)).filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let hit = 0;
  for (const value of left) {
    if (right.has(value)) hit += 1;
  }
  return hit / Math.min(left.size, right.size);
}

export function withinHours(a: Date | null | undefined, b: Date | null | undefined, hours: number): boolean {
  if (!a || !b) return true;
  return Math.abs(a.getTime() - b.getTime()) <= hours * 60 * 60 * 1000;
}
