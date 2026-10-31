import type { Intent } from "../domain/types.js";
import type { Scenario } from "../scenarios/types.js";
import type { ScriptedCall, StepScript } from "./mock-runner.js";

/**
 * The scripted model output for one intent. `tainted` is included on purpose:
 * a model may claim its rationale is trusted, and the handler must ignore it.
 */
const callFor = (intent: Intent): ScriptedCall => ({
  name: "act",
  args: {
    intentId: intent.id,
    action: intent.action,
    target: intent.target,
    params: intent.params,
    ttlMs: intent.ttlMs,
    rationale: {
      eventId: intent.rationale.eventId,
      citedFields: intent.rationale.citedFields ?? [],
      ...(intent.rationale.note ? { note: intent.rationale.note } : {}),
      tainted: intent.rationale.tainted,
    },
  },
});

const lockCall = (intent: Intent): ScriptedCall => ({
  name: "lock_evidence",
  args: {
    targetId: intent.target.id,
    targetKind: intent.target.kind,
    reason: "capture in flight; hold the target",
    ttlMs: 10_000,
  },
});

const reportCall = (scenario: Scenario): ScriptedCall => {
  const telemetry = scenario.telemetry[0];
  return {
    name: "report_incident",
    args: {
      telemetryId: telemetry?.id ?? "",
      severity: scenario.intents.length > 0 ? "high" : "low",
      summary: scenario.noActionReason ?? scenario.title,
    },
  };
};

export const scriptsFor = (scenario: Scenario): StepScript[] => {
  const captures = new Set(scenario.locks.map((lock) => lock.targetId));
  const steps: StepScript[] = scenario.intents.map((intent, index) => ({
    stepId: `step-${intent.id}`,
    agentId: intent.agent,
    latencyMs: 10 + Math.min(index * 12, 70),
    calls:
      intent.action === "snapshot" && captures.has(intent.target.id)
        ? [lockCall(intent), callFor(intent)]
        : [callFor(intent)],
  }));

  steps.push({
    stepId: "watch",
    agentId: "watch",
    latencyMs: 15,
    calls: [reportCall(scenario)],
  });

  return steps;
};
