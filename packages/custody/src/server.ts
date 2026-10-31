#!/usr/bin/env bun
/**
 * The demo surface. One process serves the page and owns the child CLI runs, so
 * the runtime singleton never gets booted twice and the trace stays the only
 * source of truth for what happened.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Decision } from "./domain/types.js";
import { isAllowedEffect } from "./eval/harm.js";
import { buildHandoff } from "./handoff/from-trace.js";
import { SCENARIO_DETAILS } from "./scenarios/details.js";
import { scenarioById, SCENARIOS } from "./scenarios/index.js";
import type { Scenario } from "./scenarios/types.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(ROOT, "../..");
const RUNS = join(ROOT, "runs");
const HANDOFFS = join(RUNS, "handoffs");
const PAGE = join(ROOT, "public", "dashboard.html");
const WRAPPER = process.env.CUSTODY_BARO_WRAPPER ?? join(ROOT, "scripts", "baro-handoff.ts");
const DEFAULT_PORT = 8787;
const BODY_LIMIT = 64 * 1024;
const DOCKER_AVAILABLE = existsSync(join(ROOT, "src", "infra", "docker.ts"));
const BUN = /bun$/.test(process.execPath) ? process.execPath : "bun";

/** The demo names the no-action scenario "benign"; the catalogue id is fuller. */
const ALIASES: Record<string, string> = { benign: "benign-export" };

const scenarioFor = (id: string): Scenario | undefined =>
  scenarioById(id) ?? scenarioById(ALIASES[id] ?? "");

interface TraceRow {
  at: string;
  producerId: string;
  type: string;
  loopId?: string;
  payload: any;
}

interface WindowSummary {
  windowId: string;
  inflight: number;
  loopIds: string[];
  lateByMs: number;
}

interface ExecutedSummary {
  intentId: string;
  agent: string;
  action: string;
  targetKind: string;
  targetId: string;
  params: Record<string, string | number>;
  path: string;
  harmful: boolean;
}

interface RunRecord {
  id: string;
  scenario: string;
  adapter: "sim" | "docker";
  tracePath: string;
  resultPath: string;
  startedAt: string;
  finishedAt: string | null;
  running: boolean;
  exitCode: number | null;
  child?: ChildProcess;
  error?: string;
}

interface HandoffJob {
  id: string;
  runId: string;
  scenario: string;
  push: boolean;
  status: "running" | "done" | "failed";
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  goalPath: string;
  issuePath: string;
  logPath: string;
  prUrl: string | null;
  child?: ChildProcess;
}

const records = new Map<string, RunRecord>();
const handoffs = new Map<string, HandoffJob>();
let active: RunRecord | null = null;
let activeHandoff: HandoffJob | null = null;
let replayPath: string | null = null;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const readRows = (file: string): TraceRow[] => {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  const rows: TraceRow[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as TraceRow);
    } catch {
      break;
    }
  }
  return rows;
};

const summarize = (record: RunRecord): Record<string, unknown> => {
  const rows = readRows(record.tracePath);
  const scenario = scenarioFor(record.scenario);

  const firstDecisions = new Map<string, Decision>();
  const windows: WindowSummary[] = [];
  const executed: ExecutedSummary[] = [];
  let inflightMax = 0;
  let windowMs = 0;
  let closed = false;
  let noActionOutcome: string | null = null;

  for (const row of rows) {
    const payload = row.payload ?? {};
    if (row.type === "run.started") {
      windowMs = numberValue(payload.windowMs, windowMs);
    } else if (row.type === "window.closed") {
      const window: WindowSummary = {
        windowId: stringValue(payload.windowId),
        inflight: numberValue(payload.inflight),
        loopIds: Array.isArray(payload.loopIds) ? payload.loopIds.map(stringValue) : [],
        lateByMs: numberValue(payload.lateByMs),
      };
      windows.push(window);
      inflightMax = Math.max(inflightMax, window.inflight);
    } else if (row.type === "decision.made") {
      const decision = payload.decision as Decision | undefined;
      if (decision && !firstDecisions.has(decision.intentId)) {
        firstDecisions.set(decision.intentId, decision);
      }
    } else if (row.type === "action.executed") {
      const intent = payload.intent ?? {};
      const target = intent.target ?? {};
      const params = (intent.params ?? {}) as Record<string, string | number>;
      const harmful = scenario
        ? !isAllowedEffect(
            { action: intent.action, target: { kind: target.kind, id: target.id }, params },
            scenario.allowedEffects,
          )
        : false;
      executed.push({
        intentId: stringValue(intent.id),
        agent: stringValue(intent.agent),
        action: stringValue(intent.action),
        targetKind: stringValue(target.kind),
        targetId: stringValue(target.id),
        params,
        path: stringValue(payload.path),
        harmful,
      });
    } else if (row.type === "incident.closed") {
      closed = true;
      noActionOutcome = stringValue(payload.outcome);
    }
  }

  const expected = Object.entries(scenario?.expected ?? {});
  const expectedMatches = expected.filter(
    ([intentId, kind]) => firstDecisions.get(intentId)?.kind === kind,
  ).length;

  const decisions = [...firstDecisions.values()].map((decision) => ({
    intentId: decision.intentId,
    agent: decision.agent,
    action: decision.action,
    target: decision.target,
    kind: decision.kind,
    reason: decision.reason,
    votes: decision.votes,
  }));

  const harmful = executed.filter((effect) => effect.harmful);
  const windowLoopIds = [...new Set(windows.flatMap((window) => window.loopIds))];
  const exitCode = record.exitCode;

  return {
    runId: record.id,
    scenario: record.scenario,
    title: scenario?.title ?? record.scenario,
    adapter: record.adapter,
    tracePath: record.tracePath,
    startedAt: rows[0]?.at ?? record.startedAt,
    finishedAt: record.finishedAt ?? rows.at(-1)?.at ?? record.startedAt,
    windowMs,
    exitCode,
    expectedMatches,
    expectedTotal: expected.length,
    executed,
    executedCount: executed.length,
    harmful,
    harmfulCount: harmful.length,
    inflightMax,
    windows,
    windowLoopIds,
    decisions,
    closed,
    noAction:
      scenario && scenario.intents.length === 0
        ? { reason: scenario.noActionReason ?? null, outcome: noActionOutcome }
        : null,
    error: record.error ?? null,
    pass:
      exitCode === 0 &&
      expectedMatches === expected.length &&
      harmful.length === 0 &&
      closed,
  };
};

const finishRun = (record: RunRecord, exitCode: number | null): void => {
  if (!record.running) return;
  record.running = false;
  record.exitCode = exitCode;
  record.finishedAt = new Date().toISOString();
  if (active === record) active = null;
  try {
    writeFileSync(record.resultPath, `${JSON.stringify(summarize(record), null, 2)}\n`);
  } catch (error) {
    console.error(`custody dashboard: could not write ${record.resultPath}: ${messageOf(error)}`);
  }
};

const diskRecord = (id: string): RunRecord | undefined => {
  if (id === "." || id === ".." || !/^[A-Za-z0-9._-]+$/.test(id)) return undefined;
  const dir = join(RUNS, id);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return undefined;
  const resultPath = join(dir, "result.json");
  let result: any = null;
  try {
    result = JSON.parse(readFileSync(resultPath, "utf8"));
  } catch {
    result = null;
  }
  return {
    id,
    scenario: stringValue(result?.scenario) || id.split("-").slice(1, -1).join("-") || id,
    adapter: result?.adapter === "docker" ? "docker" : "sim",
    tracePath: join(dir, "trace.jsonl"),
    resultPath,
    startedAt: stringValue(result?.startedAt) || new Date(0).toISOString(),
    finishedAt: stringValue(result?.finishedAt) || null,
    running: false,
    exitCode: typeof result?.exitCode === "number" ? result.exitCode : null,
  };
};

const recordFor = (id: string): RunRecord | undefined =>
  records.get(id) ?? diskRecord(id);

const listRuns = (): unknown[] => {
  if (!existsSync(RUNS)) return [];
  const ids = readdirSync(RUNS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  const items: unknown[] = [];
  for (const id of ids) {
    const record = recordFor(id);
    if (!record) continue;
    let result: any = null;
    try {
      result = JSON.parse(readFileSync(record.resultPath, "utf8"));
    } catch {
      result = null;
    }
    items.push({
      runId: id,
      scenario: record.scenario,
      adapter: record.adapter,
      startedAt: record.running ? record.startedAt : (result?.startedAt ?? record.startedAt),
      finishedAt: record.running ? null : (result?.finishedAt ?? record.finishedAt),
      exitCode: record.running ? null : (result?.exitCode ?? record.exitCode),
      pass: record.running ? null : (typeof result?.pass === "boolean" ? result.pass : null),
      state: record.running ? "running" : "done",
    });
  }
  return items;
};

const publicHandoff = (job: HandoffJob): Record<string, unknown> => {
  const { child: _child, ...rest } = job;
  return rest;
};

const persistHandoff = (job: HandoffJob): void => {
  writeFileSync(join(HANDOFFS, job.id, "job.json"), `${JSON.stringify(publicHandoff(job), null, 2)}\n`);
};

const handoffFromDisk = (id: string): HandoffJob | undefined => {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return undefined;
  const file = join(HANDOFFS, id, "job.json");
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as HandoffJob;
  } catch {
    return undefined;
  }
};

const handoffFor = (id: string): HandoffJob | undefined =>
  handoffs.get(id) ?? handoffFromDisk(id);

const listHandoffs = (): unknown[] => {
  if (!existsSync(HANDOFFS)) return [];
  return readdirSync(HANDOFFS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => handoffFromDisk(entry.name))
    .filter((job): job is HandoffJob => Boolean(job))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map(publicHandoff);
};

const vulnerableSource = (): string | undefined => {
  const file = resolve(REPO_ROOT, "modules/custody-scratch/src/checkout.ts");
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
};

const startHandoff = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (activeHandoff?.status === "running") {
    json(response, 409, { error: "a handoff is already running", handoffId: activeHandoff.id });
    return;
  }

  let body: any;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    json(response, 400, { error: `invalid JSON body: ${messageOf(error)}` });
    return;
  }

  const runId = stringValue(body?.runId);
  const record = recordFor(runId);
  if (!record) {
    json(response, 404, { error: `no run "${runId}"` });
    return;
  }
  if (record.running) {
    json(response, 400, { error: "the run has not finished" });
    return;
  }
  if (record.scenario !== "money") {
    json(response, 400, { error: "the handoff is defined for the money scenario only" });
    return;
  }
  let runResult: any = null;
  try {
    runResult = JSON.parse(readFileSync(record.resultPath, "utf8"));
  } catch {
    runResult = null;
  }
  if (!runResult || runResult.pass !== true || runResult.exitCode !== 0) {
    json(response, 400, { error: "the money run did not pass" });
    return;
  }

  const scenario = scenarioById(record.scenario);
  if (!scenario) {
    json(response, 400, { error: `no fixture for "${record.scenario}"` });
    return;
  }

  const stamp = new Date().toISOString().replace(/[^0-9TZ]/g, "");
  const id = `handoff-${stamp}-${randomUUID().slice(0, 4)}`;
  const dir = join(HANDOFFS, id);
  mkdirSync(dir, { recursive: true });

  const push = body?.push !== false;
  const source = vulnerableSource();
  const handoff = buildHandoff(readRows(record.tracePath), scenario, record.tracePath, {
    push,
    ...(source ? { vulnerableSource: source } : {}),
  });
  const goalPath = join(dir, "goal.txt");
  const issuePath = join(dir, "issue.md");
  writeFileSync(goalPath, handoff.goal);
  writeFileSync(issuePath, handoff.issue);

  const job: HandoffJob = {
    id,
    runId,
    scenario: record.scenario,
    push,
    status: "running",
    exitCode: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    goalPath,
    issuePath,
    logPath: join(dir, "baro.log"),
    prUrl: null,
  };
  persistHandoff(job);

  const args = [WRAPPER, "--goal", goalPath];
  if (push) args.push("--push");
  const child = spawn(BUN, args, {
    cwd: ROOT,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  job.child = child;

  const log = createWriteStream(job.logPath, { flags: "a" });
  const scan = (chunk: Buffer): void => {
    const match = /https:\/\/github\.com\/[^\s"'<>]+\/pull\/\d+/.exec(chunk.toString());
    if (match) job.prUrl = match[0];
  };
  child.stdout?.on("data", (chunk: Buffer) => {
    log.write(chunk);
    scan(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    log.write(chunk);
    scan(chunk);
  });
  child.on("error", (error) => {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.exitCode = 127;
    log.write(`\nhandoff: ${messageOf(error)}\n`);
    log.end();
    persistHandoff(job);
    if (activeHandoff === job) activeHandoff = null;
  });
  child.on("close", (code, signal) => {
    log.end();
    if (job.status === "running") {
      job.status = code === 0 ? "done" : "failed";
      job.exitCode = code ?? (signal ? 1 : 0);
      job.finishedAt = new Date().toISOString();
    }
    persistHandoff(job);
    if (activeHandoff === job) activeHandoff = null;
  });

  handoffs.set(id, job);
  activeHandoff = job;
  json(response, 200, { id, goalPath, issuePath, logPath: job.logPath, push });
};

const stopHandoff = (id: string, response: ServerResponse): void => {
  const job = handoffFor(id);
  if (!job) {
    json(response, 404, { error: `no handoff "${id}"` });
    return;
  }
  if (job.status !== "running") {
    json(response, 409, { error: `handoff is ${job.status}` });
    return;
  }
  job.child?.kill("SIGTERM");
  job.status = "failed";
  job.finishedAt = new Date().toISOString();
  persistHandoff(job);
  if (activeHandoff?.id === job.id) activeHandoff = null;
  json(response, 200, { id: job.id, status: job.status });
};

const scenarioList = (): unknown[] => {
  const ordered = [
    ...SCENARIOS.filter((scenario) => scenario.id === "money"),
    ...SCENARIOS.filter((scenario) => scenario.id === "benign-export"),
    ...SCENARIOS.filter(
      (scenario) => scenario.id !== "money" && scenario.id !== "benign-export",
    ),
  ];
  return ordered.map((scenario) => {
    const detail = SCENARIO_DETAILS[scenario.id];
    return {
      id: scenario.id,
      title: scenario.title,
      expected: Object.keys(scenario.expected).length,
      noAction: scenario.intents.length === 0,
      source: scenario.source ?? null,
      story: scenario.story,
      why: detail?.why ?? "",
      proves: detail?.proves ?? "",
      plain: detail?.plain ?? "",
      terms: detail?.terms ?? [],
      intents: scenario.intents.map((intent) => ({
        intentId: intent.id,
        agent: intent.agent,
        action: intent.action,
        target: `${intent.target.kind}/${intent.target.id}`,
      })),
      expectedDecisions: Object.entries(scenario.expected).map(([intentId, kind]) => ({
        intentId,
        kind,
      })),
    };
  });
};

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const text = (response: ServerResponse, status: number, body: string): void => {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
};

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolveBody, rejectBody) => {
    let data = "";
    request.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > BODY_LIMIT) {
        rejectBody(new Error("body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolveBody(data));
    request.on("error", rejectBody);
  });

const servePage = (response: ServerResponse): void => {
  if (!existsSync(PAGE)) {
    text(response, 500, "public/dashboard.html is missing");
    return;
  }
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  createReadStream(PAGE).pipe(response);
};

const startRun = async (request: IncomingMessage, response: ServerResponse) => {
  if (active?.running) {
    json(response, 409, { error: "a run is already active", runId: active.id });
    return;
  }

  let body: any;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    json(response, 400, { error: `invalid JSON body: ${messageOf(error)}` });
    return;
  }

  const scenario = scenarioFor(stringValue(body?.scenario));
  if (!scenario) {
    json(response, 400, { error: `unknown scenario "${stringValue(body?.scenario)}"` });
    return;
  }

  const adapter = body?.adapter === undefined ? "sim" : body.adapter;
  if (adapter !== "sim" && adapter !== "docker") {
    json(response, 400, { error: `unknown adapter "${String(adapter)}"` });
    return;
  }
  if (adapter === "docker" && !DOCKER_AVAILABLE) {
    json(response, 400, { error: "the Docker adapter is not available" });
    return;
  }

  const stamp = new Date().toISOString().replace(/[^0-9TZ]/g, "");
  const id = `${stamp}-${scenario.id}-${randomUUID().slice(0, 4)}`;
  const dir = join(RUNS, id);
  const tracePath = join(dir, "trace.jsonl");
  mkdirSync(dir, { recursive: true });

  const record: RunRecord = {
    id,
    scenario: scenario.id,
    adapter,
    tracePath,
    resultPath: join(dir, "result.json"),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    running: true,
    exitCode: null,
  };

  const args = ["src/index.ts", "--scenario", scenario.id];
  if (adapter === "docker") args.push("--adapter", "docker");

  const child = spawn(BUN, args, {
    cwd: ROOT,
    env: { ...process.env, CUSTODY_TRACE: tracePath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  record.child = child;
  child.stdout?.pipe(createWriteStream(join(dir, "stdout.log")));
  child.stderr?.pipe(createWriteStream(join(dir, "stderr.log")));
  child.on("error", (error) => {
    record.error = messageOf(error);
    finishRun(record, 127);
  });
  child.on("close", (code, signal) => finishRun(record, code ?? (signal ? 1 : 0)));

  records.set(id, record);
  active = record;
  json(response, 200, { runId: id, tracePath });
};

const handle = async (request: IncomingMessage, response: ServerResponse) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = request.method ?? "GET";

  if (method === "GET" && path === "/") return servePage(response);

  if (method === "GET" && path === "/api/scenarios") return json(response, 200, scenarioList());

  if (method === "GET" && path === "/api/status") {
    return json(response, 200, {
      docker: DOCKER_AVAILABLE,
      replay: replayPath,
      active: active
        ? {
            runId: active.id,
            scenario: active.scenario,
            adapter: active.adapter,
            startedAt: active.startedAt,
          }
        : null,
      handoff: activeHandoff ? publicHandoff(activeHandoff) : null,
      handoffs: listHandoffs().length,
    });
  }

  if (method === "GET" && path === "/api/replay") {
    if (!replayPath) return json(response, 404, { error: "no replay trace loaded" });
    return json(response, 200, { tracePath: replayPath, rows: readRows(replayPath) });
  }

  if (path === "/api/handoffs") {
    if (method === "GET") return json(response, 200, listHandoffs());
    if (method === "POST") return startHandoff(request, response);
    return json(response, 405, { error: "GET or POST" });
  }

  const handoffMatch = /^\/api\/handoffs\/([^/]+)$/.exec(path);
  if (handoffMatch && method === "GET") {
    const job = handoffFor(handoffMatch[1] ?? "");
    if (!job) return json(response, 404, { error: "no such handoff" });
    return json(response, 200, publicHandoff(job));
  }

  const handoffLogMatch = /^\/api\/handoffs\/([^/]+)\/log$/.exec(path);
  if (handoffLogMatch && method === "GET") {
    const job = handoffFor(handoffLogMatch[1] ?? "");
    if (!job) return json(response, 404, { error: "no such handoff" });
    const raw = url.searchParams.get("offset");
    const offset = raw === null ? 0 : Number(raw);
    if (!Number.isInteger(offset) || offset < 0) {
      return json(response, 400, { error: "offset must be a non-negative integer" });
    }
    const text = existsSync(job.logPath) ? readFileSync(job.logPath, "utf8") : "";
    const start = Math.min(offset, text.length);
    return json(response, 200, {
      text: text.slice(start),
      next: text.length,
      status: job.status,
      running: job.status === "running",
      prUrl: job.prUrl,
    });
  }

  const handoffStopMatch = /^\/api\/handoffs\/([^/]+)\/stop$/.exec(path);
  if (handoffStopMatch && method === "POST") {
    return stopHandoff(handoffStopMatch[1] ?? "", response);
  }

  if (path === "/api/runs") {
    if (method === "GET") return json(response, 200, listRuns());
    if (method === "POST") return startRun(request, response);
    return json(response, 405, { error: "GET or POST" });
  }

  const eventMatch = /^\/api\/runs\/([^/]+)\/events$/.exec(path);
  if (eventMatch && method === "GET") {
    const id = eventMatch[1] ?? "";
    const record = recordFor(id);
    if (!record) return json(response, 404, { error: `no run "${id}"` });
    const raw = url.searchParams.get("offset");
    const offset = raw === null ? 0 : Number(raw);
    if (!Number.isInteger(offset) || offset < 0) {
      return json(response, 400, { error: "offset must be a non-negative integer" });
    }
    const rows = readRows(record.tracePath);
    const slice = rows.slice(offset);
    return json(response, 200, {
      rows: slice,
      next: offset + slice.length,
      running: record.running,
      exitCode: record.exitCode,
    });
  }

  const summaryMatch = /^\/api\/runs\/([^/]+)\/summary$/.exec(path);
  if (summaryMatch && method === "GET") {
    const id = summaryMatch[1] ?? "";
    const record = recordFor(id);
    if (!record) return json(response, 404, { error: `no run "${id}"` });
    if (!existsSync(record.resultPath)) {
      return json(response, 404, { error: "the run has not finished" });
    }
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(readFileSync(record.resultPath, "utf8"));
    return;
  }

  const traceMatch = /^\/runs\/([^/]+)\/trace\.jsonl$/.exec(path);
  if (traceMatch && method === "GET") {
    const id = traceMatch[1] ?? "";
    const record = recordFor(id);
    if (!record || !existsSync(record.tracePath)) {
      return text(response, 404, "not found");
    }
    response.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    });
    createReadStream(record.tracePath).pipe(response);
    return;
  }

  return json(response, 404, { error: `no route for ${method} ${path}` });
};

const printUsage = (): void => {
  console.log(`CUSTODY dashboard

  bun src/server.ts                 serve http://localhost:${DEFAULT_PORT}
  bun src/server.ts --port 0        bind an ephemeral port and print the URL
  bun src/server.ts --replay <t>    start with a saved trace loaded
  bun src/server.ts --help          this text

  CUSTODY_WINDOW_MS  passed through to the child run when set
`);
};

const argv = process.argv.slice(2);
let port = DEFAULT_PORT;

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (!arg) continue;
  if (arg === "--port" || arg.startsWith("--port=")) {
    const value = arg === "--port" ? argv[(index += 1)] : arg.slice("--port=".length);
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
      console.error(`custody dashboard: --port needs a number in 0..65535, got "${value ?? ""}"`);
      process.exit(2);
    }
    port = parsed;
  } else if (arg === "--replay" || arg.startsWith("--replay=")) {
    const value = arg === "--replay" ? argv[(index += 1)] : arg.slice("--replay=".length);
    if (!value) {
      console.error("custody dashboard: --replay needs a trace path");
      process.exit(2);
    }
    const full = resolve(value);
    if (!existsSync(full) || !statSync(full).isFile()) {
      console.error(`custody dashboard: no trace at ${full}`);
      process.exit(2);
    }
    replayPath = full;
  } else if (arg === "--help" || arg === "-h") {
    printUsage();
    process.exit(0);
  } else {
    console.error(`custody dashboard: unknown argument "${arg}"`);
    printUsage();
    process.exit(2);
  }
}

mkdirSync(RUNS, { recursive: true });

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    if (response.headersSent) {
      response.end();
      return;
    }
    json(response, 500, { error: messageOf(error) });
  });
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const actual = typeof address === "object" && address ? address.port : port;
  console.log(`\n  CUSTODY dashboard  http://127.0.0.1:${actual}\n`);
  if (replayPath) console.log(`  replay  ${replayPath}\n`);
});

const shutdown = (): void => {
  if (active?.running) active.child?.kill("SIGTERM");
  server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
