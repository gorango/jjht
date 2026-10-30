/** Shared CLI flags and run configuration. */
import { hasOpenRouter, OPENROUTER_DEFAULTS } from "./inference/openrouter.js";
import type { Role, RunConfig } from "./runtime/state.js";

export const flag = (name: string, fallback: number): number => {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const textFlag = (name: string): string | undefined =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

export const poolOverrides = (): Partial<Record<Role, number>> => {
  const raw = textFlag("pools");
  if (!raw) return {};
  const result: Partial<Record<Role, number>> = {};
  for (const pair of raw.split(",")) {
    const [role, size] = pair.split(":");
    if (!role || !size) continue;
    result[role as Role] = Number(size);
  }
  return result;
};

export const buildConfig = (): RunConfig => ({
  companyLimit: flag("companies", 6),
  challengesPerCompany: flag("challenges", 2),
  candidatesPerChallenge: flag("candidates", 6),
  profileTopN: flag("profile", 3),
  portfolioSize: flag("portfolio", 5),
  leaseTtlMs: flag("lease-ttl", 120_000),
  mockLatencyMs: flag("mock-latency", 0),
  allowRealPeople: process.argv.includes("--allow-real-people"),
  chaos: textFlag("chaos") === "slow-worker" ? "slow-worker" : undefined,
  scheduler: textFlag("scheduler") === "off-after-boot" ? "off-after-boot" : "on",
  poolSize: {
    profiler: 3,
    analyst: 3,
    matchmaker: 3,
    writer: 3,
    critic: 2,
    ...poolOverrides(),
  },
  // With OpenRouter configured, model ids are OpenRouter ids (vendor/model), not
  // the bundled names — so the defaults change with the provider.
  strongModel:
    process.env.MOCK === "1" || process.env.MOCK === "true"
      ? "mock"
      : process.env.EUREKA_MODEL ?? (hasOpenRouter() ? OPENROUTER_DEFAULTS.strong : "gpt-5.5"),
  fastModel:
    process.env.MOCK === "1" || process.env.MOCK === "true"
      ? "mock"
      : process.env.EUREKA_FAST_MODEL ?? (hasOpenRouter() ? OPENROUTER_DEFAULTS.fast : "gpt-5.4-mini"),
  mock: process.env.MOCK === "1" || process.env.MOCK === "true",
});

export const fmt = (value: number): string => value.toLocaleString("en-US");
