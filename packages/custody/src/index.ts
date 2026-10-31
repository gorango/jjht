#!/usr/bin/env bun
/**
 * CUSTODY - the live run.
 *
 * Every decision below came from the airlock's window over suspended Mozaik
 * loops. Inference is scripted (`runner: mock`, `costUsd: 0`); the bus, the
 * participants, the interception and the state mutations are real.
 */
import { resolve } from "node:path";

import type { ScenarioReport } from "./agents/scheduler.js";
import { isAllowedEffect } from "./eval/harm.js";
import type { Decision } from "./domain/types.js";
import type { AdapterKind } from "./infra/adapter.js";
import { run } from "./run.js";

const DEFAULT_WINDOW_MS = 1_500;

const pad = (value: string, width: number): string =>
  value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);

const help = (): void => {
  console.log(`custody - live incident response, offline

  bun src/index.ts                  run the money scenario through the real runtime
  bun src/index.ts --scenario <id>  run a named scenario
  bun src/index.ts --adapter <sim|docker>
                                    sim is the deterministic twin; docker needs the Compose stack
  bun src/index.ts --trace <path>   write the JSONL trace to a path
  bun src/index.ts --verbose        print every invariant finding and veto
  bun src/index.ts help             this text

  CUSTODY_WINDOW_MS    decision window in milliseconds (default ${DEFAULT_WINDOW_MS})
  CUSTODY_TRACE        trace path (default ./trace.jsonl)
  CUSTODY_EVIDENCE_DIR evidence root for the Docker adapter (default ./evidence)
  CUSTODY_DOCKER_PROJECT  compose project name (default custody-docker)

  exit 0 requires the expected decisions, INFLIGHT >= 2 with distinct loop ids,
  and the trace file. The offline runner is labelled mock with costUsd 0.
`);
};

const windowMs = (): number | undefined => {
  const raw = process.env.CUSTODY_WINDOW_MS;
  if (!raw) return DEFAULT_WINDOW_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`custody: CUSTODY_WINDOW_MS must be a positive number, got "${raw}"`);
    return undefined;
  }
  return parsed;
};

const tracePath = (flag: string | undefined): string => {
  const raw = flag ?? process.env.CUSTODY_TRACE;
  return resolve(raw && raw.trim().length > 0 ? raw : "trace.jsonl");
};

const printAdapter = (report: ScenarioReport): void => {
  console.log(`adapter: ${report.adapter}`);
  if (report.failed.length > 0) {
    const detail = report.failed
      .map((failed) => `${failed.intentId} (${failed.reason})`)
      .join("; ");
    console.log(`failed actions: ${report.failed.length} - ${detail}`);
  }
  for (const anchor of report.evidence) {
    console.log(`recording: ${anchor.bundle}`);
    console.log(`anchor: ${anchor.anchor}`);
  }
};

const printTable = (decisions: readonly Decision[]): void => {
  const header = ["intent", "agent", "action", "target", "decision", "reason"];
  const rows = decisions.map((decision) => [
    decision.intentId,
    decision.agent,
    decision.action,
    decision.target,
    decision.kind.toUpperCase(),
    decision.reason,
  ]);

  const widths = header.map((title, column) =>
    Math.min(52, Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0))),
  );

  console.log(header.map((title, column) => pad(title, widths[column] ?? title.length)).join("  "));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(row.map((cell, column) => pad(cell, widths[column] ?? cell.length)).join("  "));
  }
};

const printVerbose = (report: ScenarioReport): void => {
  console.log("\nfindings:");
  if (report.findings.length === 0) console.log("  (none)");
  for (const finding of report.findings) {
    console.log(
      `  ${finding.intentId.padEnd(14)} ${finding.code.padEnd(15)} ` +
        `${finding.ok ? "ok  " : "FAIL"} ${finding.detail}`,
    );
  }

  console.log("votes:");
  let votes = 0;
  for (const decision of report.decisions) {
    for (const vote of decision.votes) {
      votes += 1;
      console.log(`  ${decision.intentId}  ${vote.voter}: ${vote.verdict} - ${vote.reason}`);
    }
  }
  if (votes === 0) console.log("  (none)");
};

const printMoney = (report: ScenarioReport, verbose: boolean): number => {
  console.log(`\nCUSTODY - live run`);
  console.log(`scenario: ${report.scenario.id} - ${report.scenario.title}`);
  console.log(`${report.scenario.story}\n`);

  printTable(report.decisions);

  console.log(`\nrunner: ${report.runner}  costUsd: ${report.costUsd}`);
  for (const window of report.windows) {
    console.log(
      `window ${window.windowId} INFLIGHT ${window.inflight} ` +
        `loops ${window.loopIds.map((id) => id.slice(0, 8)).join(", ") || "(none)"}`,
    );
  }
  console.log(
    report.scenario.id === "money"
      ? `INFLIGHT ${report.inflightMax} (>= 2 required)`
      : `INFLIGHT ${report.inflightMax}`,
  );
  console.log(`expected outcomes: ${report.expectedMatches}/${report.expectedTotal} match`);
  console.log(`effects executed: ${report.executed.length}`);
  printAdapter(report);
  console.log(`trace: ${report.tracePath}`);

  if (verbose) printVerbose(report);

  const reasons: string[] = [];
  if (report.expectedMatches !== report.expectedTotal) {
    reasons.push(`expected ${report.expectedTotal} matching decisions, got ${report.expectedMatches}`);
  }
  if (report.scenario.id === "money") {
    if (report.inflightMax < 2) reasons.push(`INFLIGHT ${report.inflightMax} is below 2`);
    const joint = report.windows.some(
      (window) => window.inflight >= 2 && new Set(window.loopIds).size >= 2,
    );
    if (!joint) reasons.push("no single window held two distinct loops");
  }
  const harmful = report.executed.filter(
    (effect) =>
      !isAllowedEffect(
        { action: effect.action, target: effect.target, params: effect.params },
        report.scenario.allowedEffects,
      ),
  );
  if (harmful.length > 0) {
    reasons.push(`${harmful.length} executed effects are outside allowedEffects`);
  }
  if (report.traceEvents < 20) reasons.push(`trace has ${report.traceEvents} events`);
  if (!report.closed) reasons.push("the incident did not close");
  if (report.adapter === "docker") {
    // A failed scale may fail closed by contract; every other allowed effect
    // is required, and a run with no anchored bundle did not capture evidence.
    const required = report.scenario.allowedEffects.filter((effect) => effect.action !== "scale");
    const missing = required.filter(
      (constraint) =>
        !report.executed.some((effect) =>
          isAllowedEffect(
            { action: effect.action, target: effect.target, params: effect.params },
            [constraint],
          ),
        ),
    );
    if (missing.length > 0) {
      reasons.push(
        `docker adapter did not execute ${missing.map((effect) => `${effect.action}:${effect.targetId}`).join(", ")}`,
      );
    }
    const wantsSnapshot = required.some((effect) => effect.action === "snapshot");
    if (wantsSnapshot && report.evidence.length === 0) {
      reasons.push("docker adapter produced no evidence bundle");
    }
  }

  if (reasons.length > 0) {
    for (const reason of reasons) console.error(`custody: FAIL: ${reason}`);
    return 1;
  }
  return 0;
};

const printNoAction = (report: ScenarioReport, verbose: boolean): number => {
  const reason =
    report.scenario.noActionReason ?? report.noActionOutcome ?? "(no reason recorded)";
  console.log(`\nCUSTODY - live run`);
  console.log(`scenario: ${report.scenario.id} - ${report.scenario.title}`);
  console.log(`${report.scenario.story}\n`);
  console.log(`NO ACTION: ${reason}`);
  console.log(`effects executed: ${report.executed.length}`);
  console.log(`runner: ${report.runner}  costUsd: ${report.costUsd}`);
  printAdapter(report);
  console.log(`trace: ${report.tracePath}`);

  if (verbose) printVerbose(report);

  const reasons: string[] = [];
  if (!report.closed) reasons.push("the incident did not close with a reason");
  if (report.executed.length > 0) reasons.push(`${report.executed.length} effects executed`);
  if (report.traceEvents < 5) reasons.push(`trace has ${report.traceEvents} events`);

  if (reasons.length > 0) {
    for (const reason of reasons) console.error(`custody: FAIL: ${reason}`);
    return 1;
  }
  return 0;
};

const argv = process.argv.slice(2);
let command = "demo";
let scenarioId = "money";
let adapter: AdapterKind = "sim";
let traceFlag: string | undefined;
let verbose = false;
let bad = false;

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === undefined) continue;

  if (arg === "--verbose") {
    verbose = true;
    continue;
  }
  if (arg === "--adapter") {
    const value = argv[index + 1];
    if (value !== "sim" && value !== "docker") {
      console.error("custody: --adapter needs sim or docker");
      bad = true;
      break;
    }
    adapter = value;
    index += 1;
    continue;
  }
  if (arg.startsWith("--adapter=")) {
    const value = arg.slice("--adapter=".length);
    if (value !== "sim" && value !== "docker") {
      console.error("custody: --adapter needs sim or docker");
      bad = true;
      break;
    }
    adapter = value;
    continue;
  }
  if (arg === "--trace") {
    const value = argv[index + 1];
    if (!value) {
      console.error("custody: --trace needs a path");
      bad = true;
      break;
    }
    traceFlag = value;
    index += 1;
    continue;
  }
  if (arg.startsWith("--trace=")) {
    traceFlag = arg.slice("--trace=".length);
    continue;
  }
  if (arg === "--scenario") {
    const value = argv[index + 1];
    if (!value) {
      console.error("custody: --scenario needs an id");
      bad = true;
      break;
    }
    scenarioId = value;
    index += 1;
    continue;
  }
  if (arg.startsWith("--scenario=")) {
    scenarioId = arg.slice("--scenario=".length);
    continue;
  }
  if (arg === "help" || arg === "-h" || arg === "--help") {
    command = "help";
    continue;
  }
  if (arg === "demo" || arg === "run") {
    command = "demo";
    continue;
  }
  console.error(`custody: unknown argument "${arg}"`);
  bad = true;
  break;
}

if (bad) {
  help();
  process.exitCode = 2;
} else if (command === "help") {
  help();
} else {
  const ms = windowMs();
  if (ms === undefined) {
    process.exitCode = 2;
  } else {
    run({
      scenarioId,
      windowMs: ms,
      tracePath: tracePath(traceFlag),
      verbose,
      adapter,
      evidenceRoot: resolve(process.env.CUSTODY_EVIDENCE_DIR ?? "evidence"),
    })
      .then((report) => {
        const noAction = report.expectedTotal === 0;
        process.exitCode = noAction ? printNoAction(report, verbose) : printMoney(report, verbose);
      })
      .catch((error: unknown) => {
        console.error(`custody: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
      });
  }
}
