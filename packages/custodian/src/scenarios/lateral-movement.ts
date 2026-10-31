/**
 * Scenario 3 — lateral movement across two hosts.
 *
 * host-7 carries payments traffic and a capture is running against it. Moving
 * against host-12 is the right containment; touching host-7 destroys the
 * evidence, so evidence outranks containment even though host-12 is quieter.
 */
import type { Scenario } from "./types.js";
import type { Topology } from "../domain/types.js";

const topology: Topology = {
  services: [
    { id: "payments-api", trafficShare: 0.32, host: "host-7", critical: true },
    { id: "redis", trafficShare: 0.08, host: "host-7", critical: true },
    { id: "catalog", trafficShare: 0.19, host: "host-12", critical: false },
    { id: "checkout", trafficShare: 0.28, host: "host-20", critical: true },
    { id: "search", trafficShare: 0.09, host: "host-19", critical: false },
    { id: "mailer", trafficShare: 0.04, host: "host-19", critical: false },
  ],
  hosts: {
    "host-7": ["payments-api", "redis"],
    "host-12": ["catalog"],
    "host-20": ["checkout"],
    "host-19": ["search", "mailer"],
  },
  links: [
    { from: "edge", to: "host-7" },
    { from: "edge", to: "host-12" },
    { from: "edge", to: "host-20" },
    { from: "edge", to: "host-19" },
  ],
  protectedCidrs: ["10.0.0.0/8"],
};

export const lateralMovementScenario: Scenario = {
  id: "lateral-movement",
  title: "Lateral movement from a compromised payments host",
  source: "MITRE ATT&CK T1021: remote services",
  story:
    "Host-7 authenticates into host-12's catalog admin port, then sweeps host-19. Preserve is " +
    "capturing host-7 and holds its evidence lock. Contain wants both hosts isolated; the " +
    "free host yields, the locked one waits.",

  topology,

  telemetry: [
    {
      id: "evt-3001",
      at: 1_000,
      source: "network",
      kind: "connection.fanout",
      text: "host-7 → host-12:22, 18 sessions in 40s; host-12 → host-19:5432 probes",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [
    {
      targetId: "host-7",
      holder: "preserve-1",
      reason: "memory and connection capture in flight",
      until: 9_999,
    },
  ],

  blastBudget: 0.6,

  capabilities: {
    "preserve-1": ["snapshot"],
    "contain-1": ["isolate"],
    "human-1": ["*"],
  },

  intents: [
    {
      id: "i-snapshot-7",
      agent: "preserve-1",
      action: "snapshot",
      target: { kind: "host", id: "host-7" },
      params: {},
      ttlMs: 60_000,
      rationale: { eventId: "evt-3001", citedFields: [], tainted: false, note: "capture before anything moves" },
      requestedAt: 100,
    },
    {
      id: "i-isolate-12",
      agent: "contain-1",
      action: "isolate",
      target: { kind: "host", id: "host-12" },
      params: {},
      ttlMs: 900_000,
      rationale: { eventId: "evt-3001", citedFields: [], tainted: false, note: "cut the second hop" },
      requestedAt: 110,
    },
    {
      id: "i-isolate-7",
      agent: "contain-1",
      action: "isolate",
      target: { kind: "host", id: "host-7" },
      params: {},
      ttlMs: 900_000,
      rationale: { eventId: "evt-3001", citedFields: [], tainted: false, note: "stop the source too" },
      requestedAt: 120,
    },
  ],

  expected: {
    "i-snapshot-7": "accept",
    "i-isolate-12": "accept",
    "i-isolate-7": "defer",
  },

  secondKeyIntentIds: [],
  taintedIntentIds: [],
  allowedEffects: [
    { action: "snapshot", targetKind: "host", targetId: "host-7" },
    { action: "isolate", targetKind: "host", targetId: "host-12" },
  ],
  evidenceTargets: ["host-7"],
};
