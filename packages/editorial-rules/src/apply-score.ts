import type { EventScoreInput, EventScoreResult } from './score-event.js';
import { scoreNewsEvent } from './score-event.js';

export type LinkedSourceInfo = {
  sourceId: string;
  credibilitySeed: number;
  sourceType: string;
};

export function buildEventScoreInput(args: {
  title: string;
  summary?: string | null;
  scope?: string | null;
  category?: string | null;
  officialStatus?: string | null;
  freshnessScore?: number | null;
  aiImportanceHint?: number | null;
  aiCredibilityHint?: number | null;
  lastSeenAt?: Date | string | null;
  clubs?: string[];
  people?: string[];
  hasOpenConflict?: boolean;
  hasDirectQuote?: boolean;
  isAdvertisement?: boolean;
  isClickbait?: boolean;
  isNewDevelopment?: boolean;
  sources: LinkedSourceInfo[];
}): { input: EventScoreInput; result: EventScoreResult } {
  const uniqueById = new Map<string, LinkedSourceInfo>();
  for (const s of args.sources) {
    if (!uniqueById.has(s.sourceId)) uniqueById.set(s.sourceId, s);
  }
  const unique = [...uniqueById.values()];
  const ageHours =
    args.lastSeenAt != null
      ? (Date.now() - new Date(args.lastSeenAt).getTime()) / 3_600_000
      : null;

  const input: EventScoreInput = {
    title: args.title,
    summary: args.summary,
    scope: args.scope,
    category: args.category,
    officialStatus: args.officialStatus,
    freshnessScore: args.freshnessScore,
    aiImportanceHint: args.aiImportanceHint,
    aiCredibilityHint: args.aiCredibilityHint,
    sourceCredibilitySeeds: unique.map((s) => s.credibilitySeed),
    sourceTypes: unique.map((s) => s.sourceType),
    independentSourceCount: Math.max(1, unique.length),
    clubs: args.clubs,
    people: args.people,
    hasOpenConflict: args.hasOpenConflict,
    isDuplicateHeavy: unique.length === 1 && args.sources.length > 3,
    hasDirectQuote: args.hasDirectQuote,
    isAdvertisement: args.isAdvertisement,
    isClickbait: args.isClickbait,
    isNewDevelopment: args.isNewDevelopment,
    ageHours,
  };

  return { input, result: scoreNewsEvent(input) };
}

export function toLegacyPenaltiesRecord(
  items: EventScoreResult['penalties'],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of items) {
    out[p.code] = (out[p.code] ?? 0) + p.value;
  }
  return out;
}
