#!/usr/bin/env bun
/**
 * CUSTODY — scaffold CLI.
 *
 * Today this replays the money scenario through the real airlock and the real
 * invariants. No model is called and no infrastructure is touched: the point of
 * this slice is to prove the decision core is deterministic and testable before
 * any agent is wired to it.
 */
import { reconcile, summarize } from "./agents/airlock.js";
import type { InvariantContext } from "./domain/invariants.js";
import { failures } from "./domain/invariants.js";
import { moneyScenario } from "./scenarios/money.js";

const args = process.argv.slice(2);
const command = args[0] ?? "demo";
const verbose = args.includes("--verbose");

const pad = (value: string, width: number): string =>
  value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);

const help = (): void => {
  console.log(`custody — scaffold

  bun run demo            replay the money scenario through the airlock
  bun run demo --verbose  include every invariant check, not just failures
  bun test                unit + scenario tests
  bun run typecheck       tsc --noEmit
`);
};

const demo = (): number => {
  const scenario = moneyScenario;

  const ctx: InvariantContext = {
    topology: scenario.topology,
    locks: scenario.locks,
    blastBudget: scenario.blastBudget,
    knownEventIds: new Set(scenario.telemetry.map((event) => event.id)),
    capabilities: scenario.capabilities,
    secondKey: new Set(),
    now: 2_000,
  };

  const result = reconcile(scenario.intents, ctx);

  console.log(`\nCUSTODY — airlock replay`);
  console.log(`scenario: ${scenario.title}`);
  console.log(`${scenario.story}\n`);

  const header = ["intent", "agent", "action", "target", "decision", "reason"];
  const rows = result.decisions.map((decision) => [
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
  console.log(widths.map((width) => "─".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(row.map((cell, column) => pad(cell, widths[column] ?? cell.length)).join("  "));
  }

  console.log(`\nairlock: ${summarize(result)}`);

  const breachCount = result.findings.filter((finding) => !finding.ok).length;
  console.log(`invariant breaches intercepted: ${breachCount}`);

  for (const decision of result.decisions) {
    if (decision.kind === "rewrite" && decision.final) {
      console.log(
        `rewrite ${decision.intentId}: ${String(scenario.intents.find((i) => i.id === decision.intentId)?.params.cidr ?? "?")} ` +
          `→ ${String(decision.final.params.cidr ?? decision.final.target.id)}`,
      );
    }
  }

  if (verbose) {
    console.log("\nall invariant failures:");
    for (const decision of result.decisions) {
      const intent = scenario.intents.find((candidate) => candidate.id === decision.intentId);
      if (!intent) continue;
      const bad = failures(result.findings.filter((finding) => finding.intentId === intent.id));
      for (const finding of bad) console.log(`  ${intent.id}  ${finding.code.padEnd(14)} ${finding.detail}`);
    }
  }

  const expected = scenario.expected;
  const mismatches = result.decisions.filter((decision) => expected[decision.intentId] !== decision.kind);
  if (mismatches.length === 0) {
    console.log(`\nexpected outcomes: ${result.decisions.length}/${result.decisions.length} match\n`);
    return 0;
  }

  console.log(`\nexpected outcomes: ${result.decisions.length - mismatches.length}/${result.decisions.length} match`);
  for (const decision of mismatches) {
    console.log(`  ${decision.intentId}: expected ${expected[decision.intentId]}, got ${decision.kind}`);
  }
  return 1;
};

if (command === "help" || command === "--help" || command === "-h") {
  help();
} else if (command === "demo") {
  process.exitCode = demo();
} else {
  console.error(`unknown command: ${command}`);
  help();
  process.exitCode = 2;
}
