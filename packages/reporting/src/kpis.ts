export interface DecisionCounts {
  approve: number;
  reject: number;
  other?: number;
}

export interface AcceptanceRate {
  approve: number;
  reject: number;
  total: number;
  rate: number | null;
}

export function computeAcceptanceRate(counts: DecisionCounts): AcceptanceRate {
  const approve = Math.max(0, Number(counts.approve) || 0);
  const reject = Math.max(0, Number(counts.reject) || 0);
  const total = approve + reject;
  return {
    approve,
    reject,
    total,
    rate: total === 0 ? null : approve / total,
  };
}

export function sumTokens(input: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
}): number {
  return (
    Number(input.inputTokens ?? 0) +
    Number(input.outputTokens ?? 0) +
    Number(input.cachedInputTokens ?? 0)
  );
}

export function crawlSuccessRate(discovered: number, errors: number): number | null {
  const d = Math.max(0, Number(discovered) || 0);
  const e = Math.max(0, Number(errors) || 0);
  const denom = d + e;
  if (denom === 0) return null;
  return d / denom;
}

export function roundMetric(value: number | null | undefined, digits = 2): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}
