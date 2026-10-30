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
import { hasOpenRouter, openRouterModels } from "./inference/openrouter.js";
import { initializeRuntime, join, leave } from "./runtime/session.js";
import { EurekaState } from "./runtime/state.js";
import { joinTrace } from "./runtime/trace.js";
import { ARCHITECTURE } from "./architecture.js";
import { auditRun } from "./audit.js";
import { serveRuns } from "./trace-server.js";
import { openalexProbe } from "./openalex.js";
import { buildConfig, flag, fmt } from "./config.js";
import { startServe } from "./serve.js";

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

  if (command === "audit") {
    const runId = process.argv[3] ?? latestRun();
    process.exitCode = auditRun(runId);
    return;
  }

  if (command === "serve") {
    await startServe(flag("port", 4300));
    return;
  }

  await run();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
