/**
 * The one shared store. Every participant reads and writes this; nothing
 * important lives in a model's context window.
 *
 * This is the same discipline EUREKA uses (see packages/eureka/src/runtime/state.ts):
 * task state is runtime state, agent memory is per-turn and disposable.
 */
import { RuntimeState } from "@mozaik-ai/core";

import type { Decision, EvidenceLock, Intent, TelemetryEvent, Topology } from "../domain/types.js";

export type Phase = "watch" | "triage" | "act" | "recover" | "closed";

export interface CustodyConfig {
  /** Maximum traffic share a single accepted action may affect. */
  blastBudget: number;
  /** How long the airlock holds intents before deciding them together. */
  windowMs: number;
  /** Mock inference: deterministic, no network. */
  mock: boolean;
}

export interface Incident {
  id: string;
  openedAt: number;
  phase: Phase;
  telemetryIds: string[];
  intentIds: string[];
  decisionIds: string[];
}

export class CustodyState extends RuntimeState {
  topology?: Topology;

  readonly telemetry = new Map<string, TelemetryEvent>();
  readonly intents = new Map<string, Intent>();
  readonly decisions = new Map<string, Decision>();
  readonly locks = new Map<string, EvidenceLock>();
  readonly incidents = new Map<string, Incident>();

  capabilities: Record<string, string[]> = {};
  readonly secondKey = new Set<string>();

  config: CustodyConfig = {
    blastBudget: 0.08,
    windowMs: 1_500,
    mock: true,
  };

  ingest(event: TelemetryEvent): void {
    this.telemetry.set(event.id, event);
  }

  propose(intent: Intent): void {
    this.intents.set(intent.id, intent);
  }

  decide(decision: Decision): void {
    this.decisions.set(decision.intentId, decision);
  }

  lockEvidence(lock: EvidenceLock): void {
    this.locks.set(lock.targetId, lock);
  }

  releaseEvidence(targetId: string): void {
    this.locks.delete(targetId);
  }

  /** Intent ids that have not been decided yet. */
  pending(): Intent[] {
    return [...this.intents.values()].filter((intent) => !this.decisions.has(intent.id));
  }
}
