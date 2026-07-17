import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Op, col, fn } from 'sequelize';
import type { Database } from '@footcast/database';
import type {
  GenerateAudioJobData,
  GeneratePodcastJobData,
  PublishEpisodeJobData,
  Queue,
} from '@footcast/queue';
import { EpisodeStatus, EventStatus } from '@footcast/shared';
import { buildPodcastRss } from '@footcast/tts';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import {
  GENERATE_AUDIO_QUEUE,
  GENERATE_PODCAST_QUEUE,
  PUBLISH_EPISODE_QUEUE,
} from '../queue/queue.tokens.js';

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'episode'}-${Date.now().toString(36)}`;
}

@Injectable()
export class PodcastsService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(GENERATE_PODCAST_QUEUE)
    private readonly podcastQueue: Queue<GeneratePodcastJobData>,
    @Inject(GENERATE_AUDIO_QUEUE)
    private readonly audioQueue: Queue<GenerateAudioJobData>,
    @Inject(PUBLISH_EPISODE_QUEUE)
    private readonly publishQueue: Queue<PublishEpisodeJobData>,
  ) {}

  async list(page = 1, pageSize = 20, status?: EpisodeStatus) {
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;
    const where = status ? { status } : {};
    const { rows, count } = await this.db.models.PodcastEpisode.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page: Math.max(page, 1), pageSize: limit, total: count },
    };
  }

  async get(id: string) {
    const episode = await this.db.models.PodcastEpisode.findByPk(id, {
      include: [
        {
          association: 'items',
          include: [{ association: 'event' }],
          separate: true,
          order: [['sortOrder', 'ASC']],
        },
        {
          association: 'scripts',
          separate: true,
          order: [['version', 'DESC']],
          limit: 10,
        },
        {
          association: 'audios',
          separate: true,
          order: [['createdAt', 'DESC']],
          limit: 5,
        },
        { association: 'publication' },
      ],
    });
    if (!episode) throw new NotFoundException('Episode not found');
    const cost = (await this.db.models.AiRequest.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'requests'],
        [fn('SUM', col('estimated_cost')), 'estimatedCost'],
        [fn('SUM', col('input_tokens')), 'inputTokens'],
        [fn('SUM', col('output_tokens')), 'outputTokens'],
      ],
      where: { relatedEpisodeId: id },
      raw: true,
    })) as {
      requests?: string | number;
      estimatedCost?: string | number;
      inputTokens?: string | number;
      outputTokens?: string | number;
    } | null;

    return {
      ...episode.toJSON(),
      costSummary: {
        requests: Number(cost?.requests ?? 0),
        estimatedCost: Number(cost?.estimatedCost ?? 0),
        inputTokens: Number(cost?.inputTokens ?? 0),
        outputTokens: Number(cost?.outputTokens ?? 0),
        tokens:
          Number(cost?.inputTokens ?? 0) + Number(cost?.outputTokens ?? 0),
      },
    };
  }

  async create(input: {
    title: string;
    targetDurationMin?: number;
    hostNotes?: string;
    createdBy?: string;
    eventIds?: string[];
  }) {
    const id = randomUUID();
    await this.db.models.PodcastEpisode.create({
      id,
      title: input.title,
      slug: slugify(input.title),
      status: EpisodeStatus.DRAFT,
      language: 'fa',
      targetDurationMin: input.targetDurationMin ?? 10,
      hostNotes: input.hostNotes ?? null,
      createdBy: input.createdBy ?? null,
      currentScriptVersionId: null,
      metadata: null,
    });

    if (input.eventIds?.length) {
      await this.addItems(id, input.eventIds);
    }

    return this.get(id);
  }

  async addItems(episodeId: string, eventIds: string[]) {
    const episode = await this.db.models.PodcastEpisode.findByPk(episodeId);
    if (!episode) throw new NotFoundException('Episode not found');

    const uniqueIds = [...new Set(eventIds)];
    const events = await this.db.models.NewsEvent.findAll({
      where: {
        id: { [Op.in]: uniqueIds },
        status: { [Op.in]: [EventStatus.APPROVED, EventStatus.SELECTED] },
      },
    });
    if (events.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Only APPROVED or SELECTED events can be added to an episode',
      );
    }

    const existing = await this.db.models.PodcastEpisodeItem.count({
      where: { episodeId },
    });
    let order = existing;
    for (const event of events) {
      const eventId = event.getDataValue('id');
      const already = await this.db.models.PodcastEpisodeItem.findOne({
        where: { episodeId, eventId },
      });
      if (already) continue;
      await this.db.models.PodcastEpisodeItem.create({
        id: randomUUID(),
        episodeId,
        eventId,
        sortOrder: order,
        isSelected: true,
        editorNote: null,
      });
      order += 1;
      if (event.getDataValue('status') === EventStatus.APPROVED) {
        await event.update({ status: EventStatus.SELECTED });
      }
    }

    if (order > 0 && episode.getDataValue('status') === EpisodeStatus.DRAFT) {
      await episode.update({ status: EpisodeStatus.NEWS_SELECTED });
    }

    return this.get(episodeId);
  }

  async reorderItems(episodeId: string, orderedEventIds: string[]) {
    await this.get(episodeId);
    for (let i = 0; i < orderedEventIds.length; i += 1) {
      await this.db.models.PodcastEpisodeItem.update(
        { sortOrder: i },
        { where: { episodeId, eventId: orderedEventIds[i] } },
      );
    }
    return this.get(episodeId);
  }

  async removeItem(episodeId: string, eventId: string) {
    const deleted = await this.db.models.PodcastEpisodeItem.destroy({
      where: { episodeId, eventId },
    });
    if (!deleted) throw new NotFoundException('Episode item not found');
    const remaining = await this.db.models.PodcastEpisodeItem.count({
      where: { episodeId },
    });
    if (remaining === 0) {
      await this.db.models.PodcastEpisode.update(
        { status: EpisodeStatus.DRAFT },
        { where: { id: episodeId } },
      );
    }
    return this.get(episodeId);
  }

  async enqueueGenerate(episodeId: string, actorUserId?: string) {
    const episode = await this.db.models.PodcastEpisode.findByPk(episodeId);
    if (!episode) throw new NotFoundException('Episode not found');
    const itemCount = await this.db.models.PodcastEpisodeItem.count({
      where: { episodeId, isSelected: true },
    });
    if (itemCount === 0) {
      throw new BadRequestException('Add at least one selected news item first');
    }

    await episode.update({ status: EpisodeStatus.SCRIPT_GENERATING });
    const job = await this.podcastQueue.add(
      'generate',
      { episodeId, reason: 'manual', actorUserId },
      { jobId: `podcast-${episodeId}-${Date.now()}` },
    );
    return {
      episodeId,
      queued: true,
      queue: 'generate-podcast',
      jobId: String(job.id),
    };
  }

  async latestScript(episodeId: string) {
    await this.get(episodeId);
    const script = await this.db.models.PodcastScriptVersion.findOne({
      where: { episodeId },
      order: [['version', 'DESC']],
    });
    if (!script) throw new NotFoundException('Script not found');
    return script.toJSON();
  }

  async approveScript(episodeId: string, actorUserId: string) {
    const episode = await this.db.models.PodcastEpisode.findByPk(episodeId);
    if (!episode) throw new NotFoundException('Episode not found');
    const status = episode.getDataValue('status');
    if (
      status !== EpisodeStatus.SCRIPT_READY &&
      status !== EpisodeStatus.SCRIPT_REVIEWED &&
      status !== EpisodeStatus.FAILED
    ) {
      throw new BadRequestException(`Cannot approve script from status ${status}`);
    }

    const scriptId = episode.getDataValue('currentScriptVersionId');
    if (!scriptId) throw new BadRequestException('No script version to approve');

    await this.db.models.PodcastScriptVersion.update(
      { status: 'reviewed' },
      { where: { id: scriptId } },
    );
    await episode.update({ status: EpisodeStatus.SCRIPT_REVIEWED });
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId,
      action: 'podcast.script_approve',
      entityType: 'PodcastEpisode',
      entityId: episodeId,
      before: { status },
      after: { status: EpisodeStatus.SCRIPT_REVIEWED, scriptId },
      ip: null,
    });
    return this.get(episodeId);
  }

  async approveEpisode(episodeId: string, actorUserId: string) {
    const episode = await this.db.models.PodcastEpisode.findByPk(episodeId);
    if (!episode) throw new NotFoundException('Episode not found');
    const status = episode.getDataValue('status');
    if (status !== EpisodeStatus.SCRIPT_REVIEWED && status !== EpisodeStatus.SCRIPT_READY) {
      throw new BadRequestException(`Cannot approve episode from status ${status}`);
    }
    await episode.update({ status: EpisodeStatus.APPROVED });
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId,
      action: 'podcast.episode_approve',
      entityType: 'PodcastEpisode',
      entityId: episodeId,
      before: { status },
      after: { status: EpisodeStatus.APPROVED },
      ip: null,
    });
    return this.get(episodeId);
  }

  async enqueueAudio(episodeId: string, actorUserId?: string) {
    const episode = await this.db.models.PodcastEpisode.findByPk(episodeId);
    if (!episode) throw new NotFoundException('Episode not found');
    const status = episode.getDataValue('status');
    if (
      ![
        EpisodeStatus.APPROVED,
        EpisodeStatus.SCRIPT_REVIEWED,
        EpisodeStatus.AUDIO_READY,
        EpisodeStatus.PUBLISHED,
        EpisodeStatus.FAILED,
      ].includes(status as EpisodeStatus)
    ) {
      throw new BadRequestException(`Cannot generate audio from status ${status}`);
    }
    if (!episode.getDataValue('currentScriptVersionId')) {
      throw new BadRequestException('Script required before TTS');
    }
    await episode.update({ status: EpisodeStatus.AUDIO_GENERATING });
    const job = await this.audioQueue.add(
      'generate-audio',
      { episodeId, reason: 'manual', actorUserId },
      { jobId: `audio-${episodeId}-${Date.now()}` },
    );
    return {
      episodeId,
      queued: true,
      queue: 'generate-audio',
      jobId: String(job.id),
    };
  }

  async latestAudio(episodeId: string) {
    await this.get(episodeId);
    const audio = await this.db.models.PodcastAudio.findOne({
      where: { episodeId },
      order: [['createdAt', 'DESC']],
    });
    if (!audio) throw new NotFoundException('Audio not found');
    return audio.toJSON();
  }

  async resolveAudioFile(episodeId: string): Promise<{
    storagePath: string;
    mimeType: string;
    fileName: string;
  }> {
    const audio = await this.db.models.PodcastAudio.findOne({
      where: { episodeId, status: 'ready' },
      order: [['createdAt', 'DESC']],
    });
    if (!audio) throw new NotFoundException('Audio file not found');
    return {
      storagePath: audio.getDataValue('storagePath'),
      mimeType: audio.getDataValue('mimeType'),
      fileName: `${episodeId}.wav`,
    };
  }

  async enqueuePublish(episodeId: string, actorUserId?: string) {
    const episode = await this.db.models.PodcastEpisode.findByPk(episodeId);
    if (!episode) throw new NotFoundException('Episode not found');
    const status = episode.getDataValue('status');
    if (
      status !== EpisodeStatus.AUDIO_READY &&
      status !== EpisodeStatus.APPROVED &&
      status !== EpisodeStatus.PUBLISHED
    ) {
      throw new BadRequestException(`Cannot publish from status ${status}`);
    }
    const audio = await this.db.models.PodcastAudio.findOne({
      where: { episodeId, status: 'ready' },
    });
    if (!audio) throw new BadRequestException('Generate audio before publish');

    const job = await this.publishQueue.add(
      'publish',
      { episodeId, reason: 'manual', actorUserId },
      { jobId: `publish-${episodeId}-${Date.now()}` },
    );
    return {
      episodeId,
      queued: true,
      queue: 'publish-episode',
      jobId: String(job.id),
    };
  }

  async buildRssFeed(): Promise<string> {
    const pubs = await this.db.models.PodcastPublication.findAll({
      order: [['publishedAt', 'DESC']],
      limit: 50,
      include: [{ association: 'audio' }],
    });
    const product =
      (
        await this.db.models.AppSetting.findByPk('product.name.fa')
      )?.getDataValue('value') ?? 'اتاق خبر فوتبال';
    const title = typeof product === 'string' ? product : 'اتاق خبر فوتبال';

    return buildPodcastRss({
      channelTitle: String(title),
      channelDescription: 'خلاصه خبر فوتبال ایران و اروپا',
      channelLink: process.env.WEB_ORIGIN || 'http://localhost:3000',
      language: 'fa-IR',
      items: pubs.map((pub) => {
        const meta = (pub.getDataValue('rssMetadata') ?? {}) as Record<string, unknown>;
        return {
          title: pub.getDataValue('title'),
          description: pub.getDataValue('description') ?? pub.getDataValue('title'),
          audioUrl: pub.getDataValue('audioUrl'),
          durationSec: Number(meta.durationSec ?? 0),
          pubDate: pub.getDataValue('publishedAt'),
          guid: pub.getDataValue('guid'),
          mimeType: String(meta.mimeType ?? 'audio/wav'),
          fileSizeBytes: Number(meta.fileSizeBytes ?? 0),
        };
      }),
    });
  }
}
