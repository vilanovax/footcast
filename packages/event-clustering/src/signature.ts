import { NewsCategory, type EventSignature } from '@footcast/shared';
import { normalizeForMatch } from './normalize.js';

function entityKey(item: unknown): string {
  if (typeof item === 'string') return normalizeForMatch(item);
  if (item && typeof item === 'object') {
    const o = item as { id?: unknown; name?: unknown };
    if (typeof o.id === 'string' && o.id.trim()) return normalizeForMatch(o.id);
    if (typeof o.name === 'string') return normalizeForMatch(o.name);
  }
  return '';
}

function namesFrom(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map(entityKey).filter(Boolean);
}

export function inferActionFromText(
  category: string | null | undefined,
  text: string,
): string | null {
  const t = text.toLowerCase();
  switch (category) {
    case NewsCategory.TRANSFER:
    case NewsCategory.CONTRACT:
      if (/رسمی|official|امضا|signed/.test(t)) return 'TRANSFER_OFFICIAL';
      if (/پیشنهاد|offer|bid/.test(t)) return 'OFFER_SUBMITTED';
      if (/توافق شخصی|personal terms/.test(t)) return 'PERSONAL_TERMS_AGREED';
      if (/مذاکر|negotiat|talks/.test(t)) return 'NEGOTIATION_STARTED';
      if (/علاقه|interest|linked/.test(t)) return 'INTEREST_REPORTED';
      if (/شایعه|rumou?r/.test(t)) return 'RUMOR_REPORTED';
      if (/لغو|collapse|off/.test(t)) return 'TRANSFER_COLLAPSED';
      return 'NEGOTIATION_STARTED';
    case NewsCategory.INJURY:
      if (/بازگشت به تمرین|returned to training/.test(t)) return 'RETURNED_TO_TRAINING';
      if (/تاریخ بازگشت|return date/.test(t)) return 'RETURN_DATE_REPORTED';
      if (/تشخیص|mri|scan|diagnosis/.test(t)) return 'DIAGNOSIS_UPDATED';
      if (/تأیید|confirmed/.test(t)) return 'INJURY_CONFIRMED';
      return 'INJURY_REPORTED';
    case NewsCategory.COACH_CHANGE:
      if (/منصوب|appointed|hired/.test(t)) return 'COACH_APPOINTED';
      if (/برکنار|اخراج|sacked|dismissed|fired/.test(t)) return 'COACH_DISMISSED';
      if (/مذاکر|negotiat/.test(t)) return 'COACH_NEGOTIATION';
      return 'COACH_UNDER_PRESSURE';
    case NewsCategory.MATCH_RESULT:
      return 'MATCH_RESULT';
    case NewsCategory.MATCH_PREVIEW:
      return 'MATCH_PREVIEW';
    case NewsCategory.DISCIPLINARY:
    case NewsCategory.SUSPENSION:
      if (/محروم|ban|sanction/.test(t)) return 'SANCTION_ANNOUNCED';
      return 'INCIDENT_REPORTED';
    default:
      return 'GENERIC_UPDATE';
  }
}

export function buildEventSignatureFromCard(card: Record<string, unknown>): EventSignature {
  const category = String(card.category ?? NewsCategory.OTHER);
  const headline = String(card.headlineFa ?? '');
  const summary = String(card.summaryFa ?? '');
  const text = `${headline} ${summary}`;
  const clubs = namesFrom(card.clubs);
  const people = namesFrom(card.people);
  const primary = [...people.slice(0, 2), ...clubs.slice(0, 2)].filter(Boolean);
  const secondary = [...clubs.slice(2), ...people.slice(2)].filter(Boolean);
  const league = card.league as { id?: string; name?: string } | null | undefined;
  const competitionId =
    (typeof league?.id === 'string' && league.id) ||
    (league?.name ? normalizeForMatch(league.name) : null);
  const action =
    (typeof card.action === 'string' && card.action) ||
    inferActionFromText(category, text);

  return {
    eventType: category,
    action,
    primaryEntities: primary.length > 0 ? primary : clubs.slice(0, 2),
    secondaryEntities: secondary,
    competitionId,
    matchId: typeof card.matchId === 'string' ? card.matchId : null,
    occurredAt:
      (typeof card.eventOccurredAt === 'string' && card.eventOccurredAt) ||
      (typeof card.publishedAt === 'string' && card.publishedAt) ||
      null,
  };
}

export function claimsFromCard(card: Record<string, unknown>): string[] {
  const facts = card.facts;
  if (!Array.isArray(facts)) return [];
  return facts
    .map((f) => {
      if (typeof f === 'string') return f;
      if (f && typeof f === 'object' && 'claim' in f) return String((f as { claim: unknown }).claim);
      return '';
    })
    .filter(Boolean);
}
