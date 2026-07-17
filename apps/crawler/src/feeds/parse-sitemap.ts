import { XMLParser } from 'fast-xml-parser';
import type { DiscoveredItem } from './parse-rss.js';

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseSitemap(xml: string): DiscoveredItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    processEntities: false,
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const urlset = doc.urlset as { url?: Record<string, unknown> | Record<string, unknown>[] } | undefined;
  if (!urlset) return [];

  const items: DiscoveredItem[] = [];
  for (const entry of asArray(urlset.url)) {
    const loc = typeof entry.loc === 'string' ? entry.loc.trim() : '';
    if (!loc) continue;
    items.push({
      url: loc,
      title: null,
      publishedAt: parseDate(entry.lastmod),
    });
  }
  return items;
}

export function parseSitemapIndex(xml: string): string[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    processEntities: false,
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const index = doc.sitemapindex as
    | { sitemap?: Record<string, unknown> | Record<string, unknown>[] }
    | undefined;
  if (!index) return [];
  return asArray(index.sitemap)
    .map((entry) => (typeof entry.loc === 'string' ? entry.loc.trim() : ''))
    .filter(Boolean);
}
