/**
 * Scenario 2 — credential stuffing from a shared NAT range.
 *
 * The /24 belongs to a customer NAT pool, so blocking it takes out innocent
 * tenants. The airlock narrows to the one source that is actually failing
 * logins and refuses to drain the host that carries 47% of traffic.
 */
import { demoTopology } from "../domain/topology.js";
import type { Scenario } from "./types.js";

export const credentialStuffingScenario: Scenario = {
  id: "credential-stuffing",
  title: "Credential stuffing behind a shared NAT range",
  source: "MITRE ATT&CK T1110: brute force",
  story:
    "Four thousand failed logins arrive from 198.51.100.0/24 in five minutes across 260 " +
    "accounts. Contain wants the whole /24 blocked and host-12 drained; Availability wants " +
    "checkout scaled instead. The /24 is a customer NAT pool, not an attacker range.",

  topology: demoTopology,

  telemetry: [
    {
      id: "evt-2001",
      at: 1_000,
      source: "auth",
      kind: "auth.failure.burst",
      text: "4,120 failed logins from 198.51.100.0/24 in 300s across 260 accounts",
      taintedFields: [],
      tainted: false,
    },
    {
      id: "evt-2002",
      at: 1_010,
      source: "runtime",
      kind: "latency.spike",
      text: "checkout p99 910ms, auth queue depth 2.4k",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [],

  blastBudget: 0.08,

  capabilities: {
    "contain-1": ["block_egress", "isolate", "drain_node"],
    "availability-1": ["scale", "drain_node"],
    "human-1": ["*"],
  },

  intents: [
    {
      id: "i-block",
      agent: "contain-1",
      action: "block_egress",
      target: { kind: "edge", id: "edge" },
      params: { cidr: "198.51.100.0/24", suspect: "198.51.100.23" },
      ttlMs: 900_000,
      rationale: { eventId: "evt-2001", citedFields: [], tainted: false, note: "stop the burst at the edge" },
      requestedAt: 100,
    },
    {
      id: "i-drain",
      agent: "contain-1",
      action: "drain_node",
      target: { kind: "host", id: "host-12" },
      params: {},
      ttlMs: 600_000,
      rationale: { eventId: "evt-2001", citedFields: [], tainted: false, note: "take the login host out" },
      requestedAt: 110,
    },
    {
      id: "i-scale",
      agent: "availability-1",
      action: "scale",
      target: { kind: "service", id: "checkout" },
      params: { replicas: 8, from: 3 },
      ttlMs: 300_000,
      rationale: { eventId: "evt-2002", citedFields: [], tainted: false },
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
    { action: "block_egress", targetKind: "edge", targetId: "edge", params: { cidr: "198.51.100.23/32" } },
    { action: "scale", targetKind: "service", targetId: "checkout", params: { replicas: 8 } },
  ],
  evidenceTargets: [],
};
