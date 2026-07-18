import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertTransition } from '@footcast/article-pipeline';
import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import type { FetchArticleJobData, ParseArticleJobData, Queue } from '@footcast/queue';
import { ArticleStatus } from '@footcast/shared';
import { safeFetch } from '../http/safe-fetch.js';

/** Always resolve under monorepo root so crawler + worker share the same files. */
function storageRoot(): string {
  const raw = process.env.RAW_STORAGE_PATH || 'data/raw-html';
  if (path.isAbsolute(raw)) return raw;
  const monorepoRoot = path.resolve(process.cwd(), '../..');
  return path.resolve(monorepoRoot, raw);
}

export async function processFetchArticleJob(
  db: Database,
  logger: Logger,
  parseQueue: Queue<ParseArticleJobData>,
  data: FetchArticleJobData,
): Promise<void> {
  const article = await db.models.RawArticle.findByPk(data.articleId);
  if (!article) {
    logger.warn('Article missing for fetch', { articleId: data.articleId });
    return;
  }

  const from = article.getDataValue('status');
  assertTransition(from, ArticleStatus.FETCHING);
  await article.update({
    status: ArticleStatus.FETCHING,
    attemptCount: article.getDataValue('attemptCount') + 1,
    errorMessage: null,
  });

  try {
    const response = await safeFetch(data.url, { timeoutMs: 25_000 });
    const html = await response.text();
    const looksBlocked =
      response.status === 403 ||
      response.status === 429 ||
      /captcha|cloudflare|access denied/i.test(html.slice(0, 2000));

    if (!response.ok || looksBlocked) {
      assertTransition(ArticleStatus.FETCHING, ArticleStatus.FAILED);
      await article.update({
        status: ArticleStatus.FAILED,
        httpStatus: response.status,
        fetchedAt: new Date(),
        errorMessage: looksBlocked
          ? `Blocked or captcha suspected (HTTP ${response.status})`
          : `HTTP ${response.status}`,
      });
      return;
    }

    const dir = storageRoot();
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${data.articleId}.html`);
    await writeFile(filePath, html, 'utf8');
    const contentHash = createHash('sha256').update(html).digest('hex');

    assertTransition(ArticleStatus.FETCHING, ArticleStatus.FETCHED);
    await article.update({
      status: ArticleStatus.FETCHED,
      httpStatus: response.status,
      fetchedAt: new Date(),
      contentHash,
      storagePath: path.resolve(filePath),
      errorMessage: null,
    });

    await parseQueue.add(
      'parse',
      { articleId: data.articleId, reason: 'fetch_complete' },
      { jobId: `parse-${data.articleId}-${Date.now()}` },
    );

    logger.info('Article fetched', {
      articleId: data.articleId,
      bytes: html.length,
      contentHash,
      enqueuedParse: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await article.update({
      status: ArticleStatus.FAILED,
      fetchedAt: new Date(),
      errorMessage: message,
    });
    logger.warn('Article fetch failed', { articleId: data.articleId, message });
  }
}
