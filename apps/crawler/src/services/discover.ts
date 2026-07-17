import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '@footcast/database';
import { ArticleStatus, FeedType } from '@footcast/shared';
import type { DiscoveredItem } from '../feeds/parse-rss.js';
import { parseRssOrAtom } from '../feeds/parse-rss.js';
import { parseSitemap, parseSitemapIndex } from '../feeds/parse-sitemap.js';
import { safeFetch } from '../http/safe-fetch.js';

const MAX_ITEMS_PER_FEED = 100;
const MAX_SITEMAP_CHILDREN = 5;

export async function fetchFeedItems(
  feedType: FeedType,
  feedUrl: string,
): Promise<{ items: DiscoveredItem[]; httpStatus: number; etag: string | null; lastModified: string | null }> {
  const response = await safeFetch(feedUrl);
  const body = await response.text();
  const etag = response.headers.get('etag');
  const lastModified = response.headers.get('last-modified');

  if (!response.ok) {
    throw Object.assign(new Error(`Feed HTTP ${response.status}`), {
      code: 'FEED_HTTP_ERROR',
      httpStatus: response.status,
    });
  }

  let items: DiscoveredItem[] = [];
  if (feedType === FeedType.SITEMAP) {
    if (body.includes('<sitemapindex')) {
      const childUrls = parseSitemapIndex(body).slice(0, MAX_SITEMAP_CHILDREN);
      for (const child of childUrls) {
        const childRes = await safeFetch(child);
        if (!childRes.ok) continue;
        const childXml = await childRes.text();
        items.push(...parseSitemap(childXml));
      }
    } else {
      items = parseSitemap(body);
    }
  } else {
    items = parseRssOrAtom(body);
  }

  return {
    items: items.slice(0, MAX_ITEMS_PER_FEED),
    httpStatus: response.status,
    etag,
    lastModified,
  };
}

export async function persistDiscoveredArticles(
  db: Database,
  sourceId: string,
  items: DiscoveredItem[],
): Promise<{ createdIds: string[]; skipped: number }> {
  const createdIds: string[] = [];
  let skipped = 0;

  for (const item of items) {
    let canonicalUrl: string;
    try {
      canonicalUrl = new URL(item.url).toString();
    } catch {
      skipped += 1;
      continue;
    }
    const urlHash = createHash('sha256').update(canonicalUrl).digest('hex');
    const idempotencyKey = `${sourceId}:${urlHash}`;
    const existing = await db.models.RawArticle.findOne({ where: { idempotencyKey } });
    if (existing) {
      skipped += 1;
      continue;
    }
    const article = await db.models.RawArticle.create({
      id: randomUUID(),
      sourceId,
      canonicalUrl,
      urlHash,
      title: item.title,
      status: ArticleStatus.DISCOVERED,
      discoveredAt: new Date(),
      publishedAt: item.publishedAt,
      fetchedAt: null,
      parsedAt: null,
      contentHash: null,
      httpStatus: null,
      errorMessage: null,
      idempotencyKey,
      attemptCount: 0,
      storagePath: null,
    });
    createdIds.push(article.getDataValue('id'));
  }

  return { createdIds, skipped };
}
