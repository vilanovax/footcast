import {
  MVP_SCORING_POLICY,
  clampScore,
  combineSourceCredibility,
  independentSourceScore,
  officialStatusScore,
  recommendationFromScores,
  roundScore,
  type EditorialRecommendation,
  type ScoreAdjustment,
} from '@footcast/shared';
import { OfficialStatus } from '@footcast/shared';
import { listEnabledRules } from './default-rules.js';

export interface EventScoreInput {
  title: string;
  summary?: string | null;
  scope?: string | null;
  category?: string | null;
  officialStatus?: string | null;
  /** AI hint — not final importance */
  aiImportanceHint?: number | null;
  aiCredibilityHint?: number | null;
  freshnessScore?: number | null;
  /** Unique source credibility seeds (independent sources) */
  sourceCredibilitySeeds?: number[];
  sourceTypes?: string[];
  independentSourceCount?: number;
  clubs?: string[];
  people?: string[];
  hasOpenConflict?: boolean;
  isDuplicateHeavy?: boolean;
  hasDirectQuote?: boolean;
  isAdvertisement?: boolean;
  isClickbait?: boolean;
  isNewDevelopment?: boolean;
  /** hours since lastSeen / published */
  ageHours?: number | null;
}

export interface EventScoreResult {
  credibilityScore: number;
  importanceScore: number;
  podcastValueScore: number;
  rawFinalScore: number;
  finalScore: number;
  totalBonus: number;
  totalPenalty: number;
  recommendation: EditorialRecommendation;
  bonuses: ScoreAdjustment[];
  penalties: ScoreAdjustment[];
  reasons: string[];
  ruleHits: string[];
  breakdown: Record<string, number | string | boolean>;
  /** @deprecated use structured scores; kept for older UI expecting factors */
  factors: Record<string, number>;
  policyVersion: string;
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

function looksAdvertisement(text: string): boolean {
  return /اسپانسر|کد تخفیف|خرید بلیت با|advertorial|sponsored/i.test(text);
}

function freshnessFromAge(ageHours?: number | null, fallback?: number | null): number {
  if (fallback != null && Number.isFinite(fallback)) return clampScore(fallback);
  if (ageHours == null || !Number.isFinite(ageHours)) return 70;
  if (ageHours < 1) return 100;
  if (ageHours < 3) return 95;
  if (ageHours < 6) return 90;
  if (ageHours < 12) return 80;
  if (ageHours < 24) return 70;
  if (ageHours < 48) return 50;
  if (ageHours < 72) return 30;
  return 10;
}

function weighted(
  parts: Record<string, number>,
  weights: Record<string, number>,
): number {
  let sum = 0;
  for (const [key, w] of Object.entries(weights)) {
    sum += clampScore(parts[key] ?? 50) * w;
  }
  return roundScore(sum);
}

/** Hybrid MVP scorer — features from AI/DB, math in backend. */
export function scoreNewsEvent(input: EventScoreInput): EventScoreResult {
  const text = `${input.title} ${input.summary ?? ''}`;
  const clubs = input.clubs ?? [];
  const enabled = new Set(listEnabledRules().map((r) => r.code));
  const ruleHits: string[] = [];
  const reasons: string[] = [];
  const bonuses: ScoreAdjustment[] = [];
  const penalties: ScoreAdjustment[] = [];

  const bigIran = mentionsBigIranClubs(text, clubs);
  const national = mentionsNationalTeam(text);
  const clickbait = input.isClickbait ?? looksClickbait(input.title);
  const advertisement = input.isAdvertisement ?? looksAdvertisement(text);
  const independentCount = Math.max(1, input.independentSourceCount ?? 1);
  const official = input.officialStatus === OfficialStatus.OFFICIAL;
  const rumor =
    input.officialStatus === OfficialStatus.RUMOR ||
    input.officialStatus === OfficialStatus.UNVERIFIED;
  const multiSource = independentCount >= 2;
  const seeds = input.sourceCredibilitySeeds?.length
    ? input.sourceCredibilitySeeds
    : [input.aiCredibilityHint ?? 50];
  const hasOfficialSource = (input.sourceTypes ?? []).some((t) =>
    /OFFICIAL_CLUB|OFFICIAL_LEAGUE|OFFICIAL_FEDERATION/.test(t),
  );

  // --- Credibility factors ---
  let sourceCredibility = combineSourceCredibility(seeds, { hasOfficialSource });
  let independentScore = independentSourceScore(independentCount);
  if (official) {
    independentScore = Math.max(independentScore, 80);
    reasons.push('خبر رسمی تک‌منبعی جریمه نشد');
  }
  const officialScore = officialStatusScore(input.officialStatus);
  const evidenceQuality = clampScore(
    40 +
      (input.hasDirectQuote ? 25 : 0) +
      (official ? 20 : 0) +
      (multiSource ? 15 : 0),
  );
  const sourceAgreement = input.hasOpenConflict
    ? 25
    : multiSource
      ? 85
      : official
        ? 80
        : 55;

  const credibilityScore = weighted(
    {
      sourceCredibility,
      officialStatus: officialScore,
      independentSources: independentScore,
      evidenceQuality,
      sourceAgreement,
    },
    MVP_SCORING_POLICY.credibility,
  );

  // --- Importance factors ---
  const freshness = freshnessFromAge(input.ageHours, input.freshnessScore);
  const sportingImpact = clampScore(
    (input.aiImportanceHint ?? 50) * 0.55 +
      (input.category === 'TRANSFER' || input.category === 'COACH_CHANGE' ? 25 : 0) +
      (input.category === 'MATCH_RESULT' ? 15 : 0) +
      (input.category === 'INJURY' ? 12 : 0),
  );
  const teamOrPlayerImportance = clampScore(
    40 + (bigIran ? 35 : 0) + (national ? 30 : 0) + Math.min(20, clubs.length * 8),
  );
  const audienceRelevance = clampScore(
    (input.scope === 'iran' ? 85 : input.scope === 'europe' ? 70 : 45) +
      (bigIran || national ? 15 : 0),
  );
  const nationalOrInternationalImpact = clampScore(
    (input.scope === 'iran' ? 60 : 40) + (national ? 30 : 0) + (input.scope === 'europe' ? 20 : 0),
  );
  const novelty = clampScore(
    (input.isNewDevelopment === false ? 35 : 70) + (multiSource ? 10 : 0),
  );

  const importanceScore = weighted(
    {
      sportingImpact,
      teamOrPlayerImportance,
      audienceRelevance,
      freshness,
      nationalOrInternationalImpact,
      novelty,
    },
    MVP_SCORING_POLICY.importance,
  );

  // --- Podcast value (MVP heuristics) ---
  const listenerAppeal = clampScore(
    45 +
      (bigIran || national ? 25 : 0) +
      (input.category === 'TRANSFER' ? 15 : 0) +
      (input.category === 'COACH_CHANGE' ? 12 : 0) -
      (clickbait ? 20 : 0),
  );
  const narrativeValue = clampScore(
    50 +
      (input.category === 'TRANSFER' || input.category === 'COACH_CHANGE' ? 20 : 0) +
      (input.hasDirectQuote ? 10 : 0),
  );
  const explainability = clampScore(55 + (official ? 15 : 0) + (multiSource ? 10 : 0));
  const newDevelopment = clampScore(
    input.isNewDevelopment === false ? 30 : freshness > 70 ? 80 : 55,
  );
  const episodeFit = clampScore(
    50 + (importanceScore > 70 ? 20 : 0) - (advertisement ? 40 : 0),
  );

  const podcastValueScore = weighted(
    {
      listenerAppeal,
      narrativeValue,
      explainability,
      newDevelopment,
      episodeFit,
    },
    MVP_SCORING_POLICY.podcastValue,
  );

  // --- Bonuses ---
  if (official && freshness >= 90) {
    bonuses.push({
      code: 'OFFICIAL_BREAKING',
      value: 10,
      reason: 'خبر رسمی و بسیار تازه',
    });
  }
  if (independentCount >= 3) {
    bonuses.push({
      code: 'MULTI_SOURCE_CONFIRMATION',
      value: 5,
      reason: 'تأیید توسط چند منبع مستقل',
    });
  }
  if (input.isNewDevelopment && freshness >= 80) {
    bonuses.push({
      code: 'MAJOR_NEW_DEVELOPMENT',
      value: 5,
      reason: 'تحول تازه نسبت به خبر قبلی',
    });
  }
  if (national && enabled.has('national_team_priority')) {
    bonuses.push({
      code: 'NATIONAL_TEAM_IRAN',
      value: 5,
      reason: 'مرتبط با تیم ملی ایران',
    });
    ruleHits.push('national_team_priority');
  }
  if (input.hasDirectQuote) {
    bonuses.push({
      code: 'DIRECT_IMPORTANT_QUOTE',
      value: 3,
      reason: 'نقل‌قول مستقیم مهم',
    });
  }
  if (bigIran && enabled.has('esteghlal_persepolis_weight')) {
    ruleHits.push('esteghlal_persepolis_weight');
  }
  if (official && input.category === 'TRANSFER' && enabled.has('official_transfer_priority')) {
    ruleHits.push('official_transfer_priority');
  }

  // --- Penalties ---
  if (input.isDuplicateHeavy && enabled.has('duplicate_only_on_update')) {
    penalties.push({
      code: 'LOW_VALUE_DUPLICATE',
      value: 25,
      reason: 'نسخه کم‌ارزش‌تر یا اشباع بازنشر',
    });
    ruleHits.push('duplicate_only_on_update');
  }
  if (freshness < 35 && enabled.has('drop_stale_without_update')) {
    penalties.push({
      code: 'OLD_WITHOUT_NEW_DEVELOPMENT',
      value: 20,
      reason: 'خبر قدیمی بدون تحول جدید',
    });
    ruleHits.push('drop_stale_without_update');
  }
  if (clickbait && enabled.has('drop_clickbait')) {
    penalties.push({
      code: 'CLICKBAIT',
      value: 15,
      reason: 'تیتر کلیک‌خور',
    });
    ruleHits.push('drop_clickbait');
  }
  if (rumor && !multiSource && !official && enabled.has('block_single_source_rumor')) {
    penalties.push({
      code: 'SINGLE_SOURCE_RUMOR',
      value: 20,
      reason: 'شایعه تک‌منبعی',
    });
    ruleHits.push('block_single_source_rumor');
  }
  if (input.hasOpenConflict && enabled.has('conflict_to_human')) {
    penalties.push({
      code: 'MAJOR_SOURCE_CONFLICT',
      value: 15,
      reason: 'تناقض جدی بین منابع',
    });
    ruleHits.push('conflict_to_human');
  }
  if (advertisement) {
    penalties.push({
      code: 'ADVERTISEMENT',
      value: 30,
      reason: 'محتوای تبلیغاتی',
    });
  }
  if (!input.summary || input.summary.trim().length < 20) {
    penalties.push({
      code: 'NO_CLEAR_CLAIM',
      value: 10,
      reason: 'ادعای مشخص یا خلاصه کافی نیست',
    });
  }

  const totalBonus = bonuses.reduce((s, b) => s + b.value, 0);
  const totalPenalty = penalties.reduce((s, p) => s + p.value, 0);

  const fw = MVP_SCORING_POLICY.final;
  const rawFinalScore = roundScore(
    importanceScore * fw.importance +
      credibilityScore * fw.credibility +
      podcastValueScore * fw.podcastValue,
  );
  const finalScore = roundScore(rawFinalScore + totalBonus - totalPenalty);

  const recommendation = recommendationFromScores({
    finalScore,
    credibilityScore,
    officialStatus: input.officialStatus,
    category: input.category,
  });

  reasons.push(
    `اعتبار ${credibilityScore} · اهمیت ${importanceScore} · پادکست ${podcastValueScore}`,
  );

  const breakdown = {
    sourceCredibility: roundScore(sourceCredibility),
    officialStatus: officialScore,
    independentSources: independentScore,
    evidenceQuality: roundScore(evidenceQuality),
    sourceAgreement: roundScore(sourceAgreement),
    sportingImpact: roundScore(sportingImpact),
    teamOrPlayerImportance: roundScore(teamOrPlayerImportance),
    audienceRelevance: roundScore(audienceRelevance),
    freshness: roundScore(freshness),
    nationalOrInternationalImpact: roundScore(nationalOrInternationalImpact),
    novelty: roundScore(novelty),
    listenerAppeal: roundScore(listenerAppeal),
    narrativeValue: roundScore(narrativeValue),
    explainability: roundScore(explainability),
    newDevelopment: roundScore(newDevelopment),
    episodeFit: roundScore(episodeFit),
    independentCount,
    bigIran,
    national,
    clickbait,
    multiSource,
  };

  return {
    credibilityScore,
    importanceScore,
    podcastValueScore,
    rawFinalScore,
    finalScore,
    totalBonus,
    totalPenalty,
    recommendation,
    bonuses,
    penalties,
    reasons,
    ruleHits,
    breakdown,
    factors: {
      sportingImpact: roundScore(sportingImpact),
      teamOrPlayerImportance: roundScore(teamOrPlayerImportance),
      sourceCredibility: roundScore(sourceCredibility),
      freshness: roundScore(freshness),
      officialness: officialScore,
      nationalOrInternationalImpact: roundScore(nationalOrInternationalImpact),
      independentSourceCount: independentScore,
      podcastFitness: podcastValueScore,
    },
    policyVersion: MVP_SCORING_POLICY.version,
  };
}
