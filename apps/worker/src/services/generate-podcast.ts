import { randomUUID } from 'node:crypto';
import { createNotification, type Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import { generatePodcastScript } from '@footcast/podcast-script';
import type { FactCheckScriptJobData, GeneratePodcastJobData, Queue } from '@footcast/queue';
import { EpisodeStatus } from '@footcast/shared';

export async function processGeneratePodcastJob(
  db: Database,
  logger: Logger,
  factCheckQueue: Queue<FactCheckScriptJobData> | null,
  data: GeneratePodcastJobData,
): Promise<void> {
  const episode = await db.models.PodcastEpisode.findByPk(data.episodeId, {
    include: [
      {
        association: 'items',
        where: { isSelected: true },
        required: false,
        include: [{ association: 'event' }],
      },
    ],
  });
  if (!episode) {
    logger.warn('Episode missing for script generation', { episodeId: data.episodeId });
    return;
  }

  await episode.update({ status: EpisodeStatus.SCRIPT_GENERATING });

  try {
    const items =
      (
        episode as unknown as {
          items?: Array<{
            getDataValue: (k: string) => unknown;
            event?: { getDataValue: (k: string) => unknown };
          }>;
        }
      ).items ?? [];

    const scriptItems = items
      .sort(
        (a, b) =>
          Number(a.getDataValue('sortOrder') ?? 0) - Number(b.getDataValue('sortOrder') ?? 0),
      )
      .map((row) => {
        const event = row.event;
        return {
          eventId: String(row.getDataValue('eventId')),
          title: String(event?.getDataValue('title') ?? 'بدون عنوان'),
          summary: (event?.getDataValue('summary') as string | null) ?? null,
          category: (event?.getDataValue('category') as string | null) ?? null,
          scope: (event?.getDataValue('scope') as string | null) ?? null,
          officialStatus: (event?.getDataValue('officialStatus') as string | null) ?? null,
          importanceScore: (event?.getDataValue('importanceScore') as number | null) ?? null,
          sourceLabels: ['news_event'],
        };
      });

    const generated = generatePodcastScript({
      episodeTitle: episode.getDataValue('title'),
      items: scriptItems,
      targetMinutes: episode.getDataValue('targetDurationMin'),
    });

    const last = await db.models.PodcastScriptVersion.findOne({
      where: { episodeId: data.episodeId },
      order: [['version', 'DESC']],
    });
    const version = (last?.getDataValue('version') ?? 0) + 1;
    const scriptId = randomUUID();

    await db.models.PodcastScriptVersion.create({
      id: scriptId,
      episodeId: data.episodeId,
      version,
      status: 'ready',
      title: generated.title,
      bodyMd: generated.bodyMd,
      wordCount: generated.wordCount,
      estimatedDurationSec: generated.estimatedDurationSec,
      claimsJson: generated.claims,
      segmentsJson: generated.segments,
      factCheckJson: null,
      generator: generated.generator,
      createdBy: data.actorUserId ?? null,
    });

    const inputTokens = Math.max(1, scriptItems.length * 180);
    const outputTokens = Math.max(1, Math.round(generated.wordCount * 1.3));
    // Local generator is free; keep a synthetic estimate for cost-per-episode visibility.
    const estimatedCost = Number(((inputTokens + outputTokens) * 0.0000002).toFixed(6));
    await db.models.AiRequest.create({
      id: randomUUID(),
      provider: 'local',
      model: generated.generator,
      pipelineStage: 'podcast_script',
      promptVersionId: null,
      relatedArticleId: null,
      relatedEpisodeId: data.episodeId,
      inputTokens,
      outputTokens,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      estimatedCost,
      actualCost: 0,
      latencyMs: 0,
      status: 'success',
      error: null,
      metadata: { scriptId, version, wordCount: generated.wordCount },
    });

    await episode.update({
      status: EpisodeStatus.SCRIPT_READY,
      currentScriptVersionId: scriptId,
      metadata: {
        ...(episode.getDataValue('metadata') ?? {}),
        lastGenerate: {
          scriptId,
          version,
          wordCount: generated.wordCount,
          estimatedDurationSec: generated.estimatedDurationSec,
          estimatedCost,
        },
      },
    });

    await createNotification(db, {
      type: 'podcast.script_ready',
      title: 'اسکریپت پادکست آماده شد',
      body: episode.getDataValue('title'),
      entityType: 'PodcastEpisode',
      entityId: data.episodeId,
      href: `/podcasts/${data.episodeId}`,
      metadata: { scriptId, version },
    });

    if (factCheckQueue) {
      await factCheckQueue.add(
        'fact-check',
        {
          episodeId: data.episodeId,
          scriptVersionId: scriptId,
          reason: 'after_generate',
        },
        { jobId: `factcheck-${scriptId}-${Date.now()}` },
      );
    }

    logger.info('Podcast script generated', {
      episodeId: data.episodeId,
      scriptId,
      version,
      wordCount: generated.wordCount,
      estimatedDurationSec: generated.estimatedDurationSec,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await episode.update({
      status: EpisodeStatus.FAILED,
      metadata: {
        ...(episode.getDataValue('metadata') ?? {}),
        lastError: message,
      },
    });
    logger.warn('Podcast script generation failed', {
      episodeId: data.episodeId,
      message,
    });
    throw error;
  }
}
