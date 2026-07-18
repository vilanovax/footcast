import { normalizeForMatch } from './normalize.js';

/** Map normalized alias → canonical normalized name */
export type AliasMap = Map<string, string>;

export function buildAliasMap(
  rows: Array<{ normalizedAlias: string; canonicalNormalized: string }>,
): AliasMap {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.normalizedAlias, row.canonicalNormalized);
  }
  return map;
}

export function resolveEntityName(name: string, aliasMap?: AliasMap): string {
  const key = normalizeForMatch(name);
  if (!key) return key;
  return aliasMap?.get(key) ?? key;
}

export function resolveEntityNames(names: string[], aliasMap?: AliasMap): string[] {
  const out = new Set<string>();
  for (const name of names) {
    const resolved = resolveEntityName(name, aliasMap);
    if (resolved) out.add(resolved);
  }
  return [...out];
}
