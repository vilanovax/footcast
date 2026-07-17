import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import { factCheckScript } from '@footcast/podcast-script';
import type { FactCheckScriptJobData } from '@footcast/queue';
import type { ScriptClaim } from '@footcast/podcast-script';

export async function processFactCheckScriptJob(
  db: Database,
  logger: Logger,
  data: FactCheckScriptJobData,
): Promise<void> {
  const script = await db.models.PodcastScriptVersion.findByPk(data.scriptVersionId);
  if (!script) {
    logger.warn('Script version missing for fact-check', {
      scriptVersionId: data.scriptVersionId,
    });
    return;
  }

  const items = await db.models.PodcastEpisodeItem.findAll({
    where: { episodeId: data.episodeId, isSelected: true },
    include: [{ association: 'event' }],
    order: [['sortOrder', 'ASC']],
  });

  const newsItems = items.map((row) => {
    const event = (row as unknown as { event?: { getDataValue: (k: string) => unknown } }).event;
    return {
      eventId: row.getDataValue('eventId'),
      title: String(event?.getDataValue('title') ?? ''),
      summary: (event?.getDataValue('summary') as string | null) ?? null,
    };
  });

  const claims = (script.getDataValue('claimsJson') ?? []) as ScriptClaim[];
  const result = factCheckScript({ claims, items: newsItems });

  await script.update({
    factCheckJson: result as unknown as Record<string, unknown>,
    status: result.ok ? script.getDataValue('status') : 'needs_review',
  });

  logger.info('Podcast script fact-checked', {
    episodeId: data.episodeId,
    scriptVersionId: data.scriptVersionId,
    ok: result.ok,
    issues: result.issues.length,
  });
}
