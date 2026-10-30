import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dir, "..");

interface RunResult {
  status: number | null;
  output: string;
  runId: string;
  lines: Array<{ type: string; producer: string; summary: string; data?: any }>;
  summary: any;
  portfolio: string;
}

const runMock = (args: string[]): RunResult => {
  const result = spawnSync(process.execPath, ["src/index.ts", "run", ...args], {
    cwd: ROOT,
    env: { ...process.env, MOCK: "1" },
    encoding: "utf8",
    timeout: 30_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const match = /trace\s+runs\/([^\s]+)\/trace\.jsonl/.exec(output);
  assert.ok(match, `no run directory in output:\n${output.slice(-2000)}`);
  const runId = match[1]!;
  const lines = readFileSync(resolve(ROOT, "runs", runId, "trace.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    status: result.status,
    output,
    runId,
    lines,
    summary: JSON.parse(readFileSync(resolve(ROOT, "runs", runId, "run.json"), "utf8")).summary,
    portfolio: readFileSync(resolve(ROOT, "runs", runId, "portfolio.md"), "utf8"),
  };
};

test("a slow worker loses its lease: expiry and reclaim are traceable and the write is discarded", () => {
  const run = runMock([
    "--companies=1",
    "--challenges=1",
    "--lease-ttl=80",
    "--chaos=slow-worker",
  ]);
  assert.equal(run.status, 0, run.output.slice(-3000));

  const types = run.lines.map((line) => line.type);
  assert.ok(types.includes("lease.expired"), "missing lease.expired");
  assert.ok(types.includes("task.reclaimed"), "missing task.reclaimed");
  assert.ok(types.includes("task.discarded"), "missing task.discarded");

  // The item is finished exactly once even though the writer was called twice.
  assert.equal(run.summary.approved, 1);
  assert.equal(run.summary.portfolio, 1);
  assert.equal((run.portfolio.match(/^## \d+\. /gm) ?? []).length, 1);

  const writerCalls = run.lines.filter(
    (line) => line.type === "task.measured" && line.data === undefined && /writer P-/.test(line.summary),
  );
  assert.ok(writerCalls.length >= 3, "the duplicate writer turn should be measured in the trace");
});

test("the run drains with the Scheduler removed after boot", () => {
  const run = runMock(["--companies=1", "--challenges=1", "--scheduler=off-after-boot"]);
  assert.equal(run.status, 0, run.output.slice(-3000));

  const schedulerLeft = run.lines.findIndex(
    (line) => line.type === "participant.left" && /Scheduler/.test(line.summary),
  );
  const portfolioReady = run.lines.findIndex((line) => line.type === "portfolio.ready");
  assert.ok(schedulerLeft >= 0, "Scheduler never left");
  assert.ok(portfolioReady > schedulerLeft, "portfolio was decided before the Scheduler left");
  assert.equal(run.summary.challenges, 1);
  assert.equal(run.summary.approved, 1);
  assert.equal(run.summary.portfolio, 1);

  const completed = run.lines.find((line) => line.type === "run.completed");
  assert.equal(completed?.producer, "Watchdog");
});
