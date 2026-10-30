/**
 * OpenRouter provider.
 *
 * OpenRouter speaks OpenAI's chat-completions dialect, so Mozaik's generic
 * `OpenAIChatCompletions` adapter is enough — no custom runner, no provider code.
 * The only thing that differs from the bundled models is the model list: OpenRouter
 * ids look like `deepseek/deepseek-v4-pro`, so they must be declared as
 * `GenerativeModel`s before `runLoop` can resolve them.
 *
 * Docs: https://openrouter.ai/docs
 */
import { OpenAIChatCompletions } from "@mozaik-ai/core";

/** The context-item kinds the OpenAI-compatible adapter can carry. */
const CONTEXT_ITEMS = [
  "user_message",
  "system_message",
  "developer_message",
  "reasoning",
  "function_call",
  "function_call_output",
  "model_message",
];

/**
 * Mirrors Mozaik's internal `ModelSpecification`. It is not exported from the
 * package root, but the runtime accepts any structurally identical object.
 */
interface ModelSpecification {
  name: string;
  provider: string;
  supportsReasoningEffort: boolean;
  supportedReasoningEfforts: string[];
  supportedContextItemTypes: string[];
  supportsStreaming: boolean;
  contextWindowSize: number;
  maxOutputTokens: number;
  supportsFunctionCalling: boolean;
  supportsStructuredOutput: boolean;
}

interface GenerativeModel {
  endpoint: OpenAIChatCompletions;
  specification: ModelSpecification;
}

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Defaults chosen for this workload: a strong writer, a cheap worker. */
export const OPENROUTER_DEFAULTS = {
  strong: "deepseek/deepseek-v4-pro",
  fast: "deepseek/deepseek-v4.1-flash",
} as const;

export const hasOpenRouter = (): boolean => Boolean(process.env.OPENROUTER_API_KEY);

const specification = (name: string): ModelSpecification => ({
  name,
  provider: "openrouter",
  supportsReasoningEffort: false,
  supportedReasoningEfforts: [],
  supportedContextItemTypes: CONTEXT_ITEMS,
  supportsStreaming: true,
  // Conservative ceilings: OpenRouter routes to different upstreams per model,
  // so declare what we actually use rather than the largest context any route has.
  contextWindowSize: 128_000,
  maxOutputTokens: 8_192,
  supportsFunctionCalling: true,
  supportsStructuredOutput: true,
});

/**
 * Build the model list the runtime validates against. Every id the run can use
 * must appear here — the runtime rejects an unknown `model` string before it
 * makes a network call.
 */
/**
 * OpenRouter-specific request shaping. `provider.sort: throughput` steers routing
 * to the fastest upstream for a model, which matters here: the same writer prompt
 * took 48s on one route and 186s on another during testing.
 * Override entirely with OPENROUTER_EXTRA_BODY='{"provider":{"sort":"price"}}'.
 */
const extraBody = (): Record<string, unknown> => {
  const raw = process.env.OPENROUTER_EXTRA_BODY;
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.warn("OPENROUTER_EXTRA_BODY is not valid JSON; using defaults");
    }
  }
  // Reasoning off by default: on this workload the models spent 4–5k tokens
  // reasoning about a one-page proposal, which cost 4× the latency for no
  // measurable quality gain. Set OPENROUTER_REASONING=1 to turn it back on.
  return {
    provider: { sort: "throughput" },
    ...(process.env.OPENROUTER_REASONING === "1" ? {} : { reasoning: { enabled: false } }),
  };
};

export const openRouterModels = (names: string[]): GenerativeModel[] => {
  const endpoint = new OpenAIChatCompletions(undefined, {
    baseURL: process.env.OPENROUTER_BASE_URL ?? OPENROUTER_BASE_URL,
    apiKey: process.env.OPENROUTER_API_KEY,
    extraBody: extraBody(),
  });

  return [...new Set(names.filter(Boolean))].map((name) => ({
    endpoint,
    specification: specification(name),
  }));
};
