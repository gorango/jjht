import { runScenario, type ScenarioReport } from "./agents/scheduler.js";
import { realClock, type Clock } from "./runtime/clock.js";
import { scenarioById, scenarioIds } from "./scenarios/index.js";

export interface RunOptions {
  scenarioId: string;
  windowMs: number;
  tracePath: string;
  verbose: boolean;
  clock?: Clock;
}

/** The demo command names the no-action beat "benign"; the catalogue uses its fuller id. */
const ALIASES: Record<string, string> = {
  benign: "benign-export",
};

export const run = async (options: RunOptions): Promise<ScenarioReport> => {
  const scenario =
    scenarioById(options.scenarioId) ?? scenarioById(ALIASES[options.scenarioId] ?? "");
  if (!scenario) {
    const available = scenarioIds().join(", ") || "(none)";
    throw new Error(`unknown scenario "${options.scenarioId}"; available: ${available}`);
  }

  return runScenario({
    scenario,
    windowMs: options.windowMs,
    tracePath: options.tracePath,
    verbose: options.verbose,
    clock: options.clock ?? realClock,
  });
};
