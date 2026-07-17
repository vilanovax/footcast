import { OfficialStatus } from '@footcast/shared';
import {
  computeImportanceScore,
  type ImportanceFactors,
  type ImportancePenalties,
} from '@footcast/shared';
import { listEnabledRules } from './index.js';

export interface EventScoreInput {
  title: string;
  summary?: string | null;
  scope?: string | null;
  category?: string | null;
  officialStatus?: string | null;
  importanceScore?: number | null;
  credibilityScore?: number | null;
  freshnessScore?: number | null;
  articleCount?: number;
  clubs?: string[];
  people?: string[];
  hasOpenConflict?: boolean;
  isDuplicateHeavy?: boolean;
}

export interface EventScoreResult {
  finalScore: number;
  factors: ImportanceFactors;
  penalties: ImportancePenalties;
  ruleHits: string[];
  breakdown: Record<string, number | string | boolean>;
}

function officialnessFromStatus(status?: string | null): number {
  switch (status) {
    case OfficialStatus.OFFICIAL:
      return 95;
    case OfficialStatus.CONFIRMED:
      return 85;
    case OfficialStatus.RELIABLE_REPORT:
      return 70;
    case OfficialStatus.MULTI_SOURCE_REPORT:
      return 75;
    case OfficialStatus.UNVERIFIED:
      return 45;
    case OfficialStatus.RUMOR:
      return 25;
    case OfficialStatus.DISPUTED:
      return 20;
    case OfficialStatus.FALSE:
      return 5;
    default:
      return 40;
  }
}

function mentionsBigIranClubs(text: string, clubs: string[]): boolean {
  const hay = `${text} ${clubs.join(' ')}`.toLowerCase();
  return /استقلال|پرسپولیس|esteghlal|persepolis/.test(hay);
}

function mentionsNationalTeam(text: string): boolean {
  return /تیم ملی|national team|team melli/i.test(text);
}

function looksClickbait(title: string): boolean {
  return /!!!|شوک|باورنکردنی|فوری فوری|فقط با یک کلیک|you won't believe/i.test(title);
}

/** Rule-based editorial score for an event card (Phase 5). */
export function scoreNewsEvent(input: EventScoreInput): EventScoreResult {
  const text = `${input.title} ${input.summary ?? ''}`;
  const clubs = input.clubs ?? [];
  const enabled = new Set(listEnabledRules().map((r) => r.code));
  const ruleHits: string[] = [];

  const bigIran = mentionsBigIranClubs(text, clubs);
  const national = mentionsNationalTeam(text);
  const clickbait = looksClickbait(input.title);
  const multiSource = (input.articleCount ?? 1) >= 2;
  const rumor =
    input.officialStatus === OfficialStatus.RUMOR ||
    input.officialStatus === OfficialStatus.UNVERIFIED;

  const factors: ImportanceFactors = {
    sportingImpact: clamp(
      (input.importanceScore ?? 50) * 0.7 +
        (input.category === 'TRANSFER' || input.category === 'COACH_CHANGE' ? 20 : 0) +
        (input.category === 'MATCH_RESULT' ? 10 : 0),
    ),
    teamOrPlayerImportance: clamp(
      40 + (bigIran ? 30 : 0) + (national ? 25 : 0) + Math.min(20, clubs.length * 8),
    ),
    sourceCredibility: clamp(input.credibilityScore ?? 50),
    freshness: clamp(input.freshnessScore ?? 55),
    officialness: officialnessFromStatus(input.officialStatus),
    nationalOrInternationalImpact: clamp(
      (input.scope === 'iran' ? 55 : 35) + (national ? 30 : 0) + (input.scope === 'europe' ? 25 : 0),
    ),
    independentSourceCount: clamp(30 + ((input.articleCount ?? 1) - 1) * 25),
    podcastFitness: clamp(
      50 +
        (input.category === 'TRANSFER' ? 20 : 0) +
        (bigIran || national ? 15 : 0) -
        (clickbait ? 25 : 0),
    ),
  };

  const penalties: ImportancePenalties = {};
  if (input.isDuplicateHeavy && enabled.has('duplicate_only_on_update')) {
    penalties.duplicate = 25;
    ruleHits.push('duplicate_only_on_update');
  }
  if ((input.freshnessScore ?? 100) < 35 && enabled.has('drop_stale_without_update')) {
    penalties.stale = 20;
    ruleHits.push('drop_stale_without_update');
  }
  if (clickbait && enabled.has('drop_clickbait')) {
    penalties.clickbait = 20;
    ruleHits.push('drop_clickbait');
  }
  if (rumor && !multiSource && enabled.has('block_single_source_rumor')) {
    penalties.singleSourceRumor = 25;
    ruleHits.push('block_single_source_rumor');
  }
  if (bigIran && enabled.has('esteghlal_persepolis_weight')) {
    ruleHits.push('esteghlal_persepolis_weight');
  }
  if (national && enabled.has('national_team_priority')) {
    ruleHits.push('national_team_priority');
  }
  if (input.hasOpenConflict && enabled.has('conflict_to_human')) {
    ruleHits.push('conflict_to_human');
  }
  if (
    input.officialStatus === OfficialStatus.OFFICIAL &&
    enabled.has('official_transfer_priority') &&
    input.category === 'TRANSFER'
  ) {
    ruleHits.push('official_transfer_priority');
    factors.sportingImpact = clamp(factors.sportingImpact + 10);
    factors.officialness = clamp(factors.officialness + 5);
  }

  const finalScore = computeImportanceScore(factors, penalties);
  return {
    finalScore,
    factors,
    penalties,
    ruleHits,
    breakdown: {
      bigIran,
      national,
      clickbait,
      multiSource,
      articleCount: input.articleCount ?? 1,
      hasOpenConflict: Boolean(input.hasOpenConflict),
    },
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
