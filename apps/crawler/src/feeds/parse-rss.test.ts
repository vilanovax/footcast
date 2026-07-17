import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRssOrAtom } from './parse-rss.js';
import { parseSitemap, parseSitemapIndex } from './parse-sitemap.js';

describe('parseRssOrAtom', () => {
  it('parses RSS 2.0 items', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>خبر استقلال</title>
          <link>https://example.com/a1</link>
          <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;
    const items = parseRssOrAtom(xml);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.url, 'https://example.com/a1');
    assert.equal(items[0]?.title, 'خبر استقلال');
    assert.ok(items[0]?.publishedAt instanceof Date);
  });

  it('parses Atom entries with href link', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Persepolis news</title>
          <link href="https://example.com/a2"/>
          <updated>2024-02-01T10:00:00Z</updated>
        </entry>
      </feed>`;
    const items = parseRssOrAtom(xml);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.url, 'https://example.com/a2');
  });
});

describe('parseSitemap', () => {
  it('parses urlset', () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/p1</loc><lastmod>2024-03-01</lastmod></url>
      </urlset>`;
    const items = parseSitemap(xml);
    assert.equal(items[0]?.url, 'https://example.com/p1');
  });

  it('parses sitemap index locs', () => {
    const xml = `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-news.xml</loc></sitemap>
      </sitemapindex>`;
    assert.deepEqual(parseSitemapIndex(xml), ['https://example.com/sitemap-news.xml']);
  });
});
