import * as cheerio from 'cheerio';
import { countWords, detectLanguageHint, normalizeText } from './normalize.js';

export const PARSER_VERSION = '1.0.0';

export interface ParsedArticleContent {
  extractedTitle: string | null;
  byline: string | null;
  language: string | null;
  textContent: string;
  htmlContent: string | null;
  wordCount: number;
  charCount: number;
  parserVersion: string;
  metadata: {
    strategy: string;
    removedNoise: boolean;
  };
}

const CONTENT_SELECTORS = [
  'article',
  'main article',
  '[itemprop="articleBody"]',
  '.article-body',
  '.article__body',
  '.story-body',
  '.entry-content',
  '.post-content',
  '.content__article-body',
  '#article-body',
  'main',
];

function stripNoise($: cheerio.CheerioAPI): void {
  $(
    'script, style, noscript, iframe, svg, form, nav, footer, header, aside, .advert, .ads, .ad, .share, .social, .newsletter, .related, .comments, .breadcrumb',
  ).remove();
}

function pickContentRoot($: cheerio.CheerioAPI): { html: string; strategy: string } {
  for (const selector of CONTENT_SELECTORS) {
    const node = $(selector).first();
    const text = normalizeText(node.text());
    if (text.length >= 200) {
      return { html: $.html(node) ?? '', strategy: selector };
    }
  }
  const body = $('body');
  return { html: $.html(body) ?? '', strategy: 'body' };
}

export function parseArticleHtml(html: string, fallbackTitle?: string | null): ParsedArticleContent {
  const $ = cheerio.load(html);
  stripNoise($);

  const title =
    normalizeText($('meta[property="og:title"]').attr('content') ?? '') ||
    normalizeText($('meta[name="twitter:title"]').attr('content') ?? '') ||
    normalizeText($('h1').first().text()) ||
    normalizeText($('title').first().text()) ||
    (fallbackTitle ? normalizeText(fallbackTitle) : null) ||
    null;

  const byline =
    normalizeText($('meta[name="author"]').attr('content') ?? '') ||
    normalizeText($('[rel="author"]').first().text()) ||
    normalizeText($('.byline').first().text()) ||
    null;

  const langAttr =
    $('html').attr('lang') ||
    $('meta[http-equiv="content-language"]').attr('content') ||
    null;

  const { html: contentHtml, strategy } = pickContentRoot($);
  const $content = cheerio.load(contentHtml);
  stripNoise($content);
  const textContent = normalizeText($content.text());

  if (textContent.length < 40) {
    throw new Error('Parsed content too short');
  }

  const language = (langAttr ? langAttr.slice(0, 2).toLowerCase() : null) || detectLanguageHint(textContent);

  return {
    extractedTitle: title,
    byline: byline || null,
    language,
    textContent,
    htmlContent: contentHtml.slice(0, 500_000),
    wordCount: countWords(textContent),
    charCount: textContent.length,
    parserVersion: PARSER_VERSION,
    metadata: {
      strategy,
      removedNoise: true,
    },
  };
}
