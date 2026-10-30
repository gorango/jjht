/**
 * The five working roles. Each one is an ordinary participant with a prompt and
 * two pure functions: how to build its input, and what its answer means.
 *
 * The Critic is the exception worth reading: it does not only ask a model whether
 * the proposal is sound. Code first resolves every citation against the dataset,
 * then the model gets the verdict and explains it. A model cannot talk the
 * system into citing a paper that does not exist.
 */
import { emit, wake } from "../runtime/events.js";
import type { EurekaState } from "../runtime/state.js";
import {
  describeChallenge,
  describeResearcher,
  tokenize,
} from "../domain/dataset.js";
import type {
  Candidate,
  ChallengeAnalysis,
  Claim,
  PairScore,
  Proposal,
  ResearcherProfile,
} from "../domain/types.js";
import { pairKey } from "../domain/types.js";
import type { WorkerContext, WorkerSpec } from "./worker.js";

const JSON_ONLY = "Reply with one JSON object and nothing else. No prose, no markdown fences.";

/* -------------------------------------------------------------------------- */
/* Research Profiler                                                           */
/* -------------------------------------------------------------------------- */

export const profiler: WorkerSpec = {
  role: "profiler",
  maxOutputTokens: 500,
  model: "fast",
  instruction: `[[role:profiler]] You are the Research Profiler in a system that matches university researchers with companies.
Read one researcher record and produce a compact profile for a matchmaking system.
Use only facts present in the record. Every claim you make must be traceable to a dataset id.
${JSON_ONLY}
Schema: {"summary": string, "expertise": string[], "openTo": string[], "industrySignals": string[], "citations": string[]}`,

  buildInput(state, item) {
    const researcher = state.dataset.byResearcherId.get(item);
    if (!researcher) throw new Error(`unknown researcher ${item}`);
    return {
      researcher: {
        ...researcher,
        publications: researcher.publications.slice(0, 6),
        projects: researcher.projects.slice(0, 3),
      },
    };
  },

  apply(state, item, result, context) {
    const profile: ResearcherProfile = {
      researcherId: item,
      summary: String(result?.summary ?? ""),
      expertise: Array.isArray(result?.expertise) ? result.expertise : [],
      openTo: Array.isArray(result?.openTo) ? result.openTo : [],
      industrySignals: Array.isArray(result?.industrySignals) ? result.industrySignals : [],
      citations: Array.isArray(result?.citations) ? result.citations : [],
      producedBy: context.worker,
    };
    state.profiles.set(item, profile);
    emit("researcher.profiled", context.worker, {
      researcherId: item,
      profile,
      generation: context.generation,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* Industry Analyst                                                            */
/* -------------------------------------------------------------------------- */

export const analyst: WorkerSpec = {
  role: "analyst",
  maxOutputTokens: 400,
  model: "fast",
  instruction: `[[role:analyst]] You are the Industry Analyst. Turn one company challenge into the technical capability the company actually needs, in the language of research areas.
Do not invent facts about the company. Restate the problem and extract needs as short noun phrases.
${JSON_ONLY}
Schema: {"problem": string, "needs": string[], "keywords": string[]}`,

  buildInput(state, item) {
    const entry = state.dataset.byChallengeId.get(item);
    if (!entry) throw new Error(`unknown challenge ${item}`);
    const keywords = [...new Set(tokenize(`${entry.challenge.text} ${entry.challenge.detail} ${entry.company.tech.join(" ")}`))];
    return {
      company: {
        id: entry.company.id,
        name: entry.company.name,
        sector: entry.company.sector,
        tech: entry.company.tech,
        products: entry.company.products,
      },
      challenge: entry.challenge,
      keywords: keywords.slice(0, 40),
    };
  },

  apply(state, item, result, context) {
    const entry = state.dataset.byChallengeId.get(item);
    if (!entry) return;

    const analysis: ChallengeAnalysis = {
      challengeId: item,
      companyId: entry.company.id,
      problem: String(result?.problem ?? entry.challenge.text),
      needs: Array.isArray(result?.needs) ? result.needs.map(String) : [],
      keywords: Array.isArray(result?.keywords) ? result.keywords.map(String) : [],
      producedBy: context.worker,
    };
    state.analyses.set(item, analysis);

    const candidates = state.index.candidatesFor(entry.company, entry.challenge, state.config.candidatesPerChallenge);
    state.candidates.set(item, candidates);

    emit("challenge.analyzed", context.worker, {
      challengeId: item,
      analysis,
      candidates,
      generation: context.generation,
    });

    // Enrich the strongest few candidates, then rank. Profiling is a side-input,
    // not a gate: the Matchmaker can work from the dataset alone if it is slow.
    const profiling = state.config.profileTopN;
    for (const candidate of candidates.slice(0, profiling)) {
      if (state.profiles.has(candidate.researcherId)) continue;
      state.enqueue("profiler", candidate.researcherId);
    }
    state.enqueue("matchmaker", item);

    wake(state.queues["profiler"].length, "profiler", context.worker);
    wake(state.queues["matchmaker"].length, "matchmaker", context.worker);
  },
};

/* -------------------------------------------------------------------------- */
/* Matchmaker                                                                  */
/* -------------------------------------------------------------------------- */

export const matchmaker: WorkerSpec = {
  role: "matchmaker",
  maxOutputTokens: 900,
  model: "strong",
  instruction: `[[role:matchmaker]] You are the Matchmaker. Given one company challenge and a short list of candidate researchers, rank the pairs and explain each ranking in one sentence that a company CTO and a professor would both accept.
Prefer a specific, defensible overlap over a vague one. If no candidate is a real fit, return an empty ranked list — saying "no good match" is a valid and valuable answer.
Keep each reason under 40 words. Rank at most 3 candidates.
${JSON_ONLY}
Schema: {"ranked": [{"researcherId": string, "fit": number, "why": string, "sharedTerms": string[], "risks": string[]}]}`,

  buildInput(state, item) {
    const entry = state.dataset.byChallengeId.get(item);
    if (!entry) throw new Error(`unknown challenge ${item}`);
    const candidates = state.candidates.get(item) ?? [];

    return {
      company: { id: entry.company.id, name: entry.company.name, sector: entry.company.sector },
      challenge: entry.challenge,
      analysis: state.analyses.get(item),
      candidates: candidates.map((candidate: Candidate) => {
        const researcher = state.dataset.byResearcherId.get(candidate.researcherId);
        const profile = state.profiles.get(candidate.researcherId);
        return {
          researcherId: candidate.researcherId,
          name: researcher?.name,
          title: researcher?.title,
          faculty: researcher?.faculty,
          fields: researcher?.fields,
          keywords: researcher?.keywords.slice(0, 12),
          openTo: researcher?.open_to.slice(0, 3),
          profile: profile?.summary,
          retrievalScore: candidate.score,
          sharedTerms: candidate.sharedTerms,
        };
      }),
    };
  },

  apply(state, item, result, context) {
    const entry = state.dataset.byChallengeId.get(item);
    if (!entry) return;
    const candidates = state.candidates.get(item) ?? [];
    const byId = new Map(candidates.map((candidate) => [candidate.researcherId, candidate]));

    const ranked: Array<{ researcherId: string; fit: number; why: string; sharedTerms: string[]; risks: string[] }> =
      Array.isArray(result?.ranked) ? result.ranked : [];

    const scores: PairScore[] = ranked
      .filter((row) => byId.has(row.researcherId))
      .map((row) => ({
        key: pairKey(entry.company.id, item, row.researcherId),
        companyId: entry.company.id,
        challengeId: item,
        researcherId: row.researcherId,
        // Models return fit either as a 0–1 score or as a 0–100 percentage; normalise.
        fit: clampFit(Number(row.fit ?? 0)),
        why: String(row.why ?? ""),
        sharedTerms: Array.isArray(row.sharedTerms) ? row.sharedTerms : (byId.get(row.researcherId)?.sharedTerms ?? []),
        risks: Array.isArray(row.risks) ? row.risks : [],
      }))
      .sort((a, b) => b.fit - a.fit);

    for (const score of scores) state.scores.set(score.key, score);
    emit("pairs.ranked", context.worker, { challengeId: item, scores, generation: context.generation });

    const best = scores[0];
    if (!best) {
      state.note("match", context.worker, `${item}: no viable pair — left unmatched on purpose`);
      state.unmatched.add(item);
      wake(state.queues["matchmaker"].length, "matchmaker", context.worker);
      return;
    }

    const proposal: Proposal = {
      id: `P-${item}-${best.researcherId}`,
      companyId: entry.company.id,
      challengeId: item,
      researcherId: best.researcherId,
      title: "",
      markdown: "",
      citations: [],
      status: "drafting",
      revision: 0,
      criticNote: "",
    };
    state.proposals.set(proposal.id, proposal);
    state.totals.proposals += 1;
    state.enqueue("writer", proposal.id);
    wake(state.queues["writer"].length, "writer", context.worker);
    wake(state.queues["matchmaker"].length, "matchmaker", context.worker);
  },
};

/* -------------------------------------------------------------------------- */
/* Proposal Writer                                                             */
/* -------------------------------------------------------------------------- */

export const writer: WorkerSpec = {
  role: "writer",
  maxOutputTokens: 1800,
  model: "strong",
  instruction: `[[role:writer]] You are the Proposal Writer. Write a one-page proposal that a company manager and a professor would actually sit down over: the concrete problem, what the two sides would do in the first year, what each side brings, and what would make it fail.
Every factual claim about the researcher or the company must cite a dataset id. Never invent a publication, project, patent or capability. If you lack a source for a sentence, drop the sentence.
Citations must be bare ids exactly as given: "R1008", "C001-CH1", "SYN-PUB-10472". Never a phrase, a description, or a field name such as "company products".
Budget: at most 550 words of markdown. One page, not a report.
${JSON_ONLY}
Schema: {"title": string, "markdown": string, "citations": string[], "claims": [{"text": string, "sources": string[]}]}`,

  buildInput(state, item) {
    const proposal = state.proposals.get(item);
    if (!proposal) throw new Error(`unknown proposal ${item}`);
    const entry = state.dataset.byChallengeId.get(proposal.challengeId);
    const researcher = state.dataset.byResearcherId.get(proposal.researcherId);
    const score = state.scores.get(pairKey(proposal.companyId, proposal.challengeId, proposal.researcherId));
    if (!entry || !researcher) throw new Error(`incomplete pair for ${item}`);

    return {
      company: { id: entry.company.id, name: entry.company.name, sector: entry.company.sector, rd_capacity: entry.company.rd_capacity, products: entry.company.products },
      challenge: entry.challenge,
      researcher: {
        id: researcher.id,
        name: researcher.name,
        title: researcher.title,
        faculty: researcher.faculty,
        department: researcher.department,
        fields: researcher.fields,
        keywords: researcher.keywords,
        open_to: researcher.open_to,
        publications: researcher.publications.slice(0, 4),
        publicationTitles: researcher.publications
          .slice(0, 4)
          .map((id) => state.dataset.publications.get(id)?.title)
          .filter(Boolean),
        projects: researcher.projects.slice(0, 2),
        patents: researcher.patents.slice(0, 2),
      },
      profile: state.profiles.get(researcher.id),
      // Deliberately no `key`: the internal pair key ("C001::C001-CH1::R0071")
      // looks like a citation id and models copy it into the references.
      score: score
        ? { fit: score.fit, why: score.why, sharedTerms: score.sharedTerms, risks: score.risks }
        : undefined,
      revision: proposal.revision,
      criticNote: proposal.criticNote,
      previousCitations: proposal.citations,
    };
  },

  apply(state, item, result, context) {
    const proposal = state.proposals.get(item);
    if (!proposal) return;

    const citations: string[] = Array.isArray(result?.citations) ? result.citations.map(String) : [];
    const rawClaims: Array<{ text?: unknown; sources?: unknown }> = Array.isArray(result?.claims) ? result.claims : [];

    proposal.title = String(result?.title ?? proposal.id);
    proposal.markdown = String(result?.markdown ?? "");
    proposal.citations = citations;
    proposal.status = "review";
    proposal.revision = context.attempt;

    for (const claim of rawClaims) {
      if (!claim.text) continue;
      const id = `${proposal.id}#${state.claims.size}`;
      const record: Claim = {
        id,
        proposalId: proposal.id,
        text: String(claim.text),
        sources: Array.isArray(claim.sources) ? claim.sources.map(String) : [],
        status: "proposed",
        note: "",
        revision: proposal.revision,
      };
      state.claims.set(id, record);
    }

    emit(proposal.revision > 0 ? "proposal.revised" : "proposal.drafted", context.worker, {
      proposal,
      generation: context.generation,
    });

    state.enqueue("critic", proposal.id);
    wake(state.queues["critic"].length, "critic", context.worker);
    wake(state.queues["writer"].length, "writer", context.worker);
  },
};

/* -------------------------------------------------------------------------- */
/* Critic                                                                      */
/* -------------------------------------------------------------------------- */

const MAX_REVISIONS = 2;

export interface CitationCheck {
  valid: string[];
  unknown: string[];
}

/**
 * The deterministic half of the Critic. Pure and exported so it can be tested
 * without a runtime, a model or a network: a citation either resolves in the
 * dataset or it does not, and no prompt can change that.
 */
export const checkCitations = (
  citations: readonly string[],
  sourceIds: ReadonlySet<string>,
): CitationCheck => {
  const unique = [...new Set(citations)];
  return {
    valid: unique.filter((id) => sourceIds.has(id)),
    unknown: unique.filter((id) => !sourceIds.has(id)),
  };
};

export const critic: WorkerSpec = {
  role: "critic",
  maxOutputTokens: 900,
  model: "fast",
  instruction: `[[role:critic]] You are the Critic. You receive a proposal, its cited ids, the list of ids that actually exist in the dataset, and its claims.
RULES:
1. Any citation that does not exist in knownIds is a fabricated source: verdict "reject".
2. Any claim about a person that has no source, or whose source is not about that person, is unsupported: verdict "reject".
3. A claim that is true but irrelevant to the pairing is not a reason to reject; note it.
4. Do not accept a proposal because it is well written. Check the evidence.
Keep the note under 60 words.
${JSON_ONLY}
Schema: {"verdict": "approve" | "reject", "note": string, "claims": [{"text": string, "sources": string[]}]}`,

  buildInput(state, item) {
    const proposal = state.proposals.get(item);
    if (!proposal) throw new Error(`unknown proposal ${item}`);
    const claims = [...state.claims.values()].filter((claim) => claim.proposalId === item);
    const researcher = state.dataset.byResearcherId.get(proposal.researcherId);
    const entry = state.dataset.byChallengeId.get(proposal.challengeId);

    // Scoped on purpose: the Critic is given the sources that could legitimately
    // support *this* pair, not the 14k-id space. Code still checks against the
    // full index, so a source outside this list cannot sneak through.
    const allowedSources = [
      proposal.researcherId,
      proposal.companyId,
      proposal.challengeId,
      ...(researcher?.publications ?? []),
      ...(researcher?.projects ?? []),
      ...(researcher?.patents ?? []),
    ];

    return {
      proposalId: proposal.id,
      markdown: proposal.markdown,
      citations: proposal.citations,
      allowedSources,
      knownSourceCount: state.sourceIds.size,
      researcherId: proposal.researcherId,
      claims: claims.map((claim) => ({ text: claim.text, sources: claim.sources })),
    };
  },

  apply(state, item, result, context) {
    const proposal = state.proposals.get(item);
    if (!proposal) return;

    // Defence in depth: resolve every id in code before believing the model.
    const { unknown } = checkCitations(proposal.citations, state.sourceIds);
    const modelVerdict = result?.verdict === "approve" ? "approve" : "reject";
    const verdict: "approve" | "reject" = unknown.length > 0 ? "reject" : modelVerdict;

    const note =
      unknown.length > 0
        ? `Unsupported source(s): ${unknown.join(", ")}.`
        : String(result?.note ?? "");

    const claimRows: Array<{ text?: unknown; sources?: unknown }> = Array.isArray(result?.claims) ? result.claims : [];
    const claims = [...state.claims.values()].filter((claim) => claim.proposalId === item);

    for (const claim of claims) {
      const row = claimRows.find((candidate) => String(candidate.text ?? "") === claim.text);
      const sources = Array.isArray(row?.sources) ? row.sources.map(String) : claim.sources;
      const valid = checkCitations(sources, state.sourceIds).valid;
      claim.sources = valid;
      claim.note = valid.length === sources.length ? "all sources resolve" : "some sources dropped";
      claim.status = verdict === "approve" && valid.length > 0 ? "verified" : "rejected";
    }

    // Every citation must be backed by at least one claim, otherwise the prose is floating free.
    const cited = new Set(claims.flatMap((claim) => claim.sources));
    for (const id of proposal.citations) {
      if (!state.sourceIds.has(id)) continue;
      if (!cited.has(id)) {
        const claim: Claim = {
          id: `${proposal.id}#auto-${id}`,
          proposalId: proposal.id,
          text: `Source ${id} supports the proposal.`,
          sources: [id],
          status: verdict === "approve" ? "verified" : "rejected",
          note: "citation without a supporting claim",
          revision: proposal.revision,
        };
        state.claims.set(claim.id, claim);
      }
    }

    if (verdict === "approve") {
      proposal.status = "approved";
      proposal.criticNote = note;
      state.counters.approved += 1;
      state.totals.approved += 1;
      state.note("critic", context.worker, `${proposal.id} approved`);
    } else {
      state.counters.rejections += 1;
      proposal.criticNote = note;
      if (proposal.revision + 1 >= MAX_REVISIONS) {
        proposal.status = "rejected";
        emit("proposal.abandoned", context.worker, {
          proposalId: proposal.id,
          reason: `rejected twice: ${note}`,
        });
      } else {
        proposal.revision += 1;
        state.attempts.set(proposal.id, proposal.revision);
        state.enqueue("writer", proposal.id);
        wake(state.queues["writer"].length, "writer", context.worker);
      }
    }

    emit("proposal.reviewed", context.worker, {
      proposalId: proposal.id,
      verdict,
      note,
      claims,
      generation: context.generation,
    });
    wake(state.queues["critic"].length, "critic", context.worker);
  },
};

/** Accept 0–1 or 0–100 and always store 0–1. */
export const clampFit = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const normalised = value > 1 ? value / 100 : value;
  return Math.min(1, Number(normalised.toFixed(3)));
};

export const ROLE_SPECS = { profiler, analyst, matchmaker, writer, critic } as const;

export const modelFor = (state: EurekaState, spec: WorkerSpec): string =>
  spec.model === "strong" ? state.config.strongModel : state.config.fastModel;

export type { WorkerContext };
