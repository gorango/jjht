/**
 * Domain events. Everything interesting in the run is one of these, published on
 * the runtime bus and delivered to every joined participant.
 */
import { SemanticEvent } from "@mozaik-ai/core";

import type {
  Candidate,
  ChallengeAnalysis,
  Claim,
  PairScore,
  PortfolioEntry,
  Proposal,
  ResearcherProfile,
} from "../domain/types.js";
import type { Role } from "./state.js";
import { sendEvent } from "./session.js";

export interface EventMap {
  "work.available": { role: Role };

  "task.claimed": { role: Role; item: string; worker: string; generation: number };
  "task.failed": { role: Role; item: string; worker: string; reason: string };
  /** A lease passed its TTL. The item is requeued and may be claimed again. */
  "lease.expired": { role: Role; item: string; worker: string; generation: number; ttlMs: number };
  /** Another worker took over an item after a lease expired. */
  "task.reclaimed": { role: Role; item: string; worker: string; previousWorker: string; reason: string };
  /** A late answer arrived after its lease was lost; its write was discarded. */
  "task.discarded": { role: Role; item: string; worker: string; reason: string };
  /** The real-person guard stopped a turn before it reached a model. */
  "inference.refused": { role: Role; item: string; worker: string; reason: string };
  "task.measured": {
    role: Role;
    item: string;
    worker: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    durationMs: number;
  };

  "researcher.profiled": { researcherId: string; profile: ResearcherProfile; generation: number };
  "challenge.analyzed": {
    challengeId: string;
    analysis: ChallengeAnalysis;
    candidates: Candidate[];
    generation: number;
  };

  "pairs.ranked": { challengeId: string; scores: PairScore[]; generation: number };
  "proposal.drafted": { proposal: Proposal; generation: number };
  "proposal.reviewed": {
    proposalId: string;
    verdict: "approve" | "reject";
    note: string;
    claims: Claim[];
    /** Machine-readable structural gates that fired before the model verdict. */
    hardRejects: Array<{ code: string; detail: string }>;
    unknownCitations: string[];
    generation: number;
  };
  "proposal.revised": { proposal: Proposal; generation: number };
  "proposal.abandoned": { proposalId: string; reason: string };

  "portfolio.ready": { entries: PortfolioEntry[] };
  "run.completed": { summary: RunSummary };
  "run.failed": { reason: string };
}

export interface RunSummary {
  runId: string;
  elapsedMs: number;
  companies: number;
  challenges: number;
  proposals: number;
  approved: number;
  portfolio: number;
  rejections: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export const emit = <K extends keyof EventMap>(
  type: K,
  producerId: string,
  payload: EventMap[K],
): void => {
  sendEvent(SemanticEvent.create(type, producerId, payload), producerId);
};

/**
 * Wake a role, but only if there is something to wake it for. Every completed
 * task re-publishes availability; without this guard those wakes pile up into an
 * event storm that costs more than the work.
 */
export const wake = (queueLength: number, role: Role, actor: string): void => {
  if (queueLength > 0) emit("work.available", actor, { role });
};

/** Narrow an incoming event to one payload type, or `undefined` if it is not that event. */
export const payloadOf = <K extends keyof EventMap>(
  event: { type: string; payload: unknown },
  type: K,
): EventMap[K] | undefined => (event.type === type ? (event.payload as EventMap[K]) : undefined);
