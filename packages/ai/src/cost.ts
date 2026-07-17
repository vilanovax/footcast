import type { AiUsage } from './types.js';

/** Rough USD per 1M tokens — used for estimates only. */
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  'mock/mock-v1': { input: 0, output: 0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'anthropic/claude-haiku': { input: 0.25, output: 1.25 },
  default: { input: 0.2, output: 0.8 },
};

export function estimateCostUsd(
  provider: string,
  model: string,
  usage: AiUsage,
): number {
  const key = `${provider}/${model}`;
  const price = PRICE_TABLE[key] ?? PRICE_TABLE.default;
  const input = usage.inputTokens + (usage.cachedInputTokens ?? 0) * 0.5;
  const output = usage.outputTokens + (usage.reasoningTokens ?? 0);
  const cost = (input * price.input + output * price.output) / 1_000_000;
  return Number(cost.toFixed(6));
}
