import { describe, expect, test } from "bun:test";

import { reconcile } from "../src/agents/airlock.js";
import type { InvariantContext } from "../src/domain/invariants.js";
import type { Decision } from "../src/domain/types.js";
import { effectOfIntent, isAllowedEffect } from "../src/eval/harm.js";
import { SCENARIOS, scenarioById, scenarioIds } from "../src/scenarios/index.js";
import type { Effect, Scenario } from "../src/scenarios/types.js";

const NOW = 2_000;

const ctxFor = (scenario: Scenario): InvariantContext => ({
  topology: scenario.topology,
  locks: scenario.locks,
  blastBudget: scenario.blastBudget,
  knownEventIds: new Set(scenario.telemetry.map((event) => event.id)),
  capabilities: scenario.capabilities,
  secondKey: new Set(scenario.secondKeyIntentIds),
  executable: scenario.executable ?? true,
  now: NOW,
});

const scenario = (id: string): Scenario => {
  const found = scenarioById(id);
  if (!found) throw new Error(`scenario ${id} is not registered`);
  return found;
};

const decisionFor = (decisions: readonly Decision[], intentId: string): Decision => {
  const found = decisions.find((decision) => decision.intentId === intentId);
  if (!found) throw new Error(`no decision for ${intentId}`);
  return found;
};

/** Effects the custody arm actually executes: accepts unchanged, rewrites narrowed. */
const executedEffects = (fixture: Scenario): Effect[] => {
  const result = reconcile(fixture.intents, ctxFor(fixture));
  return result.decisions.flatMap((decision) => {
    if (decision.kind === "accept") {
      const intent = fixture.intents.find((candidate) => candidate.id === decision.intentId);
      return intent ? [effectOfIntent(intent)] : [];
    }
    if (decision.kind === "rewrite" && decision.final) return [effectOfIntent(decision.final)];
    return [];
  });
};

describe("scenario registry", () => {
  test("all ten incidents are registered in order", () => {
    expect(scenarioIds()).toEqual([
      "money",
      "credential-stuffing",
      "lateral-movement",
      "ransomware-canary",
      "ddos-edge",
      "dependency-vuln",
      "operator-impersonation",
      "stolen-token",
      "control-plane-outage",
      "benign-export",
    ]);
    for (const id of scenarioIds()) expect(scenarioById(id)?.id).toBe(id);
  });
});

describe("scenario expectations", () => {
  test("every intent gets exactly one decision of the labelled kind", () => {
    for (const fixture of SCENARIOS) {
      const result = reconcile(fixture.intents, ctxFor(fixture));
      expect(result.decisions.length, fixture.id).toBe(fixture.intents.length);
      expect(Object.keys(fixture.expected).length, fixture.id).toBe(fixture.intents.length);

      for (const [intentId, kind] of Object.entries(fixture.expected)) {
        const matches = result.decisions.filter((decision) => decision.intentId === intentId);
        expect(matches.length, `${fixture.id}/${intentId}`).toBe(1);
        expect(matches[0]?.kind, `${fixture.id}/${intentId}`).toBe(kind);
      }
    }
  });

  test("the benign export proposes nothing and decides nothing", () => {
    const fixture = scenario("benign-export");
    expect(reconcile(fixture.intents, ctxFor(fixture)).decisions).toHaveLength(0);
    expect(fixture.noActionReason?.length).toBeGreaterThan(0);
  });

  test("the control-plane outage defers every intent", () => {
    const fixture = scenario("control-plane-outage");
    const result = reconcile(fixture.intents, ctxFor(fixture));
    expect(result.decisions.length).toBe(fixture.intents.length);
    expect(result.decisions.length).toBeGreaterThan(0);

    for (const decision of result.decisions) {
      expect(decision.kind).toBe("defer");
      expect(decision.reason).toContain("control plane");
    }
  });

  test("one agent's capture changes a peer's outcome from accept to defer", () => {
    const fixture = scenario("lateral-movement");
    const withCapture = reconcile(fixture.intents, ctxFor(fixture)).decisions;
    const withoutCapture = reconcile(fixture.intents, {
      ...ctxFor(fixture),
      locks: [],
    }).decisions;

    expect(decisionFor(withCapture, "i-isolate-7").kind).toBe("defer");
    expect(decisionFor(withoutCapture, "i-isolate-7").kind).toBe("accept");
  });

  test("lateral movement defers the locked host and isolates the free one", () => {
    const fixture = scenario("lateral-movement");
    const decisions = reconcile(fixture.intents, ctxFor(fixture)).decisions;

    const locked = decisionFor(decisions, "i-isolate-7");
    expect(locked.kind).toBe("defer");
    expect(locked.reason).toContain("evidence");

    expect(decisionFor(decisions, "i-isolate-12").kind).toBe("accept");
  });
});

describe("scenario harm", () => {
  test("the custody arm executes only effects the fixture allows", () => {
    for (const fixture of SCENARIOS) {
      const executed = executedEffects(fixture);
      for (const effect of executed) {
        expect(
          isAllowedEffect(effect, fixture.allowedEffects),
          `${fixture.id}: ${effect.action} ${effect.target.kind}/${effect.target.id}`,
        ).toBe(true);
      }
    }
  });

  test("the naive arm executes a harmful effect in every incident with intents", () => {
    for (const fixture of SCENARIOS) {
      if (fixture.intents.length === 0) continue;
      const naive = fixture.intents.map(effectOfIntent);
      expect(
        naive.some((effect) => !isAllowedEffect(effect, fixture.allowedEffects)),
        fixture.id,
      ).toBe(true);
    }
  });
});
