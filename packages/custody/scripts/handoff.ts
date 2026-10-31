#!/usr/bin/env bun
/**
 * Generate the slow-loop artifacts from a saved money trace. The trace is the
 * source of truth, so this works on a CLI run or a dashboard run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildHandoff, type TraceRow } from "../src/handoff/from-trace.js";
import { scenarioById } from "../src/scenarios/index.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");

const valueOf = (argv: string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
};

const readTrace = (file: string): TraceRow[] => {
  const rows: TraceRow[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line) as TraceRow);
  }
  return rows;
};

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`handoff - turn a saved trace into an issue and a baro goal

  bun scripts/handoff.ts --trace <trace.jsonl> --out <dir>
  bun scripts/handoff.ts --trace trace.jsonl --out runs/handoff --baro
  bun scripts/handoff.ts ... --push     goal asks for a PR instead of a local commit
`);
    return;
  }

  const tracePath = resolve(PACKAGE_ROOT, valueOf(argv, "--trace") ?? "trace.jsonl");
  const out = resolve(PACKAGE_ROOT, valueOf(argv, "--out") ?? "runs/handoff");
  const push = argv.includes("--push");
  const runBaro = argv.includes("--baro");

  if (!existsSync(tracePath)) {
    console.error(`handoff: no trace at ${tracePath}`);
    process.exit(2);
  }

  const rows = readTrace(tracePath);
  const started = rows.find((row) => row.type === "run.started");
  const scenarioId =
    valueOf(argv, "--scenario") ?? String(started?.payload?.scenario ?? "");
  const scenario = scenarioById(scenarioId);
  if (!scenario) {
    console.error(`handoff: the trace names no known scenario (got "${scenarioId}")`);
    process.exit(2);
  }

  const vulnerablePath = resolve(REPO_ROOT, "modules/custody-scratch/src/checkout.ts");
  const vulnerableSource = existsSync(vulnerablePath)
    ? readFileSync(vulnerablePath, "utf8")
    : undefined;

  const handoff = buildHandoff(rows, scenario, tracePath, {
    push,
    ...(vulnerableSource ? { vulnerableSource } : {}),
  });

  mkdirSync(out, { recursive: true });
  const issuePath = resolve(out, "issue.md");
  const goalPath = resolve(out, "goal.txt");
  writeFileSync(issuePath, handoff.issue);
  writeFileSync(goalPath, handoff.goal);
  writeFileSync(
    resolve(out, "handoff.json"),
    `${JSON.stringify(
      {
        source: {
          scenario: handoff.source.scenario,
          incidentId: handoff.source.incidentId,
          tracePath: handoff.source.tracePath,
          evidenceIds: handoff.source.telemetry.map((event) => event.id),
          taintedIds: handoff.source.telemetry.filter((event) => event.tainted).map((event) => event.id),
          anchor: handoff.source.anchor ?? null,
          decisions: handoff.source.decisions.length,
          executed: handoff.source.executed.length,
        },
        files: { issue: issuePath, goal: goalPath },
      },
      null,
      2,
    )}\n`,
  );

  console.log(`handoff: ${handoff.source.scenario} ${handoff.source.incidentId}`);
  console.log(`  issue  ${issuePath}`);
  console.log(`  goal   ${goalPath}`);
  console.log(`  baro   bun run baro -- --goal ${goalPath}`);

  if (runBaro) {
    const child = Bun.spawn({
      cmd: ["bun", resolve(PACKAGE_ROOT, "scripts/baro-handoff.ts"), "--goal", goalPath],
      cwd: PACKAGE_ROOT,
      stdio: ["inherit", "inherit", "inherit"],
    });
    process.exit(await child.exited);
  }
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(`handoff: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
