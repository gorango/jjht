/**
 * The Scheduler is the least agent-like participant on the bus, on purpose.
 *
 * It owns no work and assigns nothing. It does two things:
 *   1. at boot, publishes the initial work (every challenge becomes a `work.available`),
 *   2. watches for the moment the system is quiet, and closes the run.
 *
 * Everything in between is agents claiming work and reacting to each other. If the
 * scheduler were removed after boot, the run would still drain — it just would not
 * know when to stop.
 */
import { SituationSpecification, createHuman, type SituationContext } from "@mozaik-ai/core";

import type { PortfolioEntry, Proposal } from "../domain/types.js";
import { pairKey } from "../domain/types.js";
import { emit, type RunSummary } from "../runtime/events.js";
import { join } from "../runtime/session.js";
import type { EurekaState } from "../runtime/state.js";

export const settled = (state: EurekaState): boolean => {
  if (state.finalized) return false;
  // `participant.joined` arrives before bootstrap has queued anything; an empty
  // world is not a finished run.
  if (state.totals.challenges === 0) return false;
  // In a chaos run, wait for the deliberately late turn so its discard is in the
  // trace before the run closes. This is fault injection, not normal operation.
  if (state.config?.chaos === "slow-worker" && !state.chaosFinished) return false;
  if (state.market.size() > 0) return false;
  if (state.pending() > 0) return false;
  if (state.analyses.size < state.totals.challenges) return false;

  for (const challengeId of state.candidates.keys()) {
    if (state.unmatched.has(challengeId)) continue;
    const decided = [...state.proposals.values()].some(
      (proposal) => proposal.challengeId === challengeId && (proposal.status === "approved" || proposal.status === "rejected"),
    );
    if (!decided) return false;
  }
  return true;
};

const fitOf = (state: EurekaState, proposal: Proposal): number =>
  state.scores.get(pairKey(proposal.companyId, proposal.challengeId, proposal.researcherId))?.fit ?? 0;

/**
 * A portfolio, not a leaderboard: at most one collaboration per company, no
 * researcher double-booked, best-supported pairs first.
 */
export const choosePortfolio = (state: EurekaState): PortfolioEntry[] => {
  const approved = [...state.proposals.values()]
    .filter((proposal) => proposal.status === "approved")
    .sort((a, b) => fitOf(state, b) - fitOf(state, a) || a.id.localeCompare(b.id));

  const companies = new Set<string>();
  const researchers = new Set<string>();
  const entries: PortfolioEntry[] = [];

  for (const proposal of approved) {
    if (companies.has(proposal.companyId) || researchers.has(proposal.researcherId)) continue;
    companies.add(proposal.companyId);
    researchers.add(proposal.researcherId);
    entries.push({
      companyId: proposal.companyId,
      challengeId: proposal.challengeId,
      researcherId: proposal.researcherId,
      proposalId: proposal.id,
      fit: fitOf(state, proposal),
    });
    if (entries.length >= state.config.portfolioSize) break;
  }

  return entries;
};

export const portfolioMarkdown = (state: EurekaState, entries: PortfolioEntry[]): string => {
  const lines = [
    "# EUREKA — portfolio",
    "",
    `${entries.length} collaboration${entries.length === 1 ? "" : "s"} proposed from ${state.analyses.size} ` +
      `company challenge${state.analyses.size === 1 ? "" : "s"}, after ${state.counters.rejections} critic rejection` +
      `${state.counters.rejections === 1 ? "" : "s"}.`,
    "",
  ];

  entries.forEach((entry, index) => {
    const company = state.dataset.byCompanyId.get(entry.companyId);
    const researcher = state.dataset.byResearcherId.get(entry.researcherId);
    const proposal = state.proposals.get(entry.proposalId);
    const score = state.scores.get(pairKey(entry.companyId, entry.challengeId, entry.researcherId));

    lines.push(
      `## ${index + 1}. ${company?.name ?? entry.companyId} × ${researcher?.name ?? entry.researcherId}`,
      "",
      `- **Challenge:** ${entry.challengeId}`,
      `- **Fit:** ${(entry.fit * 100).toFixed(0)}%`,
      `- **Why:** ${score?.why ?? ""}`,
      `- **Proposal:** \`${entry.proposalId}\``,
      "",
    );

    if (proposal) {
      lines.push(proposal.markdown, "", "---", "");
    }
  });

  if (state.unmatched.size > 0) {
    lines.push(
      "## Challenges left unmatched (on purpose)",
      "",
      "The system is allowed to conclude that a challenge has no defensible pair. " +
        "Proposing a weak collaboration is worse than saying so.",
      "",
      ...[...state.unmatched].map((id) => `- ${id}: ${state.dataset.byChallengeId.get(id)?.challenge.text ?? ""}`),
      "",
    );
  }

  return lines.join("\n");
};

/**
 * The Scheduler evaluates completion on every event, not just decisions. A slow
 * pool can finish a profiler after the last proposal is reviewed; if the
 * Scheduler only watched decisions it would sit until the watchdog even though
 * every queue was empty. `settled` is cheap, so checking often is the simple
 * correct thing.
 */
class RunDecided extends SituationSpecification {
  override isSatisfiedBy(_context: SituationContext): boolean {
    return true;
  }
}

export const finalize = (state: EurekaState, reason: string): RunSummary => {
  if (state.finalized && state.summary) return state.summary;
  state.finalized = true;

  const entries = choosePortfolio(state);
  state.portfolio = entries;
  const actor = state.schedulerId ?? state.watchdogId ?? "scheduler";
  emit("portfolio.ready", actor, { entries });

  const summary: RunSummary = {
    runId: state.runId,
    elapsedMs: state.elapsedMs(),
    companies: new Set([...state.analyses.values()].map((analysis) => analysis.companyId)).size,
    challenges: state.analyses.size,
    proposals: state.totals.proposals,
    approved: state.totals.approved,
    portfolio: entries.length,
    rejections: state.counters.rejections,
    modelCalls: state.counters.modelCalls,
    inputTokens: state.counters.inputTokens,
    outputTokens: state.counters.outputTokens,
    costUsd: Number(state.counters.costUsd.toFixed(4)),
  };

  state.summary = summary;
  state.note("run", actor, `closed (${reason})`);
  emit("run.completed", actor, { summary });
  return summary;
};

export const diagnose = (state: EurekaState): string => {
  const queues = Object.entries(state.queues)
    .map(([role, ids]) => `${role}:${ids.length}${ids.length ? ` (${ids.slice(0, 3).join(", ")})` : ""}`)
    .join(" ");
  const undecided = [...state.candidates.keys()].filter(
    (challengeId) =>
      !state.unmatched.has(challengeId) &&
      ![...state.proposals.values()].some(
        (proposal) => proposal.challengeId === challengeId && (proposal.status === "approved" || proposal.status === "rejected"),
      ),
  );
  return [
    `finalized=${state.finalized}`,
    `queues[${queues}]`,
    `leases=${state.market.size()}`,
    `analysed=${state.analyses.size}/${state.totals.challenges}`,
    `undecided=${undecided.length}${undecided.length ? ` (${undecided.slice(0, 4).join(", ")})` : ""}`,
  ].join(" | ");
};

/** A participant in name only: it publishes the close, it never reacts or works. */
export const createWatchdog = () =>
  createHuman({
    name: "Watchdog",
    capabilities: ["observe"],
    handlers: [],
  });

export const createScheduler = (state: EurekaState) =>
  createHuman({
    name: "Scheduler",
    capabilities: ["coordinate"],
    handlers: [
      {
        specification: new RunDecided(),
        processor: {
          apply() {
            if (settled(state)) finalize(state, "all work settled");
          },
        },
      },
    ],
  });

export const bootstrap = (state: EurekaState) => {
  const scheduler = createScheduler(state);
  join(scheduler);
  state.schedulerId = scheduler.getId();

  let companies = 0;
  let challenges = 0;

  for (const company of state.dataset.companies) {
    if (companies >= state.config.companyLimit) break;
    const ids = company.challenges.slice(0, state.config.challengesPerCompany).map((challenge) => challenge.id);
    if (ids.length === 0) continue;

    companies += 1;
    for (const id of ids) {
      state.enqueue("analyst", id);
      challenges += 1;
    }
  }

  state.totals.challenges = challenges;
  state.note("run", state.schedulerId, `queued ${challenges} challenges from ${companies} companies`);
  emit("work.available", state.schedulerId, { role: "analyst" });
  return scheduler;
};
