import { Inject, Injectable } from '@nestjs/common';
import { Op, fn, col } from 'sequelize';
import type { Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

@Injectable()
export class AiService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async listPromptVersions() {
    const rows = await this.db.models.PromptVersion.findAll({
      include: [{ association: 'template' }],
      order: [
        ['templateId', 'ASC'],
        ['version', 'DESC'],
      ],
    });
    return rows.map((row) => row.toJSON());
  }

  async usageSummary(days = 1) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recent = await this.db.models.AiRequest.findAll({
      where: { createdAt: { [Op.gte]: since } },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    const aggregates = (await this.db.models.AiRequest.findAll({
      attributes: [
        'pipelineStage',
        'provider',
        'model',
        [fn('COUNT', col('AiRequest.id')), 'requests'],
        [fn('SUM', col('AiRequest.input_tokens')), 'inputTokens'],
        [fn('SUM', col('AiRequest.output_tokens')), 'outputTokens'],
        [fn('SUM', col('AiRequest.estimated_cost')), 'estimatedCost'],
        [fn('AVG', col('AiRequest.latency_ms')), 'avgLatencyMs'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: ['pipelineStage', 'provider', 'model'],
      raw: true,
    })) as unknown as Array<Record<string, unknown>>;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [todayCost, windowCost, inputTokens, outputTokens] = await Promise.all([
      this.db.models.AiRequest.sum('estimatedCost', {
        where: { createdAt: { [Op.gte]: todayStart } },
      }),
      this.db.models.AiRequest.sum('estimatedCost', {
        where: { createdAt: { [Op.gte]: since } },
      }),
      this.db.models.AiRequest.sum('inputTokens', {
        where: { createdAt: { [Op.gte]: since } },
      }),
      this.db.models.AiRequest.sum('outputTokens', {
        where: { createdAt: { [Op.gte]: since } },
      }),
    ]);

    return {
      days,
      todayEstimatedCost: Number(todayCost ?? 0),
      windowEstimatedCost: Number(windowCost ?? 0),
      windowTokens: Number(inputTokens ?? 0) + Number(outputTokens ?? 0),
      byStageModel: aggregates,
      recent: recent.map((row) => row.toJSON()),
    };
  }
}
