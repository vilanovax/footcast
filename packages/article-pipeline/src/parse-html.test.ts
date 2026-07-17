import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeText, countWords } from './normalize.js';
import { parseArticleHtml } from './parse-html.js';
import { assertTransition, canTransition, canReparse } from './state-machine.js';
import { ArticleStatus } from '@footcast/shared';

describe('normalizeText', () => {
  it('collapses whitespace', () => {
    assert.equal(normalizeText('  hello \n\n\n  world  '), 'hello\n\nworld');
    assert.equal(countWords('یک دو سه'), 3);
  });
});

describe('parseArticleHtml', () => {
  it('extracts article body and title', () => {
    const html = `<!doctype html><html lang="fa"><head>
      <title>Site</title>
      <meta property="og:title" content="انتقال بازیکن استقلال" />
      <meta name="author" content="خبرنگار ورزشی" />
    </head><body>
      <nav>منو</nav>
      <article>
        <h1>انتقال بازیکن استقلال</h1>
        <p>${'متن خبر برای تست استخراج محتوا. '.repeat(20)}</p>
      </article>
      <footer>فوتر</footer>
    </body></html>`;
    const parsed = parseArticleHtml(html);
    assert.equal(parsed.extractedTitle, 'انتقال بازیکن استقلال');
    assert.equal(parsed.byline, 'خبرنگار ورزشی');
    assert.equal(parsed.language, 'fa');
    assert.ok(parsed.wordCount > 20);
    assert.equal(parsed.metadata.strategy, 'article');
  });

  it('rejects empty pages', () => {
    assert.throws(() => parseArticleHtml('<html><body><p>hi</p></body></html>'), /too short/);
  });
});

describe('state machine', () => {
  it('allows fetched to parsed', () => {
    assert.equal(canTransition(ArticleStatus.FETCHED, ArticleStatus.PARSED), true);
    assert.doesNotThrow(() =>
      assertTransition(ArticleStatus.FETCHED, ArticleStatus.PARSED),
    );
  });

  it('blocks discovered to parsed', () => {
    assert.equal(canTransition(ArticleStatus.DISCOVERED, ArticleStatus.PARSED), false);
  });

  it('allows reparse from fetched/parsed/failed', () => {
    assert.equal(canReparse(ArticleStatus.FETCHED), true);
    assert.equal(canReparse(ArticleStatus.DISCOVERED), false);
  });
});
