/** Normalize extracted article text for storage and downstream AI. */
export function normalizeText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .trim();
}

export function countWords(text: string): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

export function detectLanguageHint(text: string): string | null {
  const sample = text.slice(0, 800);
  if (!sample) return null;
  const persianChars = (sample.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (sample.match(/[A-Za-z]/g) ?? []).length;
  if (persianChars > latinChars * 0.4) return 'fa';
  if (latinChars > 40) return 'en';
  return null;
}
