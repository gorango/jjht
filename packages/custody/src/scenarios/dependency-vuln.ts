/**
 * Scenario 6 — vulnerable dependency in a deploy.
 *
 * The right response is a repo issue and a patched deploy, not a runtime
 * isolate. The isolate would take 13% of traffic for a code defect that never
 * touches the request path.
 */
import { demoTopology } from "../domain/topology.js";
import type { Scenario } from "./types.js";

export const dependencyVulnScenario: Scenario = {
  id: "dependency-vuln",
  title: "Vulnerable dependency shipped in a deploy",
  source: "MITRE ATT&CK T1195: supply chain compromise",
  story:
    "Deploy dpl-88 ships lodash 4.17.20 with CVE-2021-23337 into payments-api. Contain wants " +
    "host-19 isolated as a precaution. Correctness says file the issue and verify the patch; " +
    "the airlock refuses the runtime blow for a build-time defect.",

  topology: demoTopology,

  telemetry: [
    {
      id: "evt-6001",
      at: 1_000,
      source: "deploy",
      kind: "deploy.succeeded",
      text: "dpl-88 shipped lodash 4.17.20 (CVE-2021-23337) to payments-api",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [],

  blastBudget: 0.08,

  capabilities: {
    "contain-1": ["isolate"],
    "human-1": ["*"],
  },

  intents: [
    {
      id: "i-isolate",
      agent: "contain-1",
      action: "isolate",
      target: { kind: "host", id: "host-19" },
      params: {},
      ttlMs: 900_000,
      rationale: { eventId: "evt-6001", citedFields: [], tainted: false, note: "quarantine the dependency" },
      requestedAt: 100,
    },
  ],

  expected: {
    "i-isolate": "reject",
  },

  secondKeyIntentIds: [],
  taintedIntentIds: [],
  allowedEffects: [],
  evidenceTargets: [],
};
