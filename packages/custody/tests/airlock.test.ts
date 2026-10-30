import { describe, expect, test } from "bun:test";

import { reconcile } from "../src/agents/airlock.js";
import { definitionOf } from "../src/domain/registry.js";
import type { InvariantContext } from "../src/domain/invariants.js";
import { moneyScenario } from "../src/scenarios/money.js";

const ctx = (): InvariantContext => ({
  topology: moneyScenario.topology,
  locks: moneyScenario.locks,
  blastBudget: moneyScenario.blastBudget,
  knownEventIds: new Set(moneyScenario.telemetry.map((event) => event.id)),
  capabilities: moneyScenario.capabilities,
  secondKey: new Set(),
  now: 2_000,
});

const byId = (id: string) => {
  const decision = reconcile(moneyScenario.intents, ctx()).decisions.find((row) => row.intentId === id);
  if (!decision) throw new Error(`no decision for ${id}`);
  return decision;
};

describe("the airlock", () => {
  test("decides the money scenario exactly as designed", () => {
    const result = reconcile(moneyScenario.intents, ctx());
    for (const decision of result.decisions) {
      expect(decision.kind, decision.intentId).toBe(moneyScenario.expected[decision.intentId] as never);
    }
    expect(result.counts).toEqual({ accept: 2, rewrite: 1, defer: 1, reject: 1 });
  });

  test("evidence outranks containment: the isolate is deferred, not executed", () => {
    const decision = byId("i-isolate");
    expect(decision.kind).toBe("defer");
    expect(decision.reason).toContain("evidence lock");
  });

  test("a too-wide block is narrowed rather than abandoned", () => {
    const decision = byId("i-block");
    expect(decision.kind).toBe("rewrite");
    expect(String(decision.final?.params.cidr)).toBe("203.0.113.9/32");
  });

  test("an injected instruction is rejected even though the agent holds the capability", () => {
    const result = reconcile(moneyScenario.intents, ctx());
    const decision = result.decisions.find((row) => row.intentId === "i-injected");
    expect(decision?.kind).toBe("reject");
    expect(decision?.reason).toContain("taint");

    const taint = result.findings.find((finding) => finding.intentId === "i-injected" && finding.code === "taint");
    expect(taint?.ok).toBe(false);
  });

  test("accepted actions stay inside the joint blast budget", () => {
    const result = reconcile(moneyScenario.intents, ctx());
    const spent = result.accepted.reduce(
      (total, intent) => total + definitionOf(intent.action).blastRadius(moneyScenario.topology, intent),
      0,
    );
    expect(result.accepted.length).toBe(3);
    expect(spent).toBeLessThanOrEqual(moneyScenario.blastBudget);
  });

  test("the decision order is arrival order, not author order", () => {
    const result = reconcile(moneyScenario.intents, ctx());
    expect(result.decisions.map((row) => row.intentId)).toEqual([
      "i-snapshot",
      "i-block",
      "i-isolate",
      "i-injected",
      "i-scale",
    ]);
  });
});
