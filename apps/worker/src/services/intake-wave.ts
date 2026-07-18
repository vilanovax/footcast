import { randomUUID } from 'node:crypto';
import {
  IntakeWaveStatus,
  WaveObservationType,
  editorialDateTehran,
  waveLabelForTime,
} from '@footcast/shared';
import type { Database } from '@footcast/database';

export async function getOrCreateOpenWave(db: Database) {
  const editorialDate = editorialDateTehran();
  const open = await db.models.IntakeWave.findOne({
    where: {
      editorialDate,
      status: IntakeWaveStatus.RUNNING,
    },
    order: [['startedAt', 'DESC']],
  });
  if (open) return open;

  const now = new Date();
  return db.models.IntakeWave.create({
    id: randomUUID(),
    editorialDate,
    timezone: 'Asia/Tehran',
    label: waveLabelForTime(now),
    profile: 'FULL',
    scheduledAt: null,
    startedAt: now,
    completedAt: null,
    status: IntakeWaveStatus.RUNNING,
    sourcesChecked: 0,
    articlesDiscovered: 0,
    articlesNew: 0,
    exactDuplicates: 0,
    nearDuplicates: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    failedSources: 0,
    metadata: { autoOpenedBy: 'cluster-event' },
  });
}

function significanceFor(type: WaveObservationType): number {
  switch (type) {
    case WaveObservationType.NEW_EVENT:
      return 90;
    case WaveObservationType.NEW_DEVELOPMENT:
      return 85;
    case WaveObservationType.OFFICIAL_CONFIRMATION:
      return 88;
    case WaveObservationType.CONFLICT_DETECTED:
      return 80;
    case WaveObservationType.NEW_SOURCE:
      return 55;
    case WaveObservationType.SCORE_CHANGED:
      return 40;
    default:
      return 10;
  }
}

export async function recordWaveObservation(
  db: Database,
  input: {
    newsEventId: string;
    observationType: WaveObservationType;
    rawArticleId?: string;
    summary?: string | null;
    skipIfNoMeaningful?: boolean;
  },
) {
  if (
    input.skipIfNoMeaningful &&
    input.observationType === WaveObservationType.NO_MEANINGFUL_CHANGE
  ) {
    return null;
  }

  const wave = await getOrCreateOpenWave(db);
  const now = new Date();
  const observation = await db.models.WaveEventObservation.create({
    id: randomUUID(),
    waveId: wave.getDataValue('id'),
    newsEventId: input.newsEventId,
    observationType: input.observationType,
    previousVersionId: null,
    currentVersionId: null,
    rawArticleIds: input.rawArticleId ? [input.rawArticleId] : null,
    detectedAt: now,
    isSeenByEditor: false,
    seenAt: null,
    significanceScore: significanceFor(input.observationType),
    summary: input.summary ?? null,
    metadata: null,
  });

  if (input.observationType === WaveObservationType.NEW_EVENT) {
    await wave.increment('eventsCreated');
    await wave.increment('articlesNew');
  } else if (
    input.observationType === WaveObservationType.NEW_DEVELOPMENT ||
    input.observationType === WaveObservationType.OFFICIAL_CONFIRMATION ||
    input.observationType === WaveObservationType.NEW_SOURCE ||
    input.observationType === WaveObservationType.CONFLICT_DETECTED
  ) {
    await wave.increment('eventsUpdated');
    await wave.increment('articlesNew');
  } else if (input.observationType === WaveObservationType.NO_MEANINGFUL_CHANGE) {
    // exact/near republish — count as duplicate-ish
    await wave.increment('nearDuplicates');
  }

  return observation;
}

export function observationTypeFromCluster(role: string): WaveObservationType {
  if (role === 'PRIMARY') return WaveObservationType.NEW_EVENT;
  if (role === 'NEW_DEVELOPMENT') return WaveObservationType.NEW_DEVELOPMENT;
  if (role === 'CONFLICTING') return WaveObservationType.CONFLICT_DETECTED;
  if (role === 'SUPPORTING') return WaveObservationType.NEW_SOURCE;
  if (role === 'EXACT_DUPLICATE' || role === 'NEAR_DUPLICATE') {
    return WaveObservationType.NO_MEANINGFUL_CHANGE;
  }
  return WaveObservationType.NEW_SOURCE;
}
