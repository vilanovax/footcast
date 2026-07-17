import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { canExtract, canReparse, canReprocess } from '@footcast/article-pipeline';
import type { Queue } from '@footcast/queue';
import type {
  ExtractArticleJobData,
  FetchArticleJobData,
  ParseArticleJobData,
} from '@footcast/queue';
import { ArticleStatus } from '@footcast/shared';
import type { Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import {
  EXTRACT_ARTICLE_QUEUE,
  FETCH_ARTICLE_QUEUE,
  PARSE_ARTICLE_QUEUE,
} from '../queue/queue.tokens.js';

@Injectable()
export class ArticlesService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(FETCH_ARTICLE_QUEUE)
    private readonly fetchQueue: Queue<FetchArticleJobData>,
    @Inject(PARSE_ARTICLE_QUEUE)
    private readonly parseQueue: Queue<ParseArticleJobData>,
    @Inject(EXTRACT_ARTICLE_QUEUE)
    private readonly extractQueue: Queue<ExtractArticleJobData>,
  ) {}

  async list(page = 1, pageSize = 20, status?: ArticleStatus) {
    const offset = (page - 1) * pageSize;
    const where = status ? { status } : {};
    const { rows, count } = await this.db.models.RawArticle.findAndCountAll({
      where,
      include: [{ association: 'source' }],
      order: [['discoveredAt', 'DESC']],
      limit: pageSize,
      offset,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page, pageSize, total: count },
    };
  }

  async get(id: string) {
    const article = await this.db.models.RawArticle.findByPk(id, {
      include: [
        { association: 'source' },
        { association: 'content' },
        { association: 'extractions' },
      ],
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article.toJSON();
  }

  async getContent(id: string) {
    await this.get(id);
    const content = await this.db.models.ArticleContent.findByPk(id);
    if (!content) {
      throw new NotFoundException('Parsed content not found');
    }
    return content.toJSON();
  }

  async createDiscovered(input: {
    sourceId: string;
    canonicalUrl: string;
    title?: string;
    publishedAt?: string;
  }) {
    const urlHash = createHash('sha256').update(input.canonicalUrl).digest('hex');
    const idempotencyKey = `${input.sourceId}:${urlHash}`;
    const existing = await this.db.models.RawArticle.findOne({ where: { idempotencyKey } });
    if (existing) {
      return existing.toJSON();
    }
    const article = await this.db.models.RawArticle.create({
      id: randomUUID(),
      sourceId: input.sourceId,
      canonicalUrl: input.canonicalUrl,
      urlHash,
      title: input.title ?? null,
      status: ArticleStatus.DISCOVERED,
      discoveredAt: new Date(),
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      fetchedAt: null,
      parsedAt: null,
      contentHash: null,
      httpStatus: null,
      errorMessage: null,
      idempotencyKey,
      attemptCount: 0,
      storagePath: null,
    });
    return article.toJSON();
  }

  async reprocess(id: string) {
    const article = await this.db.models.RawArticle.findByPk(id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    const status = article.getDataValue('status');
    if (!canReprocess(status)) {
      throw new BadRequestException(`Cannot reprocess from status ${status}`);
    }
    await article.update({
      status: ArticleStatus.DISCOVERED,
      errorMessage: null,
    });
    const job = await this.fetchQueue.add(
      'fetch',
      {
        articleId: id,
        sourceId: article.getDataValue('sourceId'),
        url: article.getDataValue('canonicalUrl'),
      },
      { jobId: `fetch-${id}-${Date.now()}` },
    );
    return {
      articleId: id,
      queued: true,
      queue: 'fetch-article',
      jobId: String(job.id),
    };
  }

  async enqueueParse(id: string) {
    const article = await this.db.models.RawArticle.findByPk(id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    const status = article.getDataValue('status');
    if (!canReparse(status) && status !== ArticleStatus.FETCHED) {
      throw new BadRequestException(`Cannot parse from status ${status}`);
    }
    if (!article.getDataValue('storagePath') && status === ArticleStatus.DISCOVERED) {
      throw new BadRequestException('No stored HTML; run reprocess/fetch first');
    }
    const job = await this.parseQueue.add(
      'parse',
      { articleId: id, reason: 'manual' },
      { jobId: `parse-${id}-${Date.now()}` },
    );
    return {
      articleId: id,
      queued: true,
      queue: 'parse-article',
      jobId: String(job.id),
    };
  }

  async enqueueExtract(id: string) {
    const article = await this.db.models.RawArticle.findByPk(id, {
      include: [{ association: 'content' }],
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    const status = article.getDataValue('status');
    if (!canExtract(status)) {
      throw new BadRequestException(`Cannot extract from status ${status}`);
    }
    const content = (article as unknown as { content?: unknown }).content;
    if (!content) {
      throw new BadRequestException('Parsed content missing; run parse first');
    }
    const job = await this.extractQueue.add(
      'extract',
      { articleId: id, reason: 'manual' },
      { jobId: `extract-${id}-${Date.now()}` },
    );
    return {
      articleId: id,
      queued: true,
      queue: 'extract-article',
      jobId: String(job.id),
    };
  }

  async getLatestExtraction(id: string) {
    await this.get(id);
    const extraction = await this.db.models.ArticleExtraction.findOne({
      where: { articleId: id },
      order: [['createdAt', 'DESC']],
    });
    if (!extraction) {
      throw new NotFoundException('Extraction not found');
    }
    return extraction.toJSON();
  }
}
