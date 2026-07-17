import { z } from 'zod';
import { CoverageScope, SourceType } from '@footcast/shared';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createSourceSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  sourceType: z.nativeEnum(SourceType),
  countryCode: z.string().length(2).optional().nullable(),
  language: z.enum(['fa', 'en']).default('fa'),
  baseUrl: z.string().url(),
  rssUrl: z.string().url().optional().nullable(),
  sitemapUrl: z.string().url().optional().nullable(),
  credibilitySeed: z.number().int().min(0).max(100).default(50),
  priority: z.number().int().min(0).max(1000).default(100),
  fetchIntervalSec: z.number().int().min(60).default(900),
  requiresJavascript: z.boolean().default(false),
  rateLimitPerMinute: z.number().int().min(1).max(120).default(10),
  isActive: z.boolean().default(true),
  coverageScope: z.nativeEnum(CoverageScope).default(CoverageScope.IRAN),
  metadata: z.record(z.unknown()).optional(),
});

export const updateSourceSchema = createSourceSchema.partial();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
