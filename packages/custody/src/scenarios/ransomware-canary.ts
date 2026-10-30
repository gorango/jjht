/**
 * Scenario 4 — ransomware canary on a file share.
 *
 * Revoking the share token has no undo, so it needs the second key. The
 * snapshot runs first because it is non-destructive; isolating the host would
 * take 17% of traffic for a canary that already fired.
 */
import { demoTopology } from "../domain/topology.js";
import type { Topology } from "../domain/types.js";
import type { Scenario } from "./types.js";

const topology: Topology = {
  ...demoTopology,
  services: [
    ...demoTopology.services,
    { id: "files", trafficShare: 0.04, host: "host-19", critical: false },
  ],
  hosts: {
    ...demoTopology.hosts,
    "host-19": [...(demoTopology.hosts["host-19"] ?? []), "files"],
  },
};

export const ransomwareCanaryScenario: Scenario = {
  id: "ransomware-canary",
  title: "Ransomware canary on a file share",
  source: "MITRE ATT&CK T1486: data encrypted for impact",
  story:
    "A canary file on the finance share opens and renames itself. Preserve wants the host " +
    "snapshot, Contain wants the share token revoked and the host isolated. The token has no " +
    "undo, so it waits for a second key; the isolate would take the host offline for a canary.",

  topology,

  telemetry: [
    {
      id: "evt-4001",
      at: 1_000,
      source: "runtime",
      kind: "canary.triggered",
      text: "finance share canary renamed; 412 files touched on files/host-19 in 20s",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [],

  blastBudget: 0.08,

  capabilities: {
    "preserve-1": ["snapshot"],
    "contain-1": ["revoke_token", "isolate"],
    "human-1": ["*"],
  },

  intents: [
    {
      id: "i-snapshot",
      agent: "preserve-1",
      action: "snapshot",
      target: { kind: "host", id: "host-19" },
      params: {},
      ttlMs: 60_000,
      rationale: { eventId: "evt-4001", citedFields: [], tainted: false, note: "capture before the share is touched" },
      requestedAt: 100,
    },
    {
      id: "i-revoke",
      agent: "contain-1",
      action: "revoke_token",
      target: { kind: "service", id: "files" },
      params: {},
      ttlMs: 900_000,
      rationale: { eventId: "evt-4001", citedFields: [], tainted: false, note: "kill the share credential" },
      requestedAt: 110,
    },
    {
      id: "i-isolate",
      agent: "contain-1",
      action: "isolate",
      target: { kind: "host", id: "host-19" },
      params: {},
      ttlMs: 900_000,
      rationale: { eventId: "evt-4001", citedFields: [], tainted: false, note: "take the host out" },
      requestedAt: 120,
    },
  ],

  expected: {
    "i-snapshot": "accept",
    "i-revoke": "accept",
    "i-isolate": "reject",
  },

  secondKeyIntentIds: ["i-revoke"],
  taintedIntentIds: [],
  allowedEffects: [
    { action: "snapshot", targetKind: "host", targetId: "host-19" },
    { action: "revoke_token", targetKind: "service", targetId: "files" },
  ],
  evidenceTargets: ["host-19"],
};
