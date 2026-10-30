/**
 * The airlock.
 *
 * This is the only place where an intent becomes an action. It receives every
 * intent currently pending — from agents that are still mid-turn — and decides
 * them *jointly*. That is the difference from a pipeline: agent B's half-formed
 * veto can change agent A's action before either executes.
 *
 * The rules are ordered by authority, not by convenience:
 *   1. evidence outranks containment (defer, don't destroy)
 *   2. provenance outranks urgency (reject anything steered by tainted text)
 *   3. authority outranks intent (capability and undoability are checked in code)
 *   4. availability caps the blast radius (narrow, then reject)
 *   5. what remains is accepted against the joint budget
 */
import { checkIntent, failures, hasFailure, type Finding, type InvariantContext } from "../domain/invariants.js";
import { definitionOf } from "../domain/registry.js";
import type { Decision, DecisionKind, Intent, Vote } from "../domain/types.js";

export interface AirlockResult {
  decisions: Decision[];
  findings: Finding[];
  accepted: Intent[];
  counts: Record<DecisionKind, number>;
}

const VOTER: Record<string, string> = {
  capability: "auditor",
  provenance: "auditor",
  taint: "provenance",
  compensation: "auditor",
  blast: "availability",
  evidence: "preserve",
  protected_cidr: "availability",
};

const voteFor = (finding: Finding): Vote => ({
  voter: VOTER[finding.code] ?? "auditor",
  verdict: "veto",
  reason: finding.detail,
});

const counter = (): Record<DecisionKind, number> => ({ accept: 0, rewrite: 0, reject: 0, defer: 0 });

const describe = (findings: readonly Finding[]): string =>
  findings.map((finding) => `${finding.code}: ${finding.detail}`).join("; ");

export const reconcile = (intents: readonly Intent[], ctx: InvariantContext): AirlockResult => {
  const ordered = [...intents].sort(
    (a, b) => a.requestedAt - b.requestedAt || a.id.localeCompare(b.id),
  );

  const decisions: Decision[] = [];
  const findings: Finding[] = [];
  const accepted: Intent[] = [];
  const counts = counter();
  let spent = 0;

  const record = (
    intent: Intent,
    kind: DecisionKind,
    reason: string,
    votes: Vote[],
    final?: Intent,
  ): void => {
    counts[kind] += 1;
    decisions.push({
      intentId: intent.id,
      agent: intent.agent,
      action: intent.action,
      target: intent.target.id,
      kind,
      reason,
      ...(final ? { final } : {}),
      votes,
    });
  };

  for (const intent of ordered) {
    const checks = checkIntent(intent, ctx);
    findings.push(...checks);
    const bad = failures(checks);
    const votes = bad.map(voteFor);
    const definition = definitionOf(intent.action);

    // 1. Evidence outranks containment. A destructive action waits; it does not win.
    if (hasFailure(checks, "evidence")) {
      record(intent, "defer", bad.find((finding) => finding.code === "evidence")?.detail ?? "evidence lock", votes);
      continue;
    }

    // 2. Untrusted input cannot be the sole authority for an action.
    if (hasFailure(checks, "taint") || hasFailure(checks, "provenance")) {
      record(intent, "reject", describe(bad), votes);
      continue;
    }

    // 3. Authority and undoability are checked in code, not in a prompt.
    if (hasFailure(checks, "capability") || hasFailure(checks, "compensation")) {
      record(intent, "reject", describe(bad), votes);
      continue;
    }

    // 4. Blocking internal ranges is an outage, not containment.
    if (hasFailure(checks, "protected_cidr")) {
      record(intent, "reject", describe(bad), votes);
      continue;
    }

    // 5. Too wide? Narrow it and re-check, rather than refusing to contain.
    if (hasFailure(checks, "blast")) {
      const narrowed = definition.narrow?.(intent);
      if (narrowed) {
        const narrowedChecks = checkIntent(narrowed, ctx);
        findings.push(...narrowedChecks);
        if (failures(narrowedChecks).length === 0) {
          const narrowedBlast = definition.blastRadius(ctx.topology, narrowed);
          spent += narrowedBlast;
          record(
            intent,
            "rewrite",
            `narrowed to ${String(narrowed.params.cidr ?? narrowed.target.id)} ` +
              `(${(definition.blastRadius(ctx.topology, intent) * 100).toFixed(1)}% → ` +
              `${(narrowedBlast * 100).toFixed(1)}% of traffic)`,
            [],
            narrowed,
          );
          accepted.push(narrowed);
          continue;
        }
      }
      record(intent, "reject", describe(bad), votes);
      continue;
    }

    // 6. The joint budget: individually safe actions can still add up to an outage.
    const blast = definition.blastRadius(ctx.topology, intent);
    if (spent + blast > ctx.blastBudget) {
      record(
        intent,
        "defer",
        `joint budget would reach ${((spent + blast) * 100).toFixed(1)}% ` +
          `(budget ${(ctx.blastBudget * 100).toFixed(1)}%); deferred for the next window`,
        [{ voter: "availability", verdict: "veto", reason: "joint blast budget" }],
      );
      continue;
    }

    spent += blast;
    record(intent, "accept", "all invariants hold", []);
    accepted.push(intent);
  }

  return { decisions, findings, accepted, counts };
};

export const summarize = (result: AirlockResult): string => {
  const { counts } = result;
  return `${counts.accept} accepted, ${counts.rewrite} rewritten, ${counts.defer} deferred, ${counts.reject} rejected`;
};
