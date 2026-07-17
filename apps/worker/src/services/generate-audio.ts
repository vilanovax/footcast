import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import type { GenerateAudioJobData } from '@footcast/queue';
import { EpisodeStatus } from '@footcast/shared';
import { createTtsProviderFromEnv } from '@footcast/tts';

function audioRoot(): string {
  return process.env.AUDIO_STORAGE_PATH || path.resolve(process.cwd(), '../../data/audio');
}

function publicApiBase(): string {
  return process.env.PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';
}

export async function processGenerateAudioJob(
  db: Database,
  logger: Logger,
  data: GenerateAudioJobData,
): Promise<void> {
  const episode = await db.models.PodcastEpisode.findByPk(data.episodeId);
  if (!episode) {
    logger.warn('Episode missing for audio', { episodeId: data.episodeId });
    return;
  }

  const scriptId = episode.getDataValue('currentScriptVersionId');
  if (!scriptId) {
    throw new Error('No script version available for TTS');
  }
  const script = await db.models.PodcastScriptVersion.findByPk(scriptId);
  if (!script) {
    throw new Error('Script version missing');
  }

  await episode.update({ status: EpisodeStatus.AUDIO_GENERATING });

  try {
    const provider = createTtsProviderFromEnv();
    const result = await provider.synthesize({
      text: script.getDataValue('bodyMd'),
      language: episode.getDataValue('language'),
      targetDurationSec: script.getDataValue('estimatedDurationSec'),
      voiceId: 'mock-fa-host',
    });

    const dir = path.join(audioRoot(), data.episodeId);
    await mkdir(dir, { recursive: true });
    const audioId = randomUUID();
    const filename = `${audioId}.wav`;
    const storagePath = path.join(dir, filename);
    await writeFile(storagePath, result.audioBuffer);

    const publicUrl = `${publicApiBase()}/podcasts/${data.episodeId}/audio/file`;

    await db.models.PodcastAudio.create({
      id: audioId,
      episodeId: data.episodeId,
      scriptVersionId: scriptId,
      provider: result.provider,
      model: result.model,
      voiceId: result.voiceId,
      mimeType: result.mimeType,
      storagePath,
      publicUrl,
      fileSizeBytes: result.audioBuffer.length,
      durationSec: result.durationSec,
      reportedDurationSec: result.reportedDurationSec,
      status: 'ready',
      metadata: {
        sampleRate: result.sampleRate,
        reason: data.reason ?? 'manual',
      },
    });

    await episode.update({
      status: EpisodeStatus.AUDIO_READY,
      metadata: {
        ...(episode.getDataValue('metadata') ?? {}),
        latestAudioId: audioId,
        audioPublicUrl: publicUrl,
      },
    });

    logger.info('Podcast audio generated', {
      episodeId: data.episodeId,
      audioId,
      bytes: result.audioBuffer.length,
      durationSec: result.durationSec,
      reportedDurationSec: result.reportedDurationSec,
      provider: result.provider,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await episode.update({
      status: EpisodeStatus.FAILED,
      metadata: {
        ...(episode.getDataValue('metadata') ?? {}),
        lastAudioError: message,
      },
    });
    logger.warn('Podcast audio generation failed', {
      episodeId: data.episodeId,
      message,
    });
    throw error;
  }
}
