/**
 * Estimated prices, USD per million tokens. Rough by design: the trace exists to
 * show the *shape* of the cost (which role spends the money), not to bill anyone.
 * Override a row with EUREKA_PRICES='{"gpt-5.5":{"in":1.25,"out":10}}'.
 */
export interface Price {
  in: number;
  out: number;
}

const DEFAULTS: Record<string, Price> = {
  "gpt-5.5": { in: 1.25, out: 10 },
  "gpt-5.4": { in: 1.25, out: 10 },
  "gpt-5.4-mini": { in: 0.25, out: 2 },
  "gpt-5.4-nano": { in: 0.05, out: 0.4 },
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "gemini-3.5-flash": { in: 0.3, out: 2.5 },
  "gemini-3.1-pro-preview": { in: 1.25, out: 10 },
  "deepseek-v4-flash": { in: 0.28, out: 0.42 },
  "deepseek/deepseek-v4-pro": { in: 1.6, out: 3.2 },
  "deepseek/deepseek-v4.1-flash": { in: 0.045, out: 0.5 },
  "deepseek/deepseek-v4.1-flash-1017": { in: 0.15, out: 0.6 },
  "qwen/qwen3.7-flash": { in: 0.03, out: 0.13 },
  "deepseek-v4-pro": { in: 0.55, out: 2.2 },
};

let overrides: Record<string, Price> | undefined;
const warned = new Set<string>();

const table = (): Record<string, Price> => {
  if (overrides) return overrides;
  overrides = { ...DEFAULTS };
  const raw = process.env.EUREKA_PRICES;
  if (raw) {
    try {
      overrides = { ...overrides, ...(JSON.parse(raw) as Record<string, Price>) };
    } catch {
      console.warn("EUREKA_PRICES is not valid JSON; using built-in estimates");
    }
  }
  return overrides;
};

/**
 * An unknown model id used to be silently priced at {in:1,out:3}, which makes a
 * typo in EUREKA_MODEL look cheaper than it is. Warn once (or throw under
 * EUREKA_PRICE_STRICT=1) and make the fallback visible in the run log.
 */
export const priceOf = (model: string): Price => {
  const price = table()[model];
  if (price) return price;
  const message = `priceOf: no price for model "${model}"; using the fallback {in:1,out:3}. Set EUREKA_PRICES or EUREKA_PRICE_STRICT=1.`;
  if (process.env.EUREKA_PRICE_STRICT === "1") throw new Error(message);
  if (!warned.has(model)) {
    warned.add(model);
    console.warn(message);
  }
  return { in: 1, out: 3 };
};

export const estimateCost = (model: string, inputTokens: number, outputTokens: number): number => {
  const price = priceOf(model);
  return (inputTokens / 1_000_000) * price.in + (outputTokens / 1_000_000) * price.out;
};
