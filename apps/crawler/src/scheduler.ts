import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import type { CrawlSourceJobData, Queue } from '@footcast/queue';
import { CrawlRunStatus, CrawlTrigger } from '@footcast/shared';
import { createPendingCrawlRun } from './services/crawl-source.js';

export async function enqueueDueSources(
  db: Database,
  logger: Logger,
  crawlQueue: Queue<CrawlSourceJobData>,
): Promise<number> {
  const sources = await db.models.Source.findAll({
    where: { isActive: true },
    include: [{ association: 'health' }],
  });

  let enqueued = 0;

  for (const source of sources) {
    const sourceId = source.getDataValue('id');
    const intervalSec = source.getDataValue('fetchIntervalSec') || 900;
    const latest = await db.models.CrawlRun.findOne({
      where: { sourceId },
      order: [['createdAt', 'DESC']],
    });

    if (latest) {
      const status = latest.getDataValue('status');
      if (status === CrawlRunStatus.PENDING || status === CrawlRunStatus.RUNNING) {
        continue;
      }
      const finishedAt = latest.getDataValue('finishedAt') ?? latest.getDataValue('createdAt');
      if (finishedAt && Date.now() - new Date(finishedAt).getTime() < intervalSec * 1000) {
        continue;
      }
    }

    const crawlRunId = await createPendingCrawlRun(db, sourceId, CrawlTrigger.SCHEDULE);
    const job = await crawlQueue.add(
      'crawl',
      { sourceId, crawlRunId, trigger: 'schedule' },
      {
        jobId: `crawl-${sourceId}-${crawlRunId}`,
        priority: source.getDataValue('priority'),
      },
    );
    await db.models.CrawlRun.update({ jobId: String(job.id) }, { where: { id: crawlRunId } });
    enqueued += 1;
    logger.info('Scheduled crawl enqueued', { sourceId, crawlRunId });
  }

  return enqueued;
}

export function startScheduler(
  db: Database,
  logger: Logger,
  crawlQueue: Queue<CrawlSourceJobData>,
  intervalMs = 60_000,
): NodeJS.Timeout {
  const tick = async () => {
    try {
      const count = await enqueueDueSources(db, logger, crawlQueue);
      if (count > 0) {
        logger.info('Scheduler tick complete', { enqueued: count });
      }
    } catch (error: unknown) {
      logger.error('Scheduler tick failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void tick();
  return setInterval(() => {
    void tick();
  }, intervalMs);
}
