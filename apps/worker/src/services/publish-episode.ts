import { randomUUID } from 'node:crypto';
import { createNotification, type Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import type { PublishEpisodeJobData } from '@footcast/queue';
import { EpisodeStatus } from '@footcast/shared';

function publicApiBase(): string {
  return process.env.PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';
}

export async function processPublishEpisodeJob(
  db: Database,
  logger: Logger,
  data: PublishEpisodeJobData,
): Promise<void> {
  const episode = await db.models.PodcastEpisode.findByPk(data.episodeId);
  if (!episode) {
    logger.warn('Episode missing for publish', { episodeId: data.episodeId });
    return;
  }

  const audio = await db.models.PodcastAudio.findOne({
    where: { episodeId: data.episodeId, status: 'ready' },
    order: [['createdAt', 'DESC']],
  });
  if (!audio) {
    throw new Error('No ready audio for publication');
  }

  const existing = await db.models.PodcastPublication.findOne({
    where: { episodeId: data.episodeId },
  });
  if (existing) {
    await episode.update({ status: EpisodeStatus.PUBLISHED });
    logger.info('Episode already published', { episodeId: data.episodeId });
    return;
  }

  const audioUrl =
    audio.getDataValue('publicUrl') ??
    `${publicApiBase()}/podcasts/${data.episodeId}/audio/file`;
  const now = new Date();
  const publicationId = randomUUID();

  await db.models.PodcastPublication.create({
    id: publicationId,
    episodeId: data.episodeId,
    audioId: audio.getDataValue('id'),
    title: episode.getDataValue('title'),
    description: episode.getDataValue('hostNotes'),
    audioUrl,
    guid: `footcast-${data.episodeId}`,
    publishedAt: now,
    rssMetadata: {
      durationSec: audio.getDataValue('reportedDurationSec'),
      mimeType: audio.getDataValue('mimeType'),
      fileSizeBytes: audio.getDataValue('fileSizeBytes'),
      provider: audio.getDataValue('provider'),
    },
  });

  await episode.update({
    status: EpisodeStatus.PUBLISHED,
    metadata: {
      ...(episode.getDataValue('metadata') ?? {}),
      publicationId,
      publishedAt: now.toISOString(),
    },
  });

  await createNotification(db, {
    type: 'podcast.published',
    title: 'اپیزود منتشر شد',
    body: episode.getDataValue('title'),
    entityType: 'PodcastEpisode',
    entityId: data.episodeId,
    href: `/podcasts/${data.episodeId}`,
    metadata: { publicationId, audioUrl },
  });

  logger.info('Episode published', {
    episodeId: data.episodeId,
    publicationId,
    audioUrl,
  });
}
