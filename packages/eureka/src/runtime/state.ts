/**
 * The one typed store every participant shares.
 *
 * There is no second hidden store: queues, leases, profiles, candidates,
 * proposals and the ledger all live here, and participants mutate them from
 * situation processors. Agent memory is deliberately *not* used for task state —
 * see `turn()` in ../agents/worker.ts for why.
 */
import { RuntimeState } from "@mozaik-ai/core";

import { ResearcherIndex } from "../domain/dataset.js";
import { MemoryMarket } from "../domain/market.js";
import type {
  Candidate,
  Dataset,
  ChallengeAnalysis,
  Claim,
  LedgerEntry,
  PairScore,
  PortfolioEntry,
  Proposal,
  ResearcherProfile,
} from "../domain/types.js";

export type Role = "profiler" | "analyst" | "matchmaker" | "writer" | "critic";

export const ROLES: readonly Role[] = ["profiler", "analyst", "matchmaker", "writer", "critic"];

export interface RunConfig {
  /** How many companies to process. The full dataset has 153. */
  companyLimit: number;
  /** How many challenges per company. Most companies have 3–4. */
  challengesPerCompany: number;
  /** Candidates retrieved per challenge before any model runs. */
  candidatesPerChallenge: number;
  /** How many of those candidates to enrich with a model-written profile. */
  profileTopN: number;
  /** Proposals carried to the final portfolio. */
  portfolioSize: number;
  /** Worker pool size per role — the real concurrency knob. */
  poolSize: Partial<Record<Role, number>>;
  /** Lease time-to-live. A stalled worker loses its claim after this. */
  leaseTtlMs: number;
  /** Deterministic mock latency, so concurrency can be measured offline. */
  mockLatencyMs: number;
  /** Fault injection. `slow-worker` holds one writer past its lease TTL. */
  chaos?: "slow-worker";
  /** `on` (default) lets the Scheduler close the run; `off-after-boot` removes it. */
  scheduler: "on" | "off-after-boot";
  /** Model routing. */
  strongModel: string;
  fastModel: string;
  mock: boolean;
}

export interface Counters {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD, from the per-model price table in ../inference/pricing.ts */
  costUsd: number;
  rejections: number;
  approved: number;
}

export class EurekaState extends RuntimeState {
  runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  startedAt = Date.now();

  dataset!: Dataset;
  index!: ResearcherIndex;
  config!: RunConfig;

  /** Work queues. A worker shifts one id, then leases it. */
  readonly queues: Record<Role, string[]> = {
    profiler: [],
    analyst: [],
    matchmaker: [],
    writer: [],
    critic: [],
  };

  readonly market = new MemoryMarket();

  /** Failed attempts per queue item, so a poisoned task cannot loop forever. */
  readonly attempts = new Map<string, number>();

  readonly profiles = new Map<string, ResearcherProfile>();
  readonly analyses = new Map<string, ChallengeAnalysis>();
  readonly candidates = new Map<string, Candidate[]>();
  readonly scores = new Map<string, PairScore>();
  readonly proposals = new Map<string, Proposal>();
  readonly claims = new Map<string, Claim>();
  /** Challenges where the system concluded, on the record, that no pair is worth proposing. */
  readonly unmatched = new Set<string>();
  /** Every id that exists in the dataset. The Critic's ground truth. */
  readonly sourceIds = new Set<string>();
  portfolio: PortfolioEntry[] = [];

  readonly ledger: LedgerEntry[] = [];
  readonly counters: Counters = {
    modelCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    rejections: 0,
    approved: 0,
  };

  /** Stage counters, so "is the run finished?" is a property of state, not a flag. */
  readonly totals = { challenges: 0, proposals: 0, approved: 0 };

  finalized = false;
  schedulerId?: string;
  /** A non-participating closer used when the Scheduler is removed after boot. */
  watchdogId?: string;
  summary?: import("./events.js").RunSummary;
  /** The chaos run uses this once: exactly one slow worker, not every writer. */
  chaosTriggered = false;
  /** Set when the late answer has been measured and discarded. */
  chaosFinished = false;

  note(kind: string, actor: string, detail: string): void {
    this.ledger.push({ at: Date.now(), kind, actor, detail });
  }

  enqueue(role: Role, id: string): void {
    if (!this.queues[role].includes(id)) this.queues[role].push(id);
  }

  dequeue(role: Role): string | undefined {
    return this.queues[role].shift();
  }

  pending(): number {
    return ROLES.reduce((sum, role) => sum + this.queues[role].length, 0);
  }

  elapsedMs(): number {
    return Date.now() - this.startedAt;
  }
}
