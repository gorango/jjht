#!/usr/bin/env bun
/**
 * Build a static, replay-only copy of the dashboard for Vercel.
 *
 * It runs the ten scenarios through the real CLI, copies each trace and the
 * summary the page needs, adds the committed Docker recording, and writes an
 * index.html with window.CUSTODY_REPLAY set. No server, Docker, baro or key is
 * needed at runtime.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isAllowedEffect } from "../src/eval/harm.js";
import type { TraceRow } from "../src/handoff/from-trace.js";
import { scenarioById } from "../src/scenarios/index.js";
import { SCENARIOS } from "../src/scenarios/index.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(PACKAGE_ROOT, "vercel");
const DATA = resolve(OUT, "data");
const RUNS = resolve(PACKAGE_ROOT, "runs");
const DOCKER_TRACE = resolve(
  PACKAGE_ROOT,
  "recordings/docker-2026-10-31/trace.jsonl",
);
const DOCKER_ID = "docker-2026-10-31";

interface RunItem {
  runId: string;
  scenario: string;
  adapter: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  pass: boolean | null;
  state: "done";
}

const readTrace = (file: string): TraceRow[] => {
  const rows: TraceRow[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim()) rows.push(JSON.parse(line) as TraceRow);
  }
  return rows;
};

const summarizeDocker = (rows: TraceRow[], tracePath: string): Record<string, unknown> => {
  const scenario = scenarioById("money");
  if (!scenario) throw new Error("money fixture missing");
  const first = new Map<string, any>();
  const executed: Array<Record<string, unknown>> = [];
  const windows: Array<Record<string, unknown>> = [];
  let closed = false;
  for (const row of rows) {
    const payload = row.payload ?? {};
    if (row.type === "decision.made" && payload.decision && !first.has(payload.decision.intentId)) {
      first.set(payload.decision.intentId, payload.decision);
    } else if (row.type === "window.closed") {
      windows.push({
        windowId: payload.windowId,
        inflight: payload.inflight,
        loopIds: payload.loopIds,
        lateByMs: payload.lateByMs,
      });
    } else if (row.type === "action.executed") {
      const intent = payload.intent ?? {};
      const target = intent.target ?? {};
      const params = intent.params ?? {};
      executed.push({
        intentId: intent.id,
        agent: intent.agent,
        action: intent.action,
        targetKind: target.kind,
        targetId: target.id,
        params,
        path: payload.path,
        harmful: !isAllowedEffect(
          { action: intent.action, target: { kind: target.kind, id: target.id }, params },
          scenario.allowedEffects,
        ),
      });
    } else if (row.type === "incident.closed") {
      closed = true;
    }
  }
  const decisions = [...first.values()];
  const expected = Object.entries(scenario.expected);
  const expectedMatches = expected.filter(
    ([id, kind]) => first.get(id)?.kind === kind,
  ).length;
  const harmful = executed.filter((effect) => effect.harmful);
  return {
    runId: DOCKER_ID,
    scenario: "money",
    title: scenario.title,
    adapter: "docker",
    tracePath,
    startedAt: rows[0]?.at ?? "",
    finishedAt: rows.at(-1)?.at ?? null,
    windowMs: 1500,
    exitCode: 0,
    expectedMatches,
    expectedTotal: expected.length,
    executed,
    executedCount: executed.length,
    harmful,
    harmfulCount: harmful.length,
    inflightMax: Math.max(0, ...windows.map((w) => Number(w.inflight) || 0)),
    windows,
    windowLoopIds: [...new Set(windows.flatMap((w) => (w.loopIds as string[]) ?? []))],
    decisions,
    closed,
    noAction: null,
    error: null,
    pass:
      expectedMatches === expected.length &&
      harmful.length === 0 &&
      closed,
  };
};

const urlFrom = async (proc: ReturnType<typeof Bun.spawn>, timeoutMs = 10_000): Promise<string> => {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const match = /http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/.exec(buffer);
    if (match) {
      reader.releaseLock();
      return `http://127.0.0.1:${match[1]}`;
    }
  }
  throw new Error(`server did not print a URL: ${buffer}`);
};

const drain = (stream: ReadableStream<Uint8Array>): void => {
  void (async () => {
    const reader = stream.getReader();
    for (;;) {
      const { done } = await reader.read();
      if (done) return;
    }
  })();
};

const main = async (): Promise<void> => {
  rmSync(DATA, { recursive: true, force: true });
  rmSync(join(OUT, "node_modules"), { recursive: true, force: true });
  rmSync(join(OUT, "package.json"), { force: true });
  mkdirSync(DATA, { recursive: true });

  const server = Bun.spawn({
    cmd: ["bun", "src/server.ts", "--port", "0"],
    cwd: PACKAGE_ROOT,
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  drain(server.stderr as ReadableStream<Uint8Array>);
  const base = await urlFrom(server);

  const runs: RunItem[] = [];
  try {
    const scenarios = (await fetch(`${base}/api/scenarios`).then((response) =>
      response.json(),
    )) as Array<{ id: string }>;
    writeFileSync(join(DATA, "scenarios.json"), `${JSON.stringify(scenarios, null, 2)}\n`);

    for (const scenario of SCENARIOS) {
      const started = await fetch(`${base}/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: scenario.id }),
      }).then((response) => response.json());
      const runId = started.runId as string;

      let running = true;
      while (running) {
        const page = (await fetch(
          `${base}/api/runs/${encodeURIComponent(runId)}/events?offset=0`,
        ).then((response) => response.json())) as { running: boolean };
        running = page.running;
        if (running) await Bun.sleep(200);
      }

      const summary = (await fetch(
        `${base}/api/runs/${encodeURIComponent(runId)}/summary`,
      ).then((response) => response.json())) as Record<string, unknown>;
      const dir = join(DATA, "runs", runId);
      mkdirSync(dir, { recursive: true });
      cpSync(join(RUNS, runId, "trace.jsonl"), join(dir, "trace.jsonl"));
      summary.tracePath = `data/runs/${runId}/trace.jsonl`;
      writeFileSync(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

      runs.push({
        runId,
        scenario: scenario.id,
        adapter: String(summary.adapter ?? "sim"),
        startedAt: String(summary.startedAt ?? ""),
        finishedAt: summary.finishedAt ? String(summary.finishedAt) : null,
        exitCode: typeof summary.exitCode === "number" ? summary.exitCode : null,
        pass: typeof summary.pass === "boolean" ? summary.pass : null,
        state: "done",
      });
      console.log(`ok ${scenario.id} -> ${runId}`);
    }

    if (existsSync(DOCKER_TRACE)) {
      const dir = join(DATA, "runs", DOCKER_ID);
      mkdirSync(dir, { recursive: true });
      cpSync(DOCKER_TRACE, join(dir, "trace.jsonl"));
      const summary = summarizeDocker(
        readTrace(DOCKER_TRACE),
        `data/runs/${DOCKER_ID}/trace.jsonl`,
      );
      writeFileSync(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
      runs.push({
        runId: DOCKER_ID,
        scenario: "money",
        adapter: "docker",
        startedAt: String(summary.startedAt ?? ""),
        finishedAt: summary.finishedAt ? String(summary.finishedAt) : null,
        exitCode: 0,
        pass: Boolean(summary.pass),
        state: "done",
      });
      console.log(`ok docker recording -> ${DOCKER_ID}`);
    }

    writeFileSync(join(DATA, "runs.json"), `${JSON.stringify(runs, null, 2)}\n`);

    const page = readFileSync(join(PACKAGE_ROOT, "public/dashboard.html"), "utf8")
      .replace("<title>CUSTODY — live run</title>", "<title>CUSTODY — replay</title>")
      .replace("<script>", "<script>window.CUSTODY_REPLAY = true;</script>\n<script>");
    writeFileSync(join(OUT, "index.html"), page);
    writeFileSync(
      join(OUT, "vercel.json"),
      `${JSON.stringify(
        {
          $schema: "https://openapi.vercel.sh/vercel.json",
          framework: null,
          installCommand: "echo no install",
          buildCommand: "echo no build",
          outputDirectory: ".",
          cleanUrls: true,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT, "README.md"),
      `# CUSTODY replay-only deploy

Static copy of the dashboard. No server, Docker, baro, or API key is needed at runtime.

This is a static upload. Vercel has nothing to install or build; \`vercel.json\` disables both.

## Build

From \`packages/custody\`:

\`\`\`bash
bun run vercel:build
\`\`\`

## Deploy

From this directory:

\`\`\`bash
npx vercel --prod
\`\`\`

Or connect the repository in Vercel and set the project root to
\`packages/custody/vercel\`. The generated \`index.html\` and \`data/\` must be committed
for a repository-connected deploy.

The page loads \`data/scenarios.json\`, \`data/runs.json\`, and one
\`data/runs/<id>/trace.jsonl\` plus \`summary.json\` per run.
`,
    );

    console.log(`wrote ${OUT}`);
    console.log(`deploy: cd ${OUT} && npx vercel --prod`);
  } finally {
    server.kill();
  }
};

main().catch((error: unknown) => {
  console.error(`build-vercel: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
