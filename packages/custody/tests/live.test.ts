import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { moneyScenario } from "../src/scenarios/money.js";
import { SCENARIOS } from "../src/scenarios/index.js";

interface Row {
  at: string;
  producerId: string;
  type: string;
  loopId?: string;
  payload: any;
}

const root = resolve(import.meta.dir, "..");
const traces: string[] = [];

const tempTrace = (name: string): string => {
  const file = join(tmpdir(), `custody-${name}-${crypto.randomUUID()}.jsonl`);
  traces.push(file);
  return file;
};

const cli = (args: readonly string[], trace: string) => {
  const result = Bun.spawnSync({
    cmd: ["bun", "src/index.ts", ...args],
    cwd: root,
    env: { ...process.env, CUSTODY_WINDOW_MS: "120", CUSTODY_TRACE: trace },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

const rowsOf = (trace: string): Row[] =>
  readFileSync(trace, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Row);

afterAll(() => {
  for (const trace of traces) rmSync(trace, { force: true });
});

describe("the live run", () => {
  test(
    "money: real loops, a held window, and the five expected decisions",
    () => {
      const trace = tempTrace("money");
      const result = cli([], trace);

      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain("runner: mock  costUsd: 0");
      expect(result.stdout).toContain("expected outcomes: 5/5 match");

      const inflight = /INFLIGHT (\d+) \(>= 2 required\)/.exec(result.stdout);
      expect(inflight, result.stdout).not.toBeNull();
      expect(Number(inflight?.[1])).toBeGreaterThanOrEqual(2);

      expect(existsSync(trace)).toBe(true);
      const rows = rowsOf(trace);
      expect(rows.length).toBeGreaterThan(20);

      const types = new Set(rows.map((row) => row.type));
      for (const type of [
        "interception.started",
        "interception.finished",
        "intent.proposed",
        "window.closed",
        "decision.made",
        "action.executed",
      ]) {
        expect(types.has(type), type).toBe(true);
      }

      const decisions = new Map<string, string>();
      for (const row of rows.filter((row) => row.type === "decision.made")) {
        if (!decisions.has(row.payload.decision.intentId)) {
          decisions.set(row.payload.decision.intentId, row.payload.decision.kind);
        }
      }
      expect(Object.fromEntries(decisions)).toEqual(moneyScenario.expected);

      expect(rows.some((row) => row.type === "evidence.locked" && row.producerId === "preserve-1")).toBe(true);
      expect(rows.some((row) => row.type === "decision.made" && row.producerId === "airlock")).toBe(true);

      const closed = rows.find((row) => row.type === "window.closed");
      expect(closed).toBeDefined();
      const held = closed?.payload as { inflight: number; loopIds: string[] };
      expect(held.inflight).toBeGreaterThanOrEqual(2);
      expect(new Set(held.loopIds).size).toBeGreaterThanOrEqual(2);
    },
    20_000,
  );

  for (const scenario of SCENARIOS) {
    const alias = scenario.id === "benign-export" ? "benign" : scenario.id;
    test(
      `${scenario.id}: the live run matches the committed expectation`,
      () => {
        const trace = tempTrace(scenario.id);
        const result = cli(["--scenario", alias], trace);

        expect(result.code, result.stderr).toBe(0);
        if (scenario.intents.length === 0) {
          expect(result.stdout).toContain("NO ACTION: ");
          expect(result.stdout).toContain("effects executed: 0");
        } else {
          expect(result.stdout).toContain(
            `expected outcomes: ${scenario.intents.length}/${scenario.intents.length} match`,
          );
        }
      },
      20_000,
    );
  }

  test(
    "benign: closes with no action and executes nothing",
    () => {
      const trace = tempTrace("benign");
      const result = cli(["--scenario", "benign"], trace);

      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain("NO ACTION: ");
      expect(result.stdout).toContain("effects executed: 0");

      const rows = rowsOf(trace);
      expect(rows.some((row) => row.type === "incident.closed")).toBe(true);
      expect(rows.some((row) => row.type === "action.executed")).toBe(false);
      expect(rows.some((row) => row.type === "decision.made")).toBe(false);
    },
    20_000,
  );
});
