import { benignExportScenario } from "./benign-export.js";
import { controlPlaneOutageScenario } from "./control-plane-outage.js";
import { credentialStuffingScenario } from "./credential-stuffing.js";
import { ddosEdgeScenario } from "./ddos-edge.js";
import { dependencyVulnScenario } from "./dependency-vuln.js";
import { lateralMovementScenario } from "./lateral-movement.js";
import { moneyScenario } from "./money.js";
import { operatorImpersonationScenario } from "./operator-impersonation.js";
import { ransomwareCanaryScenario } from "./ransomware-canary.js";
import { stolenTokenScenario } from "./stolen-token.js";
import type { Scenario } from "./types.js";

export const SCENARIOS: readonly Scenario[] = [
  moneyScenario,
  credentialStuffingScenario,
  lateralMovementScenario,
  ransomwareCanaryScenario,
  ddosEdgeScenario,
  dependencyVulnScenario,
  operatorImpersonationScenario,
  stolenTokenScenario,
  controlPlaneOutageScenario,
  benignExportScenario,
];

export const scenarioById = (id: string): Scenario | undefined =>
  SCENARIOS.find((scenario) => scenario.id === id);

export const scenarioIds = (): string[] => SCENARIOS.map((scenario) => scenario.id);

export type { Scenario } from "./types.js";
