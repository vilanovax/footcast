import { CoverageScope } from './enums.js';

/**
 * Canonical editorial scope used in DB, coverage, and scoring.
 * Accepts AI card scopes (iran/europe) and enum forms (IRAN/EUROPE).
 */
export function normalizeScope(
  raw: string | null | undefined,
): CoverageScope | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const key = t
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[يی]/g, 'ی')
    .replace(/[كک]/g, 'ک');

  if (
    key === 'iran' ||
    key === 'ir' ||
    key === 'ایران' ||
    key === 'فوتبال ایران'
  ) {
    return CoverageScope.IRAN;
  }
  if (
    key === 'europe' ||
    key === 'eu' ||
    key === 'اروپا' ||
    key === 'فوتبال اروپا'
  ) {
    return CoverageScope.EUROPE;
  }
  if (key === 'both' || key === 'هردو' || key === 'ایران و اروپا') {
    return CoverageScope.BOTH;
  }
  if (key === 'other' || key === 'سایر' || key === 'unknown') {
    return CoverageScope.OTHER;
  }
  // Already-canonical uppercase
  const upper = t.toUpperCase();
  if (upper === CoverageScope.IRAN) return CoverageScope.IRAN;
  if (upper === CoverageScope.EUROPE) return CoverageScope.EUROPE;
  if (upper === CoverageScope.BOTH) return CoverageScope.BOTH;
  if (upper === CoverageScope.OTHER) return CoverageScope.OTHER;
  return CoverageScope.OTHER;
}

/** Scope key for coverage buckets — never null (falls back to OTHER). */
export function scopeBucketKey(raw: string | null | undefined): string {
  return normalizeScope(raw) ?? CoverageScope.OTHER;
}
