import { moneyScenario } from "./money.js";
import type { Scenario } from "./types.js";

export const SCENARIOS: readonly Scenario[] = [moneyScenario];

export const scenarioById = (id: string): Scenario | undefined =>
  SCENARIOS.find((scenario) => scenario.id === id);

export const scenarioIds = (): string[] => SCENARIOS.map((scenario) => scenario.id);

export type { Scenario } from "./types.js";
