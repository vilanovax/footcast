import { XMLParser } from 'fast-xml-parser';

export interface DiscoveredItem {
  url: string;
  title: string | null;
  publishedAt: Date | null;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickLink(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const found = pickLink(item);
      if (found) return found;
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.href === 'string') return obj.href;
    if (typeof obj['@_href'] === 'string') return obj['@_href'];
    if (typeof obj['#text'] === 'string') return obj['#text'];
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseRssOrAtom(xml: string): DiscoveredItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    processEntities: false,
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const items: DiscoveredItem[] = [];

  const rssChannel = (doc.rss as { channel?: Record<string, unknown> } | undefined)?.channel;
  if (rssChannel) {
    for (const raw of asArray(rssChannel.item)) {
      const item = raw as Record<string, unknown>;
      const url = pickLink(item.link) ?? pickLink(item.guid);
      if (!url) continue;
      items.push({
        url,
        title: typeof item.title === 'string' ? item.title : null,
        publishedAt: parseDate(item.pubDate) ?? parseDate(item.published),
      });
    }
  }

  const feed = doc.feed as Record<string, unknown> | undefined;
  if (feed) {
    for (const raw of asArray(feed.entry)) {
      const entry = raw as Record<string, unknown>;
      const url = pickLink(entry.link) ?? pickLink(entry.id);
      if (!url) continue;
      items.push({
        url,
        title: typeof entry.title === 'string' ? entry.title : null,
        publishedAt: parseDate(entry.updated) ?? parseDate(entry.published),
      });
    }
  }

  return items;
}
