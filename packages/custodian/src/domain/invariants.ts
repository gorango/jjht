/**
 * Invariants are the judge inside the system. They are plain functions so they
 * can be unit-tested, reasoned about, and — crucially — run in the ablation arm
 * without the airlock, to prove the airlock is what changes the outcome.
 */
import { definitionOf } from "./registry.js";
import { hostOf } from "./topology.js";
import type { EvidenceLock, Intent, Topology } from "./types.js";

export type InvariantCode =
  | "capability"
  | "provenance"
  | "taint"
  | "compensation"
  | "blast"
  | "evidence"
  | "protected_cidr"
  | "control_plane";

export interface Finding {
  code: InvariantCode;
  intentId: string;
  ok: boolean;
  detail: string;
}

export interface InvariantContext {
  topology: Topology;
  locks: EvidenceLock[];
  /** Maximum traffic share any single accepted action may affect. */
  blastBudget: number;
  knownEventIds: ReadonlySet<string>;
  /** agent id -> capabilities. `*` is a wildcard (the human operator). */
  capabilities: Readonly<Record<string, readonly string[]>>;
  /** Intent ids a human has approved with a second key. */
  secondKey: ReadonlySet<string>;
  /** False when the control plane is unreachable: every intent defers, fail closed. */
  executable?: boolean;
  now: number;
}

const lockedFor = (intent: Intent, ctx: InvariantContext): EvidenceLock | undefined => {
  const targetId = intent.target.id;
  const host = intent.target.kind === "service" ? hostOf(ctx.topology, targetId) : undefined;

  return ctx.locks.find((lock) => {
    if (lock.until <= ctx.now) return false;
    if (lock.targetId === targetId) return true;
    if (host && lock.targetId === host) return true;
    return false;
  });
};

export const checkIntent = (intent: Intent, ctx: InvariantContext): Finding[] => {
  const definition = definitionOf(intent.action);
  const caps = ctx.capabilities[intent.agent] ?? [];
  const secondKey = ctx.secondKey.has(intent.id);
  const findings: Finding[] = [];

  // A capability is scoped to the action, and may be scoped to the target kind
  // (`isolate@host`). A token for a secret does not authorize a service.
  const scoped = `${definition.capability}@${intent.target.kind}`;
  findings.push({
    code: "capability",
    intentId: intent.id,
    ok: caps.includes("*") || caps.includes(scoped) || caps.includes(definition.capability),
    detail: `${intent.agent} holds [${caps.join(", ") || "nothing"}], needs ${definition.capability} on ${intent.target.kind}`,
  });

  findings.push({
    code: "provenance",
    intentId: intent.id,
    ok: ctx.knownEventIds.has(intent.rationale.eventId),
    detail: `rationale cites ${intent.rationale.eventId}`,
  });

  findings.push({
    code: "taint",
    intentId: intent.id,
    ok: !intent.rationale.tainted || secondKey,
    detail: intent.rationale.tainted
      ? "rationale derives from attacker-controlled text; needs a second key"
      : "rationale is from trusted telemetry",
  });

  findings.push({
    code: "compensation",
    intentId: intent.id,
    ok: !definition.destructive || Boolean(definition.compensation) || secondKey,
    detail: definition.destructive && !definition.compensation
      ? `${intent.action} has no undo; needs a second key`
      : `${intent.action} is reversible or non-destructive`,
  });

  const blast = definition.blastRadius(ctx.topology, intent);
  findings.push({
    code: "blast",
    intentId: intent.id,
    ok: blast <= ctx.blastBudget,
    detail: `affects ${(blast * 100).toFixed(1)}% of traffic (budget ${(ctx.blastBudget * 100).toFixed(1)}%)`,
  });

  const lock = lockedFor(intent, ctx);
  findings.push({
    code: "evidence",
    intentId: intent.id,
    ok: !(definition.destructive && lock),
    detail: definition.destructive && lock
      ? `evidence lock on ${lock.targetId} held by ${lock.holder}: ${lock.reason}`
      : "no evidence lock applies",
  });

  if (intent.action === "block_egress") {
    const cidr = String(intent.params.cidr ?? "");
    findings.push({
      code: "protected_cidr",
      intentId: intent.id,
      ok: !(ctx.topology.protectedCidrs ?? []).includes(cidr),
      detail: (ctx.topology.protectedCidrs ?? []).includes(cidr)
        ? `${cidr} is internal traffic; blocking it is a self-inflicted outage`
        : `${cidr} is not a protected range`,
    });
  }

  if (ctx.executable === false) {
    findings.push({
      code: "control_plane",
      intentId: intent.id,
      ok: false,
      detail: "control plane unreachable: the action cannot be executed, so it is deferred",
    });
  }

  return findings;
};

export const failures = (findings: readonly Finding[]): Finding[] => findings.filter((finding) => !finding.ok);

export const hasFailure = (findings: readonly Finding[], code: InvariantCode): boolean =>
  findings.some((finding) => !finding.ok && finding.code === code);
