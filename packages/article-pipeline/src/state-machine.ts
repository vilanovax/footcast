import { ArticleStatus } from '@footcast/shared';

const TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  [ArticleStatus.DISCOVERED]: [ArticleStatus.FETCHING, ArticleStatus.FAILED, ArticleStatus.ARCHIVED],
  [ArticleStatus.FETCHING]: [
    ArticleStatus.FETCHED,
    ArticleStatus.FAILED,
    ArticleStatus.DISCOVERED,
  ],
  [ArticleStatus.FETCHED]: [ArticleStatus.PARSED, ArticleStatus.FAILED, ArticleStatus.FETCHING],
  [ArticleStatus.PARSED]: [
    ArticleStatus.EXTRACTING,
    ArticleStatus.FAILED,
    ArticleStatus.ARCHIVED,
    ArticleStatus.FETCHING,
    ArticleStatus.FETCHED, // re-parse from stored HTML
  ],
  [ArticleStatus.EXTRACTING]: [
    ArticleStatus.EXTRACTED,
    ArticleStatus.FAILED,
    ArticleStatus.IRRELEVANT,
    ArticleStatus.DUPLICATE,
  ],
  [ArticleStatus.EXTRACTED]: [
    ArticleStatus.DUPLICATE,
    ArticleStatus.IRRELEVANT,
    ArticleStatus.ARCHIVED,
    ArticleStatus.FAILED,
    ArticleStatus.EXTRACTING, // re-extract
  ],
  [ArticleStatus.IRRELEVANT]: [
    ArticleStatus.ARCHIVED,
    ArticleStatus.DISCOVERED,
    ArticleStatus.EXTRACTING,
  ],
  [ArticleStatus.DUPLICATE]: [
    ArticleStatus.ARCHIVED,
    ArticleStatus.DISCOVERED,
    ArticleStatus.EXTRACTING, // re-extract after clustering
  ],
  [ArticleStatus.FAILED]: [
    ArticleStatus.DISCOVERED,
    ArticleStatus.FETCHING,
    ArticleStatus.FETCHED,
    ArticleStatus.PARSED,
    ArticleStatus.EXTRACTING,
    ArticleStatus.ARCHIVED,
  ],
  [ArticleStatus.ARCHIVED]: [ArticleStatus.DISCOVERED],
};

export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: ArticleStatus, to: ArticleStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid article transition: ${from} -> ${to}`);
  }
}

/** Statuses from which a full re-fetch pipeline can restart. */
export function canReprocess(status: ArticleStatus): boolean {
  return [
    ArticleStatus.DISCOVERED,
    ArticleStatus.FETCHED,
    ArticleStatus.PARSED,
    ArticleStatus.FAILED,
    ArticleStatus.IRRELEVANT,
  ].includes(status);
}

/** Statuses that may re-run parse without re-fetching HTML. */
export function canReparse(status: ArticleStatus): boolean {
  return [ArticleStatus.FETCHED, ArticleStatus.PARSED, ArticleStatus.FAILED].includes(status);
}

/** Statuses that may run AI extraction from parsed content. */
export function canExtract(status: ArticleStatus): boolean {
  return [
    ArticleStatus.PARSED,
    ArticleStatus.EXTRACTED,
    ArticleStatus.DUPLICATE,
    ArticleStatus.IRRELEVANT,
    ArticleStatus.FAILED,
  ].includes(status);
}

/** Statuses that may run event clustering / dedup. */
export function canCluster(status: ArticleStatus): boolean {
  return [ArticleStatus.EXTRACTED, ArticleStatus.DUPLICATE, ArticleStatus.FAILED].includes(
    status,
  );
}
