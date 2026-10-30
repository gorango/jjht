/**
 * EUREKA — entry point.
 *
 *   bun run mock     # deterministic, offline, no API key
 *   bun start        # real models (needs a provider key in .env)
 *   bun run trace    # serve the trace viewer for the latest run
 */
import "dotenv/config";

// Mozaik's cloud SDK logs a telemetry notice on every inference when no cloud key
// is configured. The run does not need Mozaik Cloud, so keep stdout readable.
const warn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (String(args[0]).startsWith("mozaik cloud:")) return;
  warn(...args);
};

import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { loadDataset, ResearcherIndex } from "./domain/dataset.js";
import { createPools } from "./agents/pool.js";
import { bootstrap, createWatchdog, diagnose, finalize, portfolioMarkdown, settled } from "./agents/scheduler.js";
import { MockRunner } from "./inference/mock.js";
import { hasOpenRouter, openRouterModels, OPENROUTER_DEFAULTS } from "./inference/openrouter.js";
import { initializeRuntime, join, leave } from "./runtime/session.js";
import { EurekaState, type Role, type RunConfig } from "./runtime/state.js";
import { joinTrace } from "./runtime/trace.js";
import { ARCHITECTURE } from "./architecture.js";
import { serveRuns } from "./trace-server.js";
import { openalexProbe } from "./openalex.js";

const flag = (name: string, fallback: number): number => {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const textFlag = (name: string): string | undefined =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

const poolOverrides = (): Partial<Record<Role, number>> => {
  const raw = process.argv.find((arg) => arg.startsWith("--pools="))?.split("=")[1];
  if (!raw) return {};
  const result: Partial<Record<Role, number>> = {};
  for (const pair of raw.split(",")) {
    const [role, size] = pair.split(":");
    if (!role || !size) continue;
    result[role as Role] = Number(size);
  }
  return result;
};

const buildConfig = (): RunConfig => ({
  companyLimit: flag("companies", 6),
  challengesPerCompany: flag("challenges", 2),
  candidatesPerChallenge: flag("candidates", 6),
  profileTopN: flag("profile", 3),
  portfolioSize: flag("portfolio", 5),
  leaseTtlMs: flag("lease-ttl", 120_000),
  mockLatencyMs: flag("mock-latency", 0),
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

const fmt = (value: number): string => value.toLocaleString("en-US");

const run = async (): Promise<void> => {
  const config = buildConfig();
  const startedAt = Date.now();

  const state = new EurekaState();
  state.config = config;
  const skip = flag("skip", 0);
  state.dataset = loadDataset(skip > 0 ? { companyOffset: skip } : {});
  state.index = new ResearcherIndex(state.dataset.researchers);

  for (const researcher of state.dataset.researchers) state.sourceIds.add(researcher.id);
  for (const id of state.dataset.publications.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.projects.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.patents.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.byChallengeId.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.byCompanyId.keys()) state.sourceIds.add(id);

  const provider = config.mock ? "mock" : hasOpenRouter() ? "openrouter" : "bundled";

  initializeRuntime({
    state,
    inferenceRunnerConfig: config.mock
      ? { runner: new MockRunner(config.mockLatencyMs) }
      : hasOpenRouter()
        ? { supportedModels: openRouterModels([config.strongModel, config.fastModel]) }
        : undefined,
  });

  const trace = joinTrace(state);

  const pools = createPools(state);
  for (const pool of pools) {
    for (const agent of pool.agents) join(agent);
  }

  console.log(
    `\nEUREKA ${state.runId}\n` +
      `  ${config.mock ? "MOCK model (offline, deterministic)" : `${provider} · ${config.strongModel} / ${config.fastModel}`}\n` +
      `  ${state.dataset.companies.length} companies, ${state.dataset.researchers.length} researchers, ` +
      `${state.dataset.publications.size} publications indexed\n` +
      `  pools: ${pools.map((pool) => `${pool.role}x${pool.agents.length}`).join(" ")}\n`,
  );

  const scheduler = bootstrap(state);
  if (config.scheduler === "off-after-boot") {
    // The Scheduler published the initial work, then leaves. The queues and the
    // lease market must drain without it; only a non-participant watchdog closes
    // the run. This is the claim docs/architecture.md makes, made measurable.
    leave(scheduler);
    state.schedulerId = undefined;
    const watchdog = createWatchdog();
    join(watchdog);
    state.watchdogId = watchdog.getId();
    state.note("run", "watchdog", "scheduler removed after boot; draining without it");
    console.log("  scheduler removed after boot (watchdog still measures completion)");
  }

  const timeoutMs = config.mock ? 20_000 : 900_000;
  const deadline = Date.now() + timeoutMs;

  while (!state.finalized && Date.now() < deadline) {
    if (config.scheduler === "off-after-boot" && settled(state)) {
      finalize(state, "all work settled without the scheduler");
      break;
    }
    await new Promise((done) => setTimeout(done, 100));
  }

  if (!state.finalized) console.warn(`\n  watchdog: ${diagnose(state)}\n`);
  const summary = finalize(state, state.finalized ? "settled" : "watchdog deadline");

  const entries = state.portfolio;
  const markdown = portfolioMarkdown(state, entries);
  trace.finish(summary, markdown, ARCHITECTURE);

  console.log(
    [
      "",
      "  ── run summary ────────────────────────────────────────",
      `  companies            ${summary.companies}`,
      `  challenges           ${summary.challenges}`,
      `  proposals            ${summary.proposals}`,
      `  approved             ${summary.approved}`,
      `  critic rejections    ${summary.rejections}`,
      `  portfolio            ${summary.portfolio}`,
      `  unmatched (on purpose) ${state.unmatched.size}`,
      `  model calls          ${summary.modelCalls}`,
      `  tokens               ${fmt(summary.inputTokens)} in / ${fmt(summary.outputTokens)} out`,
      `  cost (est.)          $${summary.costUsd.toFixed(4)}`,
      `  wall clock           ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
      "  ───────────────────────────────────────────────────────",
      `  trace    runs/${state.runId}/trace.jsonl`,
      `  portfolio runs/${state.runId}/portfolio.md`,
      `  view     bun run trace`,
      "",
    ].join("\n"),
  );

  process.exit(0);
};

const latestRun = (): string => {
  const dirs = readdirSync(resolve(process.cwd(), "runs"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const last = dirs[dirs.length - 1];
  if (!last) throw new Error("no runs yet — run `bun run mock` first");
  return last;
};

const main = async (): Promise<void> => {
  const command = process.argv[2] ?? "run";

  if (command === "openalex") {
    await openalexProbe();
    return;
  }

  if (command === "trace") {
    const runId = process.argv.find((arg) => arg.startsWith("--run="))?.split("=")[1] ?? latestRun();
    const port = flag("port", 4173);
    serveRuns(port, runId);
    return;
  }

  await run();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
