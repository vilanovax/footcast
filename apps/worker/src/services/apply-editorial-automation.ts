import { randomUUID } from 'node:crypto';
import { createAiProviderFromEnv, runAutoAddAiAudit } from '@footcast/ai';
import {
  applyAiAuditGate,
  evaluateAutomationPolicy,
  ruleAuditAutoAdd,
  type AutomationEventInput,
  type AutomationRundownContext,
} from '@footcast/editorial-automation';
import type { Database } from '@footcast/database';
import type { Logger } from '@footcast/logger';
import {
  CONTROL_SETTING_KEYS,
  DAILY_RUNDOWN_POLICY,
  DEFAULT_EDITORIAL_AUTOMATION,
  DailyRundownStatus,
  EventStatus,
  RundownItemAddedMode,
  RundownItemReviewStatus,
  RundownItemStatus,
  RundownSection,
  deadlineAtForEditorialDate,
  editorialDateTehran,
  estimateDurationSeconds,
  suggestSection,
  type EditorialAutomationConfig,
} from '@footcast/shared';
import { Op } from 'sequelize';

const ACTIVE_ITEM_STATUSES = [
  RundownItemStatus.CANDIDATE,
  RundownItemStatus.SHORTLISTED,
  RundownItemStatus.RESERVED,
  RundownItemStatus.FINAL_SELECTED,
];

const LOCKED_STATUSES = new Set<string>([
  DailyRundownStatus.LOCKED,
  DailyRundownStatus.SCRIPT_GENERATING,
  DailyRundownStatus.SCRIPT_READY,
  DailyRundownStatus.FINALIZED,
]);

async function loadAutomationConfig(
  db: Database,
): Promise<EditorialAutomationConfig> {
  const row = await db.models.AppSetting.findByPk(
    CONTROL_SETTING_KEYS.editorialAutomation,
  );
  if (!row) return { ...DEFAULT_EDITORIAL_AUTOMATION };
  const raw = row.getDataValue('value');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_EDITORIAL_AUTOMATION };
  }
  return {
    ...DEFAULT_EDITORIAL_AUTOMATION,
    ...(raw as Partial<EditorialAutomationConfig>),
  };
}

async function getOrCreateTodayRundown(db: Database) {
  const editorialDate = editorialDateTehran();
  let rundown = await db.models.DailyRundown.findOne({
    where: { editorialDate },
  });
  if (!rundown) {
    rundown = await db.models.DailyRundown.create({
      id: randomUUID(),
      editorialDate,
      timezone: DAILY_RUNDOWN_POLICY.timezone,
      deadlineAt: deadlineAtForEditorialDate(editorialDate),
      status: DailyRundownStatus.COLLECTING,
      targetDurationSeconds: DAILY_RUNDOWN_POLICY.targetDurationSeconds,
      lockedAt: null,
      lockedBy: null,
      finalizedAt: null,
      reopenReason: null,
      metadata: null,
    });
  }
  return rundown;
}

function minutesUntil(deadline: Date, now = new Date()): number {
  return Math.round((deadline.getTime() - now.getTime()) / 60_000);
}

function isNearDuplicateEvent(event: {
  getDataValue: (k: 'status' | 'metadata') => unknown;
}): boolean {
  const status = String(event.getDataValue('status') ?? '');
  if (status === EventStatus.MERGED) return true;
  const meta = (event.getDataValue('metadata') ?? {}) as Record<string, unknown>;
  if (meta.nearDuplicate === true || meta.exactDuplicate === true) return true;
  if (typeof meta.duplicateOfEventId === 'string') return true;
  return false;
}

/**
 * After scoring: evaluate automation policy, persist decisions,
 * optionally AUTO_ADD into today's rundown (SHORTLISTED + addedMode=AUTO).
 */
export async function applyEditorialAutomationAfterScore(
  db: Database,
  logger: Logger,
  eventId: string,
): Promise<void> {
  const config = await loadAutomationConfig(db);
  if (
    !config.autoHighlightImportant &&
    !config.autoSuggestForRundown &&
    !config.autoAddToRundown
  ) {
    return;
  }

  const event = await db.models.NewsEvent.findByPk(eventId, {
    include: [
      {
        association: 'articles',
        include: [{ association: 'article', include: [{ association: 'source' }] }],
      },
      { association: 'conflicts', where: { status: 'open' }, required: false },
      { association: 'teams', required: false },
      { association: 'competitions', required: false },
    ],
  });
  if (!event) return;

  const links =
    (
      event as unknown as {
        articles?: Array<{
          article?: {
            source?: { getDataValue: (k: string) => unknown };
          };
        }>;
      }
    ).articles ?? [];

  const sourceCreds: number[] = [];
  const sourceTypes: string[] = [];
  for (const link of links) {
    const src = link.article?.source;
    if (!src) continue;
    sourceCreds.push(Number(src.getDataValue('credibilitySeed') ?? 50));
    sourceTypes.push(String(src.getDataValue('sourceType') ?? ''));
  }

  const teams =
    (
      event as unknown as {
        teams?: Array<{ getDataValue: (k: string) => unknown }>;
      }
    ).teams ?? [];
  const competitions =
    (
      event as unknown as {
        competitions?: Array<{ getDataValue: (k: string) => unknown }>;
      }
    ).competitions ?? [];

  const openConflicts =
    (event as unknown as { conflicts?: unknown[] }).conflicts?.length ?? 0;

  const eventInput: AutomationEventInput = {
    newsEventId: eventId,
    status: String(event.getDataValue('status')),
    finalScore: event.getDataValue('effectiveFinalScore'),
    effectiveFinalScore: event.getDataValue('effectiveFinalScore'),
    credibilityScore: event.getDataValue('credibilityScore'),
    importanceScore: event.getDataValue('importanceScore'),
    podcastValueScore: event.getDataValue('podcastValueScore'),
    recommendation: event.getDataValue('recommendation'),
    officialStatus: event.getDataValue('officialStatus'),
    category: event.getDataValue('category'),
    independentSourceCount: Number(
      event.getDataValue('independentSourceCount') ?? sourceCreds.length,
    ),
    maxSourceCredibility:
      sourceCreds.length > 0 ? Math.max(...sourceCreds) : 0,
    sourceTypes,
    hasMajorConflict: openConflicts > 0,
    isExactOrNearDuplicate: isNearDuplicateEvent(event),
    teamKeys: teams.map((t) => String(t.getDataValue('slug') ?? t.getDataValue('id'))),
    competitionKeys: competitions.map((c) =>
      String(c.getDataValue('slug') ?? c.getDataValue('id')),
    ),
    estimatedDurationSeconds: estimateDurationSeconds(
      suggestSection(event.getDataValue('effectiveFinalScore')),
    ),
  };

  const rundown = await getOrCreateTodayRundown(db);
  const rundownId = rundown.getDataValue('id');
  const deadlineAt = rundown.getDataValue('deadlineAt') as Date;
  const rundownStatus = String(rundown.getDataValue('status'));

  const items = await db.models.DailyRundownItem.findAll({
    where: {
      rundownId,
      status: { [Op.in]: ACTIVE_ITEM_STATUSES },
    },
    include: [{ association: 'event', required: false }],
  });

  const teamCounts: Record<string, number> = {};
  const competitionCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  let durationSeconds = 0;
  const existingEventIds: string[] = [];
  let autoAddedCount = 0;
  const replaceCandidates: AutomationRundownContext['replaceCandidates'] = [];

  for (const item of items) {
    const eid = String(item.getDataValue('newsEventId'));
    existingEventIds.push(eid);
    durationSeconds += Number(item.getDataValue('estimatedDurationSeconds') ?? 60);
    if (item.getDataValue('addedMode') === RundownItemAddedMode.AUTO) {
      autoAddedCount += 1;
    }
    const ev = (
      item as unknown as {
        event?: { getDataValue: (k: string) => unknown };
      }
    ).event;
    const cat = ev ? String(ev.getDataValue('category') ?? '') : '';
    if (cat) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    replaceCandidates.push({
      newsEventId: eid,
      effectiveScore: item.getDataValue('effectiveScore'),
      teamKeys: [],
      category: cat || null,
    });
  }

  // Enrich team/competition counts from junction for active items (best-effort)
  if (existingEventIds.length > 0) {
    const teamLinks = await db.models.NewsEventTeam.findAll({
      where: { newsEventId: { [Op.in]: existingEventIds } },
    });
    const teamIds = teamLinks.map((l) => String(l.getDataValue('teamId')));
    if (teamIds.length > 0) {
      const teamRows = await db.models.EditorialTeam.findAll({
        where: { id: { [Op.in]: teamIds } },
      });
      const idToSlug = new Map(
        teamRows.map((t) => [
          String(t.getDataValue('id')),
          String(t.getDataValue('slug')),
        ]),
      );
      for (const link of teamLinks) {
        const slug = idToSlug.get(String(link.getDataValue('teamId')));
        if (!slug) continue;
        teamCounts[slug] = (teamCounts[slug] ?? 0) + 1;
      }
    }
    const compLinks = await db.models.NewsEventCompetition.findAll({
      where: { newsEventId: { [Op.in]: existingEventIds } },
    });
    const compIds = compLinks.map((l) => String(l.getDataValue('competitionId')));
    if (compIds.length > 0) {
      const compRows = await db.models.Competition.findAll({
        where: { id: { [Op.in]: compIds } },
      });
      const idToSlug = new Map(
        compRows.map((c) => [
          String(c.getDataValue('id')),
          String(c.getDataValue('slug')),
        ]),
      );
      for (const link of compLinks) {
        const slug = idToSlug.get(String(link.getDataValue('competitionId')));
        if (!slug) continue;
        competitionCounts[slug] = (competitionCounts[slug] ?? 0) + 1;
      }
    }
  }

  const priorAutoAdd = await db.models.EditorialAutomationDecision.findOne({
    where: {
      newsEventId: eventId,
      rundownId,
      decisionType: 'AUTO_ADD',
      executed: true,
    },
  });

  const rundownCtx: AutomationRundownContext = {
    rundownId,
    editorialDate: rundown.getDataValue('editorialDate'),
    locked: LOCKED_STATUSES.has(rundownStatus),
    minutesUntilLock: minutesUntil(deadlineAt),
    existingEventIds,
    autoAddedCount,
    teamCounts,
    competitionCounts,
    categoryCounts,
    durationSeconds,
    maxEpisodeDurationSeconds: DAILY_RUNDOWN_POLICY.targetDurationSeconds,
    replaceCandidates,
    priorAutoAddExecuted: Boolean(priorAutoAdd),
  };

  const result = evaluateAutomationPolicy({
    config,
    event: eventInput,
    rundown: rundownCtx,
  });

  if (result.decisions.length === 0) return;

  let autoAddDecisionId: string | null = null;
  const now = new Date();

  for (const draft of result.decisions) {
    const id = randomUUID();
    await db.models.EditorialAutomationDecision.create({
      id,
      newsEventId: eventId,
      rundownId,
      rundownItemId: null,
      decisionType: draft.decisionType,
      policyVersion: config.version,
      profileMode: config.profileMode,
      scoreSnapshot: draft.scoreSnapshot as unknown as Record<string, unknown>,
      coverageSnapshot: draft.coverageSnapshot as unknown as Record<
        string,
        unknown
      > | null,
      reasons: draft.reasons,
      blockedReasons: draft.blockedReasons,
      executed: false,
      executedAt: null,
      revertedAt: null,
      revertedBy: null,
      createdAt: now,
    });
    if (draft.decisionType === 'AUTO_ADD' && draft.shouldExecute) {
      autoAddDecisionId = id;
    }
  }

  // Store latest automation hint on event metadata for Inbox UI (phase 4+)
  const meta: Record<string, unknown> = {
    ...((event.getDataValue('metadata') ?? {}) as Record<string, unknown>),
    lastAutomation: {
      at: now.toISOString(),
      highlightBadge: result.highlight?.badge ?? null,
      suggestKind: result.suggest?.kind ?? null,
      autoAddAllowed: result.autoAdd?.allowed ?? false,
      autoAddBlocked: result.autoAdd?.blockedReasons ?? [],
      profileMode: config.profileMode,
    } as Record<string, unknown>,
  };
  await event.update({ metadata: meta });

  if (!autoAddDecisionId || !result.autoAdd?.allowed) {
    logger.info('Editorial automation evaluated', {
      eventId,
      decisions: result.decisions.map((d) => d.decisionType),
      highlight: result.highlight?.badge ?? null,
      suggest: result.suggest?.kind ?? null,
      autoAdd: false,
    });
    return;
  }

  // Rule / AI audit gate before execute
  if (config.requireRuleAuditOnAutoAdd) {
    const audit = ruleAuditAutoAdd(eventInput);
    if (audit.verdict === 'FAIL') {
      await db.models.EditorialAutomationDecision.update(
        {
          blockedReasons: [
            ...result.autoAdd.blockedReasons,
            ...audit.failReasons.map((r) => `rule_audit:${r}`),
          ],
          reasons: [
            ...result.autoAdd.reasons,
            'rule_audit_failed',
            ...audit.failReasons,
          ],
        },
        { where: { id: autoAddDecisionId } },
      );
      logger.info('AUTO_ADD blocked by rule audit', {
        eventId,
        failReasons: audit.failReasons,
      });
      return;
    }
    if (
      audit.verdict === 'NEEDS_AI_AUDIT' &&
      config.requireAiAuditOnSensitiveAutoAdd
    ) {
      const provider = createAiProviderFromEnv();
      const aiAudit = await runAutoAddAiAudit(provider, {
        newsEventId: eventId,
        title: String(event.getDataValue('title') ?? ''),
        summary: (event.getDataValue('summary') as string | null) ?? null,
        status: eventInput.status,
        officialStatus: eventInput.officialStatus,
        recommendation: eventInput.recommendation,
        category: eventInput.category,
        finalScore: eventInput.finalScore,
        effectiveFinalScore: eventInput.effectiveFinalScore,
        credibilityScore: eventInput.credibilityScore,
        independentSourceCount: eventInput.independentSourceCount,
        maxSourceCredibility: eventInput.maxSourceCredibility,
        sourceTypes: eventInput.sourceTypes,
        hasMajorConflict: eventInput.hasMajorConflict,
        isExactOrNearDuplicate: eventInput.isExactOrNearDuplicate,
        teamKeys: eventInput.teamKeys,
        ruleAuditNotes: audit.checks
          .filter((c) => !c.ok)
          .map((c) => c.code),
      });

      const gate = applyAiAuditGate({
        verdict: aiAudit.verdict,
        confidence: aiAudit.confidence,
        reasons: aiAudit.reasons,
        risks: aiAudit.risks,
        minConfidence: config.aiAuditMinConfidence ?? 0.62,
      });

      const scoreSnap = {
        finalScore: eventInput.finalScore,
        credibilityScore: eventInput.credibilityScore,
        importanceScore: eventInput.importanceScore,
        podcastValueScore: eventInput.podcastValueScore,
        recommendation: eventInput.recommendation,
        officialStatus: eventInput.officialStatus,
        independentSourceCount: eventInput.independentSourceCount,
        effectiveFinalScore: eventInput.effectiveFinalScore,
      } as unknown as Record<string, unknown>;

      await db.models.EditorialAutomationDecision.update(
        {
          blockedReasons: [
            ...result.autoAdd.blockedReasons,
            ...gate.blockedReasons,
          ],
          reasons: [
            ...result.autoAdd.reasons,
            'needs_ai_audit',
            `ai_verdict:${aiAudit.verdict}`,
            `ai_confidence:${aiAudit.confidence}`,
            `ai_provider:${aiAudit.provider}`,
            `ai_model:${aiAudit.model}`,
            ...gate.reasons,
          ],
        },
        { where: { id: autoAddDecisionId } },
      );

      const prevAuto =
        (meta.lastAutomation as Record<string, unknown> | undefined) ?? {};
      meta.lastAutomation = {
        ...prevAuto,
        aiAudit: {
          verdict: aiAudit.verdict,
          confidence: aiAudit.confidence,
          reasons: aiAudit.reasons,
          risks: aiAudit.risks,
          summaryFa: aiAudit.summaryFa ?? null,
          provider: aiAudit.provider,
          model: aiAudit.model,
          latencyMs: aiAudit.latencyMs,
          proceed: gate.proceed,
        },
      };
      await event.update({ metadata: meta });

      if (!gate.proceed) {
        await db.models.EditorialAutomationDecision.create({
          id: randomUUID(),
          newsEventId: eventId,
          rundownId,
          rundownItemId: null,
          decisionType: 'HOLD',
          policyVersion: config.version,
          profileMode: config.profileMode,
          scoreSnapshot: scoreSnap,
          coverageSnapshot: null,
          reasons: gate.reasons,
          blockedReasons: gate.blockedReasons,
          executed: false,
          executedAt: null,
          revertedAt: null,
          revertedBy: null,
          createdAt: now,
        });
        logger.info('AUTO_ADD blocked/held by AI audit', {
          eventId,
          verdict: aiAudit.verdict,
          confidence: aiAudit.confidence,
          fail: gate.fail,
          hold: gate.hold,
        });
        return;
      }

      logger.info('AUTO_ADD passed AI audit', {
        eventId,
        confidence: aiAudit.confidence,
        provider: aiAudit.provider,
      });
    }
  }

  // Execute AUTO_ADD
  const existingItem = await db.models.DailyRundownItem.findOne({
    where: { rundownId, newsEventId: eventId },
  });
  if (existingItem) {
    logger.info('AUTO_ADD skipped — already in rundown', { eventId, rundownId });
    return;
  }

  const score = Number(event.getDataValue('effectiveFinalScore') ?? 0);
  const section = suggestSection(score);
  const maxPos =
    ((await db.models.DailyRundownItem.max('position', {
      where: { rundownId },
    })) as number | null) ?? 0;

  const itemId = randomUUID();
  const reviewStatus = result.autoAdd.reviewStatus;
  await db.models.DailyRundownItem.create({
    id: itemId,
    rundownId,
    newsEventId: eventId,
    status: RundownItemStatus.SHORTLISTED,
    section,
    editorialPriority: 50,
    effectiveScore: event.getDataValue('effectiveFinalScore'),
    estimatedDurationSeconds: estimateDurationSeconds(section),
    position: maxPos + 1,
    addedBy: null,
    addedAt: now,
    removedAt: null,
    removalReason: null,
    isLeadStory: section === RundownSection.LEAD,
    isPinned: false,
    editorNote: null,
    addedMode: RundownItemAddedMode.AUTO,
    automationDecisionId: autoAddDecisionId,
    reviewStatus:
      reviewStatus === 'ACCEPTED'
        ? RundownItemReviewStatus.ACCEPTED
        : RundownItemReviewStatus.PENDING_REVIEW,
    reviewedBy: null,
    reviewedAt: null,
    automationReason: result.autoAdd.reasons.join('; '),
    scoreSnapshot: {
      finalScore: event.getDataValue('effectiveFinalScore'),
      credibilityScore: event.getDataValue('credibilityScore'),
      recommendation: event.getDataValue('recommendation'),
      officialStatus: event.getDataValue('officialStatus'),
    },
  });

  await db.models.EditorialAutomationDecision.update(
    {
      executed: true,
      executedAt: now,
      rundownItemId: itemId,
    },
    { where: { id: autoAddDecisionId } },
  );

  await db.models.AuditLog.create({
    id: randomUUID(),
    actorUserId: null,
    action: 'rundown.auto_add',
    entityType: 'DailyRundown',
    entityId: rundownId,
    before: null,
    after: {
      eventId,
      itemId,
      decisionId: autoAddDecisionId,
      reasons: result.autoAdd.reasons,
    },
    ip: null,
    createdAt: now,
  });

  logger.info('Editorial automation AUTO_ADD executed', {
    eventId,
    rundownId,
    itemId,
    section,
    reviewStatus,
  });
}
