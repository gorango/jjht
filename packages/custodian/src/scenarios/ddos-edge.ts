/**
 * Scenario 5 — volumetric DDoS on the edge.
 *
 * The edge absorbs the attack; draining the origin would hand the attacker the
 * outage it is trying to cause. The /24 narrows to the single suspect and
 * checkout scales.
 */
import { demoTopology } from "../domain/topology.js";
import type { Scenario } from "./types.js";

export const ddosEdgeScenario: Scenario = {
  id: "ddos-edge",
  title: "Volumetric DDoS against the edge",
  source: "MITRE ATT&CK T1498: network denial of service",
  story:
    "1.8 Mpps and 42 Gbps hit the edge from 203.0.113.0/24. Contain wants the /24 blocked and " +
    "host-7 drained; Availability wants checkout scaled. Draining the origin would complete " +
    "the attack.",

  topology: demoTopology,

  telemetry: [
    {
      id: "evt-5001",
      at: 1_000,
      source: "network",
      kind: "network.volumetric",
      text: "1.8 Mpps, 42 Gbps inbound from 203.0.113.0/24 at the edge",
      taintedFields: [],
      tainted: false,
    },
    {
      id: "evt-5002",
      at: 1_010,
      source: "runtime",
      kind: "latency.spike",
      text: "edge retries pushed checkout p99 to 1.4s",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [],

  blastBudget: 0.08,

  capabilities: {
    "contain-1": ["block_egress", "drain_node"],
    "availability-1": ["scale"],
    "human-1": ["*"],
  },

  intents: [
    {
      id: "i-block",
      agent: "contain-1",
      action: "block_egress",
      target: { kind: "edge", id: "edge" },
      params: { cidr: "203.0.113.0/24", suspect: "203.0.113.9" },
      ttlMs: 900_000,
      rationale: { eventId: "evt-5001", citedFields: [], tainted: false, note: "drop the flood at the edge" },
      requestedAt: 100,
    },
    {
      id: "i-drain",
      agent: "contain-1",
      action: "drain_node",
      target: { kind: "host", id: "host-7" },
      params: {},
      ttlMs: 600_000,
      rationale: { eventId: "evt-5001", citedFields: [], tainted: false, note: "shed the origin" },
      requestedAt: 110,
    },
    {
      id: "i-scale",
      agent: "availability-1",
      action: "scale",
      target: { kind: "service", id: "checkout" },
      params: { replicas: 10, from: 3 },
      ttlMs: 300_000,
      rationale: { eventId: "evt-5002", citedFields: [], tainted: false },
      requestedAt: 120,
    },
  ],

  expected: {
    "i-block": "rewrite",
    "i-drain": "reject",
    "i-scale": "accept",
  },

  secondKeyIntentIds: [],
  taintedIntentIds: [],
  allowedEffects: [
    { action: "block_egress", targetKind: "edge", targetId: "edge", params: { cidr: "203.0.113.9/32" } },
    { action: "scale", targetKind: "service", targetId: "checkout", params: { replicas: 10 } },
  ],
  evidenceTargets: [],
};
