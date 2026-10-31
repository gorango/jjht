/**
 * Scenario 9 — control-plane outage during containment.
 *
 * The incident is real, but nothing can execute while the control plane is
 * unreachable. Fail closed: every intent defers and none is counted as harm.
 */
import { demoTopology } from "../domain/topology.js";
import type { Scenario } from "./types.js";

export const controlPlaneOutageScenario: Scenario = {
  id: "control-plane-outage",
  title: "Control-plane outage during containment",
  story:
    "Egress to 203.0.113.9 is live while the Kubernetes and edge APIs return 503s. Contain, " +
    "Preserve, and Availability all propose their usual actions. None can be executed, so all " +
    "three wait for the next window.",

  topology: demoTopology,

  telemetry: [
    {
      id: "evt-9001",
      at: 1_000,
      source: "network",
      kind: "control_plane.unreachable",
      text: "control plane API 503 for 90s; edge and kubernetes API unreachable",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [],

  blastBudget: 0.08,

  capabilities: {
    "contain-1": ["block_egress"],
    "preserve-1": ["snapshot"],
    "availability-1": ["scale"],
    "human-1": ["*"],
  },

  intents: [
    {
      id: "i-block",
      agent: "contain-1",
      action: "block_egress",
      target: { kind: "edge", id: "edge" },
      params: { cidr: "203.0.113.9/32", suspect: "203.0.113.9" },
      ttlMs: 900_000,
      rationale: { eventId: "evt-9001", citedFields: [], tainted: false, note: "block the suspect while we still can" },
      requestedAt: 100,
    },
    {
      id: "i-snapshot",
      agent: "preserve-1",
      action: "snapshot",
      target: { kind: "host", id: "host-7" },
      params: {},
      ttlMs: 60_000,
      rationale: { eventId: "evt-9001", citedFields: [], tainted: false, note: "capture before the window closes" },
      requestedAt: 110,
    },
    {
      id: "i-scale",
      agent: "availability-1",
      action: "scale",
      target: { kind: "service", id: "checkout" },
      params: { replicas: 6, from: 3 },
      ttlMs: 300_000,
      rationale: { eventId: "evt-9001", citedFields: [], tainted: false },
      requestedAt: 120,
    },
  ],

  expected: {
    "i-block": "defer",
    "i-snapshot": "defer",
    "i-scale": "defer",
  },

  secondKeyIntentIds: [],
  taintedIntentIds: [],
  allowedEffects: [],
  evidenceTargets: ["host-7"],
  executable: false,
};
