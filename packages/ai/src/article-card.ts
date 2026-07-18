import { z } from 'zod';
import { NewsCategory, OfficialStatus } from '@footcast/shared';

export const articleCardSchema = z.object({
  articleId: z.string().uuid(),
  isRelevant: z.boolean(),
  scope: z.enum(['iran', 'europe', 'both', 'other']),
  category: z.nativeEnum(NewsCategory),
  headlineFa: z.string().min(3).max(500),
  summaryFa: z.string().min(10).max(4000),
  league: z
    .object({
      id: z.string().optional(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  clubs: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
      }),
    )
    .default([]),
  people: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        role: z.string().optional(),
      }),
    )
    .default([]),
  facts: z
    .array(
      z.object({
        claim: z.string(),
        status: z.string(),
        confidence: z.number().min(0).max(1),
        sourceText: z.string().optional(),
      }),
    )
    .default([]),
  numbers: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
        currency: z.string().optional(),
        isConfirmed: z.boolean().optional(),
      }),
    )
    .default([]),
  quotes: z.array(z.unknown()).default([]),
  officialStatus: z.nativeEnum(OfficialStatus),
  sourceType: z.string(),
  importanceScore: z.number().int().min(0).max(100),
  credibilityScore: z.number().int().min(0).max(100),
  freshnessScore: z.number().int().min(0).max(100),
  nationalRelevanceScore: z.number().int().min(0).max(100),
  duplicateProbability: z.number().min(0).max(1),
  /** Lifecycle action within eventType, e.g. NEGOTIATION_STARTED */
  action: z.string().min(2).max(64).nullable().optional(),
  matchId: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  eventOccurredAt: z.string().nullable().optional(),
  sourceName: z.string().optional(),
  sourceUrl: z.string().optional(),
  uncertainties: z.array(z.string()).default([]),
  rejectionReasons: z.array(z.string()).default([]),
});

export type ArticleCard = z.infer<typeof articleCardSchema>;

export function validateArticleCard(input: unknown): {
  success: boolean;
  data?: ArticleCard;
  errors?: string[];
} {
  const parsed = articleCardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return { success: true, data: parsed.data };
}
