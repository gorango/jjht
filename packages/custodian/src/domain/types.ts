/**
 * The vocabulary of the system.
 *
 * An agent never emits a command. It emits an `Intent`: a typed action against a
 * typed target, with a TTL and a rationale that points at the telemetry that
 * justified it. The airlock turns intents into decisions.
 */

export type ActionName =
  | "block_egress"
  | "unblock_egress"
  | "isolate"
  | "release"
  | "snapshot"
  | "drain_node"
  | "revoke_token"
  | "scale";

export type TargetKind = "service" | "host" | "edge" | "secret" | "artifact";

export interface Target {
  kind: TargetKind;
  id: string;
}

/**
 * Why the agent thinks this action is warranted.
 *
 * `tainted` is set when any part of the rationale was read from a source the
 * attacker can write (logs, request headers, a ticket body). A tainted rationale
 * is not forbidden — it just cannot be the *only* authority for an action.
 */
export interface Rationale {
  eventId: string;
  tainted: boolean;
  /** Fields of the cited event the intent relies on. Taint is computed from these. */
  citedFields?: string[];
  note?: string;
}

export interface Intent {
  id: string;
  agent: string;
  action: ActionName;
  target: Target;
  params: Record<string, string | number>;
  ttlMs: number;
  rationale: Rationale;
  requestedAt: number;
}

/** Forensics holds this while a capture is in flight. */
export interface EvidenceLock {
  targetId: string;
  holder: string;
  reason: string;
  until: number;
}

export interface ServiceNode {
  id: string;
  /** Share of total production traffic, 0..1. Used for blast radius. */
  trafficShare: number;
  host: string;
  critical: boolean;
}

export interface Link {
  from: string;
  to: string;
}

export interface Topology {
  services: ServiceNode[];
  hosts: Record<string, string[]>;
  links: Link[];
  /** CIDRs that are known-good. Blocking one of these is a self-inflicted outage. */
  protectedCidrs?: string[];
}

export type DecisionKind = "accept" | "rewrite" | "reject" | "defer";

export type VoteVerdict = "allow" | "veto" | "abstain";

export interface Vote {
  voter: string;
  verdict: VoteVerdict;
  reason: string;
}

export interface Decision {
  intentId: string;
  agent: string;
  action: ActionName;
  target: string;
  kind: DecisionKind;
  reason: string;
  /** Present for `rewrite`: the intent that will actually execute. */
  final?: Intent;
  votes: Vote[];
}

export interface TelemetryEvent {
  id: string;
  at: number;
  source: "network" | "auth" | "runtime" | "logs" | "deploy";
  kind: string;
  /** Text the attacker can influence. Never treated as instruction. */
  text: string;
  /** Computed at ingestion by `ingestTelemetry`; a fixture may set it explicitly. */
  taintedFields?: string[];
  tainted: boolean;
}
