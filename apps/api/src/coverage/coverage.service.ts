import { Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import type { Database } from '@footcast/database';
import {
  RundownItemStatus,
  WaveObservationType,
  buildCoverageReport,
  editorialDateTehran,
  type CoverageEventRow,
  type CoverageReport,
} from '@footcast/shared';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import { backfillTaxonomyForDay } from './taxonomy-tagger.js';

const ACTIVE_ITEM = [
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
];

@Injectable()
export class CoverageService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async coverageForEditorialDate(
    editorialDate?: string,
    opts?: { backfill?: boolean },
  ): Promise<CoverageReport & { untaggedEventCount: number; backfilled: number }> {
    const date = editorialDate ?? editorialDateTehran();
    // Tehran editorial day window via noon probe ±12h around deadline helper at 00:00/23:59
    const dayStart = new Date(`${date}T00:00:00+03:30`);
    const dayEnd = new Date(`${date}T23:59:59.999+03:30`);

    const waves = await this.db.models.IntakeWave.findAll({
      where: { editorialDate: date },
      attributes: ['id'],
    });
    const waveIds = waves.map((w) => w.getDataValue('id'));

    let discoveredIds = new Set<string>();
    if (waveIds.length > 0) {
      const obs = await this.db.models.WaveEventObservation.findAll({
        where: {
          waveId: { [Op.in]: waveIds },
          observationType: { [Op.in]: MEANINGFUL_OBS },
        },
        attributes: ['newsEventId'],
      });
      for (const o of obs) discoveredIds.add(o.getDataValue('newsEventId'));
    }

    // Also include events first/last seen on editorial day (UTC window approx Tehran day)
    const seenToday = await this.db.models.NewsEvent.findAll({
      where: {
        [Op.or]: [
          { firstSeenAt: { [Op.between]: [dayStart, dayEnd] } },
          { lastSeenAt: { [Op.between]: [dayStart, dayEnd] } },
        ],
      },
      attributes: ['id'],
    });
    for (const e of seenToday) discoveredIds.add(e.getDataValue('id'));

    const ids = [...discoveredIds];
    let backfilled = 0;
    if (opts?.backfill !== false && ids.length > 0) {
      backfilled = await backfillTaxonomyForDay(this.db, ids.slice(0, 300));
    }

    const rundown = await this.db.models.DailyRundown.findOne({
      where: { editorialDate: date },
    });
    let selectedIds: string[] = [];
    const selectedDurations: Record<string, number> = {};
    if (rundown) {
      const items = await this.db.models.DailyRundownItem.findAll({
        where: {
          rundownId: rundown.getDataValue('id'),
          status: { [Op.in]: ACTIVE_ITEM },
        },
      });
      selectedIds = items.map((i) => i.getDataValue('newsEventId'));
      for (const i of items) {
        selectedDurations[i.getDataValue('newsEventId')] =
          i.getDataValue('estimatedDurationSeconds');
      }
      for (const id of selectedIds) discoveredIds.add(id);
    }

    const allIds = [...discoveredIds];
    const events = allIds.length
      ? await this.db.models.NewsEvent.findAll({
          where: { id: { [Op.in]: allIds } },
          include: [
            { association: 'teams', attributes: ['slug', 'nameFa'], through: { attributes: [] } },
            {
              association: 'competitions',
              attributes: ['slug', 'nameFa'],
              through: { attributes: [] },
            },
            {
              association: 'trackedEvents',
              attributes: ['slug', 'title'],
              through: { attributes: [] },
            },
          ],
        })
      : [];

    let untagged = 0;
    const rows: CoverageEventRow[] = events.map((ev) => {
      const teams =
        ((ev as unknown as { teams?: Array<{ getDataValue: (k: string) => string }> })
          .teams ?? []);
      const competitions =
        ((ev as unknown as {
          competitions?: Array<{ getDataValue: (k: string) => string }>;
        }).competitions ?? []);
      const tracked =
        ((ev as unknown as {
          trackedEvents?: Array<{ getDataValue: (k: string) => string }>;
        }).trackedEvents ?? []);
      const teamKeys = teams.map((t) => t.getDataValue('slug'));
      const competitionKeys = competitions.map((c) => c.getDataValue('slug'));
      const trackedEventKeys = tracked.map((t) => t.getDataValue('slug'));
      if (
        teamKeys.length === 0 &&
        competitionKeys.length === 0 &&
        trackedEventKeys.length === 0
      ) {
        untagged += 1;
      }
      return {
        id: ev.getDataValue('id'),
        scope: ev.getDataValue('scope'),
        category: ev.getDataValue('category'),
        finalScore: ev.getDataValue('effectiveFinalScore'),
        credibilityScore: ev.getDataValue('credibilityScore'),
        freshnessScore: ev.getDataValue('freshnessScore'),
        status: ev.getDataValue('status'),
        teamKeys,
        competitionKeys,
        trackedEventKeys,
        title: ev.getDataValue('title'),
        estimatedDurationSeconds: selectedDurations[ev.getDataValue('id')],
      };
    });

    const [teamRows, compRows, trackedRows, targets] = await Promise.all([
      this.db.models.EditorialTeam.findAll({ where: { isActive: true } }),
      this.db.models.Competition.findAll({ where: { isActive: true } }),
      this.db.models.TrackedEvent.findAll({ where: { isActive: true } }),
      this.db.models.CoverageTarget.findAll({ where: { isActive: true } }),
    ]);

    const report = buildCoverageReport({
      editorialDate: date,
      events: rows,
      selectedEventIds: selectedIds,
      selectedDurations,
      targetDurationSeconds: rundown?.getDataValue('targetDurationSeconds'),
      targets: targets.map((t) => ({
        dimension: t.getDataValue('dimension'),
        key: t.getDataValue('key'),
        label: t.getDataValue('label'),
        minSelectedCount: t.getDataValue('minSelectedCount'),
        maxSelectedCount: t.getDataValue('maxSelectedCount'),
        minDurationSeconds: t.getDataValue('minDurationSeconds'),
        maxDurationSeconds: t.getDataValue('maxDurationSeconds'),
        priority: t.getDataValue('priority'),
        enforcement: t.getDataValue('enforcement'),
      })),
      labels: {
        teams: Object.fromEntries(
          teamRows.map((t) => [t.getDataValue('slug'), t.getDataValue('nameFa')]),
        ),
        competitions: Object.fromEntries(
          compRows.map((c) => [c.getDataValue('slug'), c.getDataValue('nameFa')]),
        ),
        trackedEvents: Object.fromEntries(
          trackedRows.map((t) => [t.getDataValue('slug'), t.getDataValue('title')]),
        ),
        scopes: { IRAN: 'فوتبال ایران', EUROPE: 'فوتبال اروپا', OTHER: 'سایر' },
        categories: {
          TRANSFER: 'نقل‌وانتقالات',
          MATCH_RESULT: 'نتایج',
          INJURY: 'مصدومیت',
          COACH_CHANGE: 'مربیان',
          MANAGEMENT: 'مدیریتی',
          CONTRACT: 'قرارداد',
        },
      },
    });

    return { ...report, untaggedEventCount: untagged, backfilled };
  }

  async coverageForRundown(rundownId: string) {
    const rundown = await this.db.models.DailyRundown.findByPk(rundownId);
    if (!rundown) {
      return this.coverageForEditorialDate();
    }
    return this.coverageForEditorialDate(rundown.getDataValue('editorialDate'));
  }
}
