const MODEL_MAP = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
} as const;

const COST_PER_MILLION = {
  haiku: { input: 0.80, output: 4.00, cached: 0.08 },
  sonnet: { input: 3.00, output: 15.00, cached: 0.30 },
  opus: { input: 15.00, output: 75.00, cached: 1.50 },
} as const;

export function getModelId(tier: keyof typeof MODEL_MAP): string {
  return MODEL_MAP[tier];
}

export function calculateCostCents(
  tier: keyof typeof COST_PER_MILLION,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number
): number {
  const rates = COST_PER_MILLION[tier];
  const uncachedInput = inputTokens - cachedTokens;
  const cost =
    (uncachedInput / 1_000_000) * rates.input +
    (cachedTokens / 1_000_000) * rates.cached +
    (outputTokens / 1_000_000) * rates.output;
  return Math.ceil(cost * 100);
}
