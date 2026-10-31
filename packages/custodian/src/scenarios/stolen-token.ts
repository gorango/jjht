/**
 * Scenario 8 — stolen capability token.
 *
 * contain-9 holds a token scoped to a secret. It asks to revoke a service
 * credential. The capability check fails on the target kind, so authority, not
 * intent, decides.
 */
import { demoTopology } from "../domain/topology.js";
import type { Scenario } from "./types.js";

export const stolenTokenScenario: Scenario = {
  id: "stolen-token",
  title: "Compromised agent with a stolen capability token",
  source: "MITRE ATT&CK T1528: steal application access token",
  story:
    "contain-9's token is stolen and used to propose revoking the payments-api service " +
    "credential. Its only capability is revoke_token@secret, which does not cover a service. " +
    "Preserve's snapshot on the same host is unaffected.",

  topology: demoTopology,

  telemetry: [
    {
      id: "evt-8001",
      at: 1_000,
      source: "network",
      kind: "credential.reuse",
      text: "payments-api service token used from 198.51.100.77, outside the service mesh",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [],

  blastBudget: 0.08,

  capabilities: {
    "contain-9": ["revoke_token@secret"],
    "preserve-1": ["snapshot"],
    "human-1": ["*"],
  },

  intents: [
    {
      id: "i-snapshot",
      agent: "preserve-1",
      action: "snapshot",
      target: { kind: "host", id: "host-7" },
      params: {},
      ttlMs: 60_000,
      rationale: { eventId: "evt-8001", citedFields: [], tainted: false, note: "capture the compromised host" },
      requestedAt: 100,
    },
    {
      id: "i-revoke",
      agent: "contain-9",
      action: "revoke_token",
      target: { kind: "service", id: "payments-api" },
      params: {},
      ttlMs: 900_000,
      rationale: { eventId: "evt-8001", citedFields: [], tainted: false, note: "kill the credential" },
      requestedAt: 110,
    },
  ],

  expected: {
    "i-snapshot": "accept",
    "i-revoke": "reject",
  },

  secondKeyIntentIds: [],
  taintedIntentIds: [],
  allowedEffects: [
    { action: "snapshot", targetKind: "host", targetId: "host-7" },
  ],
  evidenceTargets: ["host-7"],
};
