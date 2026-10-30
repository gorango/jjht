/**
 * Scenario 10 — benign bulk export.
 *
 * The detection is real and the action should be none. A defender that always
 * acts turns this scheduled backup into an incident.
 */
import { demoTopology } from "../domain/topology.js";
import type { Scenario } from "./types.js";

export const benignExportScenario: Scenario = {
  id: "benign-export",
  title: "Benign bulk export from the backup service",
  story:
    "The network detector flags 2.4 TB leaving for object storage overnight. The source is " +
    "backup-1, the destination is the configured archive, and the shape matches the last " +
    "twelve weekly runs. No agent proposes anything.",

  topology: demoTopology,

  telemetry: [
    {
      id: "evt-10001",
      at: 1_000,
      source: "network",
      kind: "egress.volume",
      text: "backup-1 → archive 2.4 TB, 01:00–03:00, matches the weekly backup window",
      taintedFields: [],
      tainted: false,
    },
  ],

  locks: [],

  blastBudget: 0.08,

  capabilities: {
    "human-1": ["*"],
  },

  intents: [],

  expected: {},

  secondKeyIntentIds: [],
  taintedIntentIds: [],
  allowedEffects: [],
  evidenceTargets: [],
  noActionReason:
    "The 2.4 TB export is backup-1's scheduled weekly run, inside its 03:00 SLO window and " +
    "matching the last twelve weeks' byte and destination profile. No containment, evidence " +
    "capture, or capacity action is warranted.",
};
