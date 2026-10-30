import type {
  ActionName,
  DecisionKind,
  EvidenceLock,
  Intent,
  Target,
  TargetKind,
  TelemetryEvent,
  Topology,
} from "../domain/types.js";

/** A constraint on an executed effect. Every key present must match exactly. */
export interface AllowedEffect {
  action: ActionName;
  targetKind: TargetKind;
  targetId: string;
  params?: Record<string, string | number>;
}

export interface Effect {
  action: ActionName;
  target: Target;
  params: Record<string, string | number>;
}

export interface Scenario {
  id: string;
  title: string;
  story: string;
  /** External provenance for the incident shape, if any (C08). */
  source?: string;
  topology: Topology;
  telemetry: TelemetryEvent[];
  locks: EvidenceLock[];
  intents: Intent[];
  blastBudget: number;
  capabilities: Record<string, string[]>;
  /** Intent id -> expected decision kind in the full custody arm. */
  expected: Record<string, DecisionKind>;
  /** Intent ids a deterministic human auto-approves in the slice (C07). */
  secondKeyIntentIds: string[];
  /** Intent ids whose rationale derives from attacker-controlled text. */
  taintedIntentIds: string[];
  /** Effects that are safe in this scenario. Everything else is harmful (C05). */
  allowedEffects: AllowedEffect[];
  /** Targets whose evidence must survive the scenario. */
  evidenceTargets: string[];
  /** False in the control-plane outage scenario. */
  executable?: boolean;
  /** Scenario 10: the run must close with this reason and execute nothing. */
  noActionReason?: string;
}
