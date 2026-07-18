import { randomUUID } from 'node:crypto';
import { normalizeTaxonomyKey } from '@footcast/shared';
import type { Database } from './connection.js';

type AliasIndex = {
  teams: Array<{ id: string; slug: string; keys: string[] }>;
  competitions: Array<{ id: string; slug: string; keys: string[] }>;
  tracked: Array<{ id: string; slug: string; keys: string[]; isActive: boolean }>;
};

type CardSlice = {
  league?: { id?: string; name?: string } | null;
  clubs?: Array<{ id?: string; name?: string }>;
  people?: Array<{ id?: string; name?: string }>;
};

function expandAliases(
  slug: string,
  nameFa: string,
  nameEn: string | null,
  aliases: unknown,
): string[] {
  let list: string[] = [];
  if (Array.isArray(aliases)) list = aliases.map(String);
  else if (typeof aliases === 'string') {
    try {
      const parsed = JSON.parse(aliases) as unknown;
      if (Array.isArray(parsed)) list = parsed.map(String);
    } catch {
      list = [];
    }
  }
  return [slug, nameFa, nameEn ?? '', ...list]
    .map((s) => normalizeTaxonomyKey(s))
    .filter(Boolean);
}

export async function loadAliasIndex(db: Database): Promise<AliasIndex> {
  const [teams, competitions, tracked] = await Promise.all([
    db.models.EditorialTeam.findAll({ where: { isActive: true } }),
    db.models.Competition.findAll({ where: { isActive: true } }),
    db.models.TrackedEvent.findAll({ where: { isActive: true } }),
  ]);
  return {
    teams: teams.map((t) => ({
      id: t.getDataValue('id'),
      slug: t.getDataValue('slug'),
      keys: expandAliases(
        t.getDataValue('slug'),
        t.getDataValue('nameFa'),
        t.getDataValue('nameEn'),
        t.getDataValue('aliases'),
      ),
    })),
    competitions: competitions.map((c) => ({
      id: c.getDataValue('id'),
      slug: c.getDataValue('slug'),
      keys: expandAliases(
        c.getDataValue('slug'),
        c.getDataValue('nameFa'),
        c.getDataValue('nameEn'),
        c.getDataValue('aliases'),
      ),
    })),
    tracked: tracked.map((e) => ({
      id: e.getDataValue('id'),
      slug: e.getDataValue('slug'),
      isActive: e.getDataValue('isActive'),
      keys: expandAliases(
        e.getDataValue('slug'),
        e.getDataValue('title'),
        null,
        e.getDataValue('aliases'),
      ),
    })),
  };
}

function matchIds(
  haystacks: string[],
  catalog: Array<{ id: string; keys: string[] }>,
): string[] {
  const norms = haystacks.map(normalizeTaxonomyKey).filter(Boolean);
  const hits = new Set<string>();
  for (const item of catalog) {
    for (const n of norms) {
      if (
        item.keys.some(
          (k) => k === n || (k.length >= 3 && (n.includes(k) || k.includes(n))),
        )
      ) {
        hits.add(item.id);
        break;
      }
    }
  }
  return [...hits];
}

async function loadCardSlice(db: Database, newsEventId: string, primaryArticleId: string | null): Promise<CardSlice | null> {
  let articleId = primaryArticleId;
  if (!articleId) {
    const link = await db.models.NewsEventArticle.findOne({
      where: { eventId: newsEventId },
      order: [['createdAt', 'ASC']],
    });
    articleId = link?.getDataValue('articleId') ?? null;
  }
  if (!articleId) return null;

  const extraction = await db.models.ArticleExtraction.findOne({
    where: { articleId },
    order: [['createdAt', 'DESC']],
  });
  if (!extraction) return null;
  const card = extraction.getDataValue('cardJson') as CardSlice | null;
  return card && typeof card === 'object' ? card : null;
}

export async function tagNewsEventTaxonomy(
  db: Database,
  newsEventId: string,
  index?: AliasIndex,
): Promise<{
  teamIds: string[];
  competitionIds: string[];
  trackedEventIds: string[];
}> {
  const event = await db.models.NewsEvent.findByPk(newsEventId);
  if (!event) {
    return { teamIds: [], competitionIds: [], trackedEventIds: [] };
  }
  const catalog = index ?? (await loadAliasIndex(db));
  const sig = (event.getDataValue('eventSignature') ?? {}) as {
    primaryEntities?: string[];
    secondaryEntities?: string[];
    competitionId?: string | null;
  };
  const title = event.getDataValue('title') ?? '';
  const summary = event.getDataValue('summary') ?? '';
  const card = await loadCardSlice(
    db,
    newsEventId,
    event.getDataValue('primaryArticleId'),
  );

  const clubNames = (card?.clubs ?? [])
    .map((c) => c.name)
    .filter((n): n is string => Boolean(n));
  const leagueName = card?.league?.name ?? '';
  const leagueId = card?.league?.id ?? '';
  const peopleNames = (card?.people ?? [])
    .map((p) => p.name)
    .filter((n): n is string => Boolean(n));

  const haystack = [
    ...(sig.primaryEntities ?? []),
    ...(sig.secondaryEntities ?? []),
    sig.competitionId ?? '',
    leagueName,
    leagueId,
    ...clubNames,
    ...peopleNames,
    title,
    summary,
  ].filter((s): s is string => Boolean(s));

  const teamIds = matchIds(haystack, catalog.teams);
  const competitionIds = matchIds(haystack, catalog.competitions);
  const trackedEventIds = matchIds(haystack, catalog.tracked);

  // Prefer explicit card.league match; if IRAN key team and no league, default IPL
  const ipl = catalog.competitions.find((c) => c.slug === 'iran-pro-league');
  if (
    event.getDataValue('scope') === 'IRAN' &&
    competitionIds.length === 0 &&
    teamIds.length > 0 &&
    ipl
  ) {
    competitionIds.push(ipl.id);
  }

  // EUROPE without competition: try EPL/UCL from title keywords already in haystack via aliases

  for (const teamId of teamIds) {
    const exists = await db.models.NewsEventTeam.findOne({
      where: { newsEventId, teamId },
    });
    if (!exists) {
      await db.models.NewsEventTeam.create({
        id: randomUUID(),
        newsEventId,
        teamId,
        role: 'PRIMARY',
      });
    }
  }
  for (const competitionId of competitionIds) {
    const exists = await db.models.NewsEventCompetition.findOne({
      where: { newsEventId, competitionId },
    });
    if (!exists) {
      await db.models.NewsEventCompetition.create({
        id: randomUUID(),
        newsEventId,
        competitionId,
      });
    }
  }
  for (const trackedEventId of trackedEventIds) {
    const exists = await db.models.NewsEventTrackedEvent.findOne({
      where: { newsEventId, trackedEventId },
    });
    if (!exists) {
      await db.models.NewsEventTrackedEvent.create({
        id: randomUUID(),
        newsEventId,
        trackedEventId,
      });
    }
  }

  return { teamIds, competitionIds, trackedEventIds };
}

export async function backfillTaxonomyForDay(
  db: Database,
  eventIds: string[],
): Promise<number> {
  if (eventIds.length === 0) return 0;
  const index = await loadAliasIndex(db);
  let n = 0;
  for (const id of eventIds) {
    const res = await tagNewsEventTaxonomy(db, id, index);
    if (
      res.teamIds.length + res.competitionIds.length + res.trackedEventIds.length >
      0
    ) {
      n += 1;
    }
  }
  return n;
}
