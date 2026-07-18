import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import type { Database } from '@footcast/database';
import {
  DAILY_RUNDOWN_POLICY,
  DailyRundownStatus,
  EventStatus,
  IntakeWaveStatus,
  RundownItemStatus,
  RundownSection,
  WaveObservationType,
  coverageNeedForScope,
  deadlineAtForEditorialDate,
  editorialDateTehran,
  estimateDurationSeconds,
  selectionUtility,
  suggestSection,
  summarizeCoverage,
  waveLabelForTime,
} from '@footcast/shared';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

const ACTIVE_ITEM_STATUSES = [
  RundownItemStatus.CANDIDATE,
  RundownItemStatus.SHORTLISTED,
  RundownItemStatus.RESERVED,
  RundownItemStatus.FINAL_SELECTED,
];

const MEANINGFUL_OBS = [
  WaveObservationType.NEW_EVENT,
  WaveObservationType.NEW_DEVELOPMENT,
  WaveObservationType.OFFICIAL_CONFIRMATION,
  WaveObservationType.CONFLICT_DETECTED,
  WaveObservationType.NEW_SOURCE,
  WaveObservationType.SCORE_CHANGED,
];

@Injectable()
export class RundownService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  // ── Waves ──────────────────────────────────────────────

  async listWaves(editorialDate?: string) {
    const date = editorialDate ?? editorialDateTehran();
    const rows = await this.db.models.IntakeWave.findAll({
      where: { editorialDate: date },
      order: [['startedAt', 'DESC']],
    });
    return { data: rows.map((r) => r.toJSON()), meta: { editorialDate: date } };
  }

  async getWave(waveId: string) {
    const wave = await this.db.models.IntakeWave.findByPk(waveId);
    if (!wave) throw new NotFoundException('Wave not found');
    return wave.toJSON();
  }

  async openWave(label?: string, profile = 'FULL') {
    const editorialDate = editorialDateTehran();
    const existing = await this.db.models.IntakeWave.findOne({
      where: { editorialDate, status: IntakeWaveStatus.RUNNING },
      order: [['startedAt', 'DESC']],
    });
    if (existing) return existing.toJSON();

    const now = new Date();
    const wave = await this.db.models.IntakeWave.create({
      id: randomUUID(),
      editorialDate,
      timezone: DAILY_RUNDOWN_POLICY.timezone,
      label: label?.trim() || waveLabelForTime(now),
      profile,
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
      metadata: { openedVia: 'api' },
    });
    return wave.toJSON();
  }

  async completeWave(waveId: string) {
    const wave = await this.db.models.IntakeWave.findByPk(waveId);
    if (!wave) throw new NotFoundException('Wave not found');
    await wave.update({
      status: IntakeWaveStatus.COMPLETED,
      completedAt: new Date(),
    });
    return wave.toJSON();
  }

  /**
   * Seed current wave with open inbox events that predate Wave observations
   * (so editors are not stuck on an empty delta after deploy).
   */
  async backfillWave(waveId?: string): Promise<{
    waveId: string;
    openEvents: number;
    observationsCreated: number;
  }> {
    let wave = waveId
      ? await this.db.models.IntakeWave.findByPk(waveId)
      : await this.db.models.IntakeWave.findOne({
          where: { status: IntakeWaveStatus.RUNNING },
          order: [['startedAt', 'DESC']],
        });
    if (!wave) {
      await this.openWave();
      wave = await this.db.models.IntakeWave.findOne({
        where: { status: IntakeWaveStatus.RUNNING },
        order: [['startedAt', 'DESC']],
      });
      if (!wave) throw new BadRequestException('Could not open intake wave');
    }

    const openStatuses = [
      EventStatus.NEW,
      EventStatus.NEEDS_REVIEW,
      EventStatus.CONFLICTED,
      EventStatus.VERIFIED,
    ];
    const events = await this.db.models.NewsEvent.findAll({
      where: { status: { [Op.in]: openStatuses } },
      order: [
        ['effectiveFinalScore', 'DESC NULLS LAST'],
        ['updatedAt', 'DESC'],
      ],
      limit: 150,
    });

    const existing = await this.db.models.WaveEventObservation.findAll({
      where: {
        waveId: wave.getDataValue('id'),
        newsEventId: { [Op.in]: events.map((e) => e.getDataValue('id')) },
      },
      attributes: ['newsEventId'],
    });
    const have = new Set(existing.map((r) => r.getDataValue('newsEventId')));

    let created = 0;
    const now = new Date();
    for (const event of events) {
      const eventId = event.getDataValue('id');
      if (have.has(eventId)) continue;
      await this.db.models.WaveEventObservation.create({
        id: randomUUID(),
        waveId: wave.getDataValue('id'),
        newsEventId: eventId,
        observationType: WaveObservationType.NEW_EVENT,
        previousVersionId: null,
        currentVersionId: null,
        rawArticleIds: null,
        detectedAt: event.getDataValue('lastSeenAt') ?? now,
        isSeenByEditor: false,
        seenAt: null,
        significanceScore: event.getDataValue('effectiveFinalScore') ?? 70,
        summary: event.getDataValue('title'),
        metadata: { backfilled: true },
      });
      created += 1;
    }

    if (created > 0) {
      await wave.increment('eventsCreated', { by: created });
    }

    return {
      waveId: wave.getDataValue('id'),
      openEvents: events.length,
      observationsCreated: created,
    };
  }

  async waveInbox(
    waveId: string,
    tab:
      | 'new'
      | 'developments'
      | 'confirmations'
      | 'conflicts'
      | 'unseen'
      | 'all' = 'unseen',
  ) {
    const wave = await this.db.models.IntakeWave.findByPk(waveId);
    if (!wave) throw new NotFoundException('Wave not found');

    const typeFilter: string[] | null =
      tab === 'new'
        ? [WaveObservationType.NEW_EVENT]
        : tab === 'developments'
          ? [WaveObservationType.NEW_DEVELOPMENT]
          : tab === 'confirmations'
            ? [WaveObservationType.OFFICIAL_CONFIRMATION, WaveObservationType.NEW_SOURCE]
            : tab === 'conflicts'
              ? [WaveObservationType.CONFLICT_DETECTED]
              : tab === 'all'
                ? null
                : MEANINGFUL_OBS;

    const where: Record<string, unknown> = { waveId };
    if (typeFilter) where.observationType = { [Op.in]: typeFilter };
    if (tab === 'unseen') {
      where.isSeenByEditor = false;
      where.observationType = { [Op.in]: MEANINGFUL_OBS };
    }

    const rows = await this.db.models.WaveEventObservation.findAll({
      where,
      include: [{ association: 'event' }],
      order: [
        ['significanceScore', 'DESC NULLS LAST'],
        ['detectedAt', 'DESC'],
      ],
      limit: 200,
    });

    const counts = await this.waveInboxCounts(waveId);

    return {
      data: rows.map((r) => {
        const json = r.toJSON() as unknown as Record<string, unknown>;
        const event = (r as unknown as { event?: { toJSON: () => unknown } }).event;
        return { ...json, event: event?.toJSON?.() ?? null };
      }),
      meta: { waveId, tab, counts, wave: wave.toJSON() },
    };
  }

  private async waveInboxCounts(waveId: string) {
    const rows = await this.db.models.WaveEventObservation.findAll({
      where: { waveId, observationType: { [Op.in]: MEANINGFUL_OBS } },
      attributes: ['observationType', 'isSeenByEditor'],
    });
    const counts = {
      unseen: 0,
      new: 0,
      developments: 0,
      confirmations: 0,
      conflicts: 0,
      all: rows.length,
    };
    for (const row of rows) {
      const t = row.getDataValue('observationType');
      if (!row.getDataValue('isSeenByEditor')) counts.unseen += 1;
      if (t === WaveObservationType.NEW_EVENT) counts.new += 1;
      if (t === WaveObservationType.NEW_DEVELOPMENT) counts.developments += 1;
      if (
        t === WaveObservationType.OFFICIAL_CONFIRMATION ||
        t === WaveObservationType.NEW_SOURCE
      ) {
        counts.confirmations += 1;
      }
      if (t === WaveObservationType.CONFLICT_DETECTED) counts.conflicts += 1;
    }
    return counts;
  }

  async markObservationsSeen(ids: string[], userId: string) {
    if (ids.length === 0) return { updated: 0 };
    const now = new Date();
    const [updated] = await this.db.models.WaveEventObservation.update(
      { isSeenByEditor: true, seenAt: now },
      { where: { id: { [Op.in]: ids } } },
    );
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'waves.mark_seen',
      entityType: 'WaveEventObservation',
      entityId: ids[0] ?? null,
      before: null,
      after: { ids, count: updated },
      ip: null,
    });
    return { updated };
  }

  // ── Daily rundown ──────────────────────────────────────

  async getOrCreateToday(editorialDate?: string) {
    const date = editorialDate ?? editorialDateTehran();
    let rundown = await this.db.models.DailyRundown.findOne({
      where: { editorialDate: date },
    });
    if (!rundown) {
      rundown = await this.db.models.DailyRundown.create({
        id: randomUUID(),
        editorialDate: date,
        timezone: DAILY_RUNDOWN_POLICY.timezone,
        deadlineAt: deadlineAtForEditorialDate(date),
        status: DailyRundownStatus.COLLECTING,
        targetDurationSeconds: DAILY_RUNDOWN_POLICY.targetDurationSeconds,
        lockedAt: null,
        lockedBy: null,
        finalizedAt: null,
        reopenReason: null,
        metadata: null,
      });
    }
    return this.getRundownDetail(rundown.getDataValue('id'));
  }

  async getRundownDetail(rundownId: string) {
    const rundown = await this.db.models.DailyRundown.findByPk(rundownId, {
      include: [
        {
          association: 'items',
          include: [{ association: 'event' }],
          separate: true,
          order: [
            ['isPinned', 'DESC'],
            ['position', 'ASC'],
          ],
        },
      ],
    });
    if (!rundown) throw new NotFoundException('Rundown not found');

    const json = rundown.toJSON() as unknown as Record<string, unknown>;
    const items = ((json.items as Array<Record<string, unknown>>) ?? []).map((item) => item);
    const active = items.filter((i) =>
      ACTIVE_ITEM_STATUSES.includes(i.status as RundownItemStatus),
    );
    const coverage = summarizeCoverage(
      active.map((i) => {
        const event = i.event as
          | { scope?: string | null; category?: string | null }
          | undefined;
        return {
          scope: event?.scope ?? null,
          category: event?.category ?? null,
          section: String(i.section ?? RundownSection.MAIN),
          estimatedDurationSeconds: Number(i.estimatedDurationSeconds ?? 60),
          isLeadStory: Boolean(i.isLeadStory),
        };
      }),
    );

    return {
      ...json,
      id: rundown.getDataValue('id'),
      editorialDate: rundown.getDataValue('editorialDate'),
      status: rundown.getDataValue('status'),
      deadlineAt: rundown.getDataValue('deadlineAt'),
      items,
      coverage,
      activeItemCount: active.length,
    } as Record<string, unknown> & {
      id: string;
      editorialDate: string;
      status: string;
      deadlineAt: Date;
      items: Array<Record<string, unknown>>;
      coverage: ReturnType<typeof summarizeCoverage>;
      activeItemCount: number;
    };
  }

  private assertEditable(status: string) {
    if (
      status === DailyRundownStatus.LOCKED ||
      status === DailyRundownStatus.SCRIPT_GENERATING ||
      status === DailyRundownStatus.SCRIPT_READY ||
      status === DailyRundownStatus.FINALIZED
    ) {
      throw new BadRequestException(
        'Rundown is locked. Reopen with a reason to edit.',
      );
    }
  }

  async addItem(
    eventId: string,
    userId: string,
    opts?: { section?: string; editorialDate?: string },
  ) {
    const detail = await this.getOrCreateToday(opts?.editorialDate);
    const rundownId = detail.id as string;
    this.assertEditable(String(detail.status));

    const event = await this.db.models.NewsEvent.findByPk(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.db.models.DailyRundownItem.findOne({
      where: { rundownId, newsEventId: eventId },
    });
    if (existing) {
      if (existing.getDataValue('status') === RundownItemStatus.REMOVED) {
        const section =
          opts?.section ??
          suggestSection(event.getDataValue('effectiveFinalScore'));
        await existing.update({
          status: RundownItemStatus.SHORTLISTED,
          section,
          estimatedDurationSeconds: estimateDurationSeconds(section),
          effectiveScore: event.getDataValue('effectiveFinalScore'),
          removedAt: null,
          removalReason: null,
          addedBy: userId,
          addedAt: new Date(),
        });
        return this.getRundownDetail(rundownId);
      }
      throw new BadRequestException('Event already in today rundown');
    }

    const score = event.getDataValue('effectiveFinalScore') ?? 0;
    if (score < DAILY_RUNDOWN_POLICY.scoreGates.skipBelow) {
      throw new BadRequestException(
        `Score ${score} below minimum (${DAILY_RUNDOWN_POLICY.scoreGates.skipBelow})`,
      );
    }

    const maxPos =
      ((await this.db.models.DailyRundownItem.max('position', {
        where: { rundownId },
      })) as number | null) ?? 0;

    const section =
      opts?.section ?? suggestSection(event.getDataValue('effectiveFinalScore'));
    const status =
      score >= DAILY_RUNDOWN_POLICY.scoreGates.shortlistMin &&
      (event.getDataValue('credibilityScore') ?? 0) >=
        DAILY_RUNDOWN_POLICY.scoreGates.shortlistCredibilityMin
        ? RundownItemStatus.SHORTLISTED
        : RundownItemStatus.CANDIDATE;

    await this.db.models.DailyRundownItem.create({
      id: randomUUID(),
      rundownId,
      newsEventId: eventId,
      status,
      section,
      editorialPriority: 50,
      effectiveScore: event.getDataValue('effectiveFinalScore'),
      estimatedDurationSeconds: estimateDurationSeconds(section),
      position: maxPos + 1,
      addedBy: userId,
      addedAt: new Date(),
      removedAt: null,
      removalReason: null,
      isLeadStory: section === RundownSection.LEAD,
      isPinned: false,
      editorNote: null,
    });

    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'rundown.add_item',
      entityType: 'DailyRundown',
      entityId: rundownId,
      before: null,
      after: { eventId, status, section },
      ip: null,
    });

    return this.getRundownDetail(rundownId);
  }

  async updateItem(
    itemId: string,
    userId: string,
    patch: {
      status?: RundownItemStatus;
      section?: RundownSection;
      position?: number;
      isPinned?: boolean;
      isLeadStory?: boolean;
      editorialPriority?: number;
      editorNote?: string;
      estimatedDurationSeconds?: number;
    },
  ) {
    const item = await this.db.models.DailyRundownItem.findByPk(itemId);
    if (!item) throw new NotFoundException('Rundown item not found');
    const rundown = await this.db.models.DailyRundown.findByPk(
      item.getDataValue('rundownId'),
    );
    if (!rundown) throw new NotFoundException('Rundown not found');
    this.assertEditable(rundown.getDataValue('status'));

    const updates: Record<string, unknown> = {};
    if (patch.status) updates.status = patch.status;
    if (patch.section) {
      updates.section = patch.section;
      if (patch.estimatedDurationSeconds == null) {
        updates.estimatedDurationSeconds = estimateDurationSeconds(patch.section);
      }
    }
    if (patch.position != null) updates.position = patch.position;
    if (patch.isPinned != null) updates.isPinned = patch.isPinned;
    if (patch.isLeadStory != null) {
      updates.isLeadStory = patch.isLeadStory;
      if (patch.isLeadStory) updates.section = RundownSection.LEAD;
    }
    if (patch.editorialPriority != null) {
      updates.editorialPriority = patch.editorialPriority;
    }
    if (patch.editorNote != null) updates.editorNote = patch.editorNote;
    if (patch.estimatedDurationSeconds != null) {
      updates.estimatedDurationSeconds = patch.estimatedDurationSeconds;
    }

    if (patch.isLeadStory) {
      await this.db.models.DailyRundownItem.update(
        { isLeadStory: false },
        {
          where: {
            rundownId: item.getDataValue('rundownId'),
            id: { [Op.ne]: itemId },
          },
        },
      );
    }

    const before = item.toJSON();
    await item.update(updates);
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'rundown.update_item',
      entityType: 'DailyRundownItem',
      entityId: itemId,
      before,
      after: item.toJSON(),
      ip: null,
    });
    return this.getRundownDetail(item.getDataValue('rundownId'));
  }

  async removeItem(itemId: string, userId: string, reason?: string) {
    const item = await this.db.models.DailyRundownItem.findByPk(itemId);
    if (!item) throw new NotFoundException('Rundown item not found');
    const rundown = await this.db.models.DailyRundown.findByPk(
      item.getDataValue('rundownId'),
    );
    if (!rundown) throw new NotFoundException('Rundown not found');
    this.assertEditable(rundown.getDataValue('status'));

    await item.update({
      status: RundownItemStatus.REMOVED,
      removedAt: new Date(),
      removalReason: reason?.trim() || 'removed_by_editor',
    });
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'rundown.remove_item',
      entityType: 'DailyRundownItem',
      entityId: itemId,
      before: null,
      after: { reason: reason ?? null },
      ip: null,
    });
    return this.getRundownDetail(item.getDataValue('rundownId'));
  }

  async lockToday(userId: string, editorialDate?: string) {
    const detail = await this.getOrCreateToday(editorialDate);
    const rundown = await this.db.models.DailyRundown.findByPk(detail.id as string);
    if (!rundown) throw new NotFoundException('Rundown not found');
    if (rundown.getDataValue('status') === DailyRundownStatus.LOCKED) {
      return this.getRundownDetail(rundown.getDataValue('id'));
    }

    const items = await this.db.models.DailyRundownItem.findAll({
      where: {
        rundownId: rundown.getDataValue('id'),
        status: { [Op.in]: ACTIVE_ITEM_STATUSES },
      },
    });
    if (items.length === 0) {
      throw new BadRequestException('Cannot lock an empty rundown');
    }

    await this.db.models.DailyRundownItem.update(
      { status: RundownItemStatus.FINAL_SELECTED },
      {
        where: {
          rundownId: rundown.getDataValue('id'),
          status: {
            [Op.in]: [
              RundownItemStatus.SHORTLISTED,
              RundownItemStatus.CANDIDATE,
              RundownItemStatus.RESERVED,
            ],
          },
        },
      },
    );

    await rundown.update({
      status: DailyRundownStatus.LOCKED,
      lockedAt: new Date(),
      lockedBy: userId,
    });
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'rundown.lock',
      entityType: 'DailyRundown',
      entityId: rundown.getDataValue('id'),
      before: { status: detail.status },
      after: { status: DailyRundownStatus.LOCKED, itemCount: items.length },
      ip: null,
    });
    return this.getRundownDetail(rundown.getDataValue('id'));
  }

  async reopenToday(userId: string, reason: string, editorialDate?: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Reopen reason is required');
    }
    const detail = await this.getOrCreateToday(editorialDate);
    const rundown = await this.db.models.DailyRundown.findByPk(detail.id as string);
    if (!rundown) throw new NotFoundException('Rundown not found');

    await rundown.update({
      status: DailyRundownStatus.REOPENED,
      lockedAt: null,
      lockedBy: null,
      reopenReason: reason.trim(),
    });
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId: userId,
      action: 'rundown.reopen',
      entityType: 'DailyRundown',
      entityId: rundown.getDataValue('id'),
      before: { status: detail.status },
      after: { status: DailyRundownStatus.REOPENED, reason: reason.trim() },
      ip: null,
    });
    return this.getRundownDetail(rundown.getDataValue('id'));
  }

  async replaceSuggestions(eventId: string, editorialDate?: string) {
    const detail = await this.getOrCreateToday(editorialDate);
    const event = await this.db.models.NewsEvent.findByPk(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const coverage = detail.coverage as ReturnType<typeof summarizeCoverage>;
    const need = coverageNeedForScope(event.getDataValue('scope'), coverage);
    const newUtility = selectionUtility({
      finalScore: event.getDataValue('effectiveFinalScore') ?? 0,
      freshnessScore: event.getDataValue('freshnessScore') ?? 50,
      audienceRelevance: 60,
      developmentStrength: 55,
      coverageNeed: need,
    });

    const items = ((detail.items as Array<Record<string, unknown>>) ?? []).filter(
      (i) =>
        ACTIVE_ITEM_STATUSES.includes(i.status as RundownItemStatus) &&
        !i.isPinned,
    );

    type Cand = {
      itemId: string;
      eventId: string;
      title: string;
      utility: number;
      utilityGain: number;
      reasons: string[];
    };
    const candidates: Cand[] = [];

    for (const item of items) {
      const ev = item.event as
        | {
            id?: string;
            title?: string;
            scope?: string | null;
            effectiveFinalScore?: number | null;
            freshnessScore?: number | null;
          }
        | undefined;
      if (!ev?.id) continue;
      const oldUtility = selectionUtility({
        finalScore: ev.effectiveFinalScore ?? Number(item.effectiveScore ?? 0),
        freshnessScore: ev.freshnessScore ?? 40,
        coverageNeed: coverageNeedForScope(ev.scope ?? null, coverage),
        redundancyPenalty:
          ev.scope && ev.scope === event.getDataValue('scope') ? 8 : 0,
      });
      const gain = newUtility - oldUtility;
      if (gain < 5) continue;
      const reasons: string[] = [];
      if (
        (event.getDataValue('effectiveFinalScore') ?? 0) >
        (ev.effectiveFinalScore ?? 0) + 10
      ) {
        reasons.push('امتیاز نهایی بالاتر است');
      }
      if (need >= 70) reasons.push('پوشش این حوزه زیر هدف است');
      if (
        event.getDataValue('officialStatus') === 'OFFICIAL' ||
        event.getDataValue('officialStatus') === 'CONFIRMED'
      ) {
        reasons.push('خبر جدید رسمی/تأییدشده است');
      }
      if (reasons.length === 0) reasons.push(`سود utility حدود ${gain.toFixed(1)}`);
      candidates.push({
        itemId: String(item.id),
        eventId: ev.id,
        title: ev.title ?? 'بدون عنوان',
        utility: oldUtility,
        utilityGain: Math.round(gain * 10) / 10,
        reasons,
      });
    }

    candidates.sort((a, b) => b.utilityGain - a.utilityGain);

    return {
      recommendation:
        candidates.length === 0
          ? 'ADD'
          : candidates[0].utilityGain >= 10
            ? 'REPLACE'
            : 'HOLD',
      newEventId: eventId,
      newUtility,
      replaceCandidates: candidates.slice(0, 5),
    };
  }

  async applyReplace(
    newEventId: string,
    replaceItemId: string,
    userId: string,
    editorialDate?: string,
  ) {
    const detail = await this.getOrCreateToday(editorialDate);
    this.assertEditable(String(detail.status));
    await this.removeItem(
      replaceItemId,
      userId,
      `replaced_by_${newEventId}`,
    );
    return this.addItem(newEventId, userId, { editorialDate });
  }

  /** Replace by newsEventId (resolves active rundown item). */
  async applyReplaceByEventId(
    newEventId: string,
    replaceEventId: string,
    userId: string,
    editorialDate?: string,
  ) {
    const detail = await this.getOrCreateToday(editorialDate);
    const items = (detail.items as Array<Record<string, unknown>>) ?? [];
    const item = items.find(
      (i) =>
        String(i.newsEventId) === replaceEventId &&
        ACTIVE_ITEM_STATUSES.includes(i.status as RundownItemStatus),
    );
    if (!item) {
      throw new BadRequestException('Replace target is not in today rundown');
    }
    return this.applyReplace(newEventId, String(item.id), userId, editorialDate);
  }

  /** Event IDs already on today's active rundown — for UI badges */
  async todayEventIds(editorialDate?: string) {
    const detail = await this.getOrCreateToday(editorialDate);
    const items = (detail.items as Array<Record<string, unknown>>) ?? [];
    return {
      editorialDate: detail.editorialDate,
      eventIds: items
        .filter((i) => ACTIVE_ITEM_STATUSES.includes(i.status as RundownItemStatus))
        .map((i) => String(i.newsEventId)),
      status: detail.status,
      deadlineAt: detail.deadlineAt,
      coverage: detail.coverage,
    };
  }
}
