import { Inject, Injectable } from '@nestjs/common';
import { ArticleStatus, HealthStatus } from '@footcast/shared';
import { Op, type Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async summary() {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [
      activeSources,
      erroredSources,
      articlesToday,
      discovered,
      failed,
      productNameEn,
      productNameFa,
      lastCrawl,
      parsed,
    ] = await Promise.all([
      this.db.models.Source.count({ where: { isActive: true } }),
      this.db.models.SourceHealth.count({
        where: { status: { [Op.in]: [HealthStatus.DOWN, HealthStatus.DEGRADED] } },
      }),
      this.db.models.RawArticle.count({
        where: { discoveredAt: { [Op.gte]: startOfDay } },
      }),
      this.db.models.RawArticle.count({
        where: {
          status: {
            [Op.in]: [ArticleStatus.DISCOVERED, ArticleStatus.FETCHED, ArticleStatus.FETCHING],
          },
        },
      }),
      this.db.models.RawArticle.count({ where: { status: ArticleStatus.FAILED } }),
      this.db.models.AppSetting.findByPk('product.name.en'),
      this.db.models.AppSetting.findByPk('product.name.fa'),
      this.db.models.CrawlRun.findOne({ order: [['createdAt', 'DESC']] }),
      this.db.models.RawArticle.count({ where: { status: ArticleStatus.PARSED } }),
    ]);

    return {
      productName: {
        en: productNameEn?.getDataValue('value') ?? 'Football Newsroom',
        fa: productNameFa?.getDataValue('value') ?? 'اتاق خبر فوتبال',
      },
      sources: {
        active: activeSources,
        errored: erroredSources,
      },
      articles: {
        discoveredToday: articlesToday,
        pending: discovered,
        failed,
        parsed,
      },
      episodes: {
        produced: 0,
      },
      costs: {
        last24h: 0,
        tokens: 0,
      },
      pipeline: {
        lastCrawlerRunAt: lastCrawl?.getDataValue('finishedAt') ?? lastCrawl?.getDataValue('createdAt') ?? null,
        lastNewsPipelineAt: null,
      },
    };
  }
}
