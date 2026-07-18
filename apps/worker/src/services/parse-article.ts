import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertTransition,
  parseArticleHtml,
} from '@footcast/article-pipeline';
import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import type { ExtractArticleJobData, ParseArticleJobData, Queue } from '@footcast/queue';
import { ArticleStatus } from '@footcast/shared';

function monorepoRoot(): string {
  return path.resolve(process.cwd(), '../..');
}

function storageRoot(): string {
  const raw = process.env.RAW_STORAGE_PATH || 'data/raw-html';
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(monorepoRoot(), raw);
}

function resolveHtmlPath(articleId: string, storagePath: string | null): string {
  if (storagePath) {
    if (path.isAbsolute(storagePath)) return storagePath;
    // Old rows may store "./data/raw-html/…" relative to whatever cwd wrote them
    const cleaned = storagePath.replace(/^\.\//, '');
    const fromRoot = path.resolve(monorepoRoot(), cleaned);
    return fromRoot;
  }
  return path.join(storageRoot(), `${articleId}.html`);
}

export async function processParseArticleJob(
  db: Database,
  logger: Logger,
  extractQueue: Queue<ExtractArticleJobData> | null,
  data: ParseArticleJobData,
): Promise<void> {
  const article = await db.models.RawArticle.findByPk(data.articleId);
  if (!article) {
    logger.warn('Article missing for parse', { articleId: data.articleId });
    return;
  }

  const current = article.getDataValue('status');
  const attempts = article.getDataValue('attemptCount') + 1;
  await article.update({ attemptCount: attempts });

  try {
    if (current !== ArticleStatus.FETCHED && current !== ArticleStatus.PARSED && current !== ArticleStatus.FAILED) {
      throw new Error(`Cannot parse from status ${current}`);
    }
    if (current !== ArticleStatus.FETCHED) {
      assertTransition(current, ArticleStatus.FETCHED);
      await article.update({ status: ArticleStatus.FETCHED, errorMessage: null });
    }

    const filePath = resolveHtmlPath(
      data.articleId,
      article.getDataValue('storagePath'),
    );
    const html = await readFile(filePath, 'utf8');
    const parsed = parseArticleHtml(html, article.getDataValue('title'));
    const contentHash = createHash('sha256').update(parsed.textContent).digest('hex');
    const parsedAt = new Date();

    assertTransition(ArticleStatus.FETCHED, ArticleStatus.PARSED);

    await db.models.ArticleContent.upsert({
      articleId: data.articleId,
      storagePath: filePath,
      extractedTitle: parsed.extractedTitle,
      byline: parsed.byline,
      language: parsed.language,
      textContent: parsed.textContent,
      htmlContent: parsed.htmlContent,
      wordCount: parsed.wordCount,
      charCount: parsed.charCount,
      parserVersion: parsed.parserVersion,
      contentHash,
      metadata: parsed.metadata,
      parsedAt,
    });

    await article.update({
      status: ArticleStatus.PARSED,
      parsedAt,
      storagePath: filePath,
      errorMessage: null,
      title: parsed.extractedTitle ?? article.getDataValue('title'),
    });

    if (extractQueue) {
      await extractQueue.add(
        'extract',
        { articleId: data.articleId, reason: 'parse_complete' },
        { jobId: `extract-${data.articleId}-${Date.now()}` },
      );
    }

    logger.info('Article parsed', {
      articleId: data.articleId,
      wordCount: parsed.wordCount,
      language: parsed.language,
      strategy: parsed.metadata.strategy,
      attempts,
      enqueuedExtract: Boolean(extractQueue),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const from = article.getDataValue('status');
    if (canFail(from)) {
      await article.update({
        status: ArticleStatus.FAILED,
        errorMessage: message,
      });
    } else {
      await article.update({ errorMessage: message });
    }
    logger.warn('Article parse failed', {
      articleId: data.articleId,
      message,
      attempts,
      reason: data.reason,
    });
    throw error;
  }
}

function canFail(status: ArticleStatus): boolean {
  return [
    ArticleStatus.FETCHED,
    ArticleStatus.PARSED,
    ArticleStatus.FAILED,
    ArticleStatus.FETCHING,
  ].includes(status);
}
