---
id: C17
title: "Claim discipline and README contract"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: [C13, C14, C15, C16, T02]
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Claim discipline and README contract

## Question

What may the README and the demo assert as **verified**, and what must stay labelled unverified?

Decide:

- **The claim table.** One row per Freestyle criterion, each pointing at a file and a command:
  parallel agents, shared state, it works, README. This becomes `docs/judging.md`.
- **Numbers.** Which ablation numbers are quoted, from which committed artifact, and how a judge
  regenerates them. If the pass condition fails, what does the README say instead?
- **The Docker claim.** "One recorded real run" vs "the demo is the twin". What recording is
  committed, and how is it labelled if it was edited or re-run?
- **The baro claim.** Issue URL, goal file, PR URL, or outbox — what is real, what is a fallback,
  and what is explicitly not claimed (no fake PR, no merge by the agent).
- **Honest limitations.** The memory-capture disclaimer, the self-graded scenarios, the deterministic
  demo, the model being canned offline, the ten scenarios being authored by the builder. Where do
  they live so a judge sees them before asking?
- **The 60-second block.** The README's first screen: the sentence, the command, the one table, the
  one diagram. What is cut from the 22 KB of docs to fit it?
- **Judge Q&A.** The three likely questions — "is this real?", "why not just CDN/WAF rules?", "what
  stops a compromised agent?" — only if the answers are evidence-backed. Otherwise they stay fog.

## Why this is a decision, not a build

The rubric gives 15 points for the README and 25 for "it works". The cheapest points are also the
easiest to lose by overclaiming. This ticket fixes the boundary between verified and aspirational
before the final rewrite, so the builder does not have to make a judgement call under deadline
pressure.

## Inputs

- `07-demo-and-rubric.md` §"Mapping, honestly" and §"Judging map (to finish)".
- `04-judge-and-evidence.md` §"Self-grading risks".
- `Ablation and verification design`, `Vertical slice contract`, `Baro handoff contract`,
  `Name and one-line framing`.
- `Repo visibility and name before submission` for the final URL.

## Resolution

**Resolved 2026-10-30 (delegated).** The README may claim only what a command or a committed artifact
proves.

### Claim table (`docs/judging.md`)

| Criterion | Where | Proof |
| --- | --- | --- |
| Useful & original | `docs/00-thesis.md`; README opening | The sentence + the conflict table; no number required. |
| Mozaik: agents in parallel | `src/agents/worker.ts`, `pool.ts`, airlock participant | `bun run custodian` prints `INFLIGHT >= 2` and two loop ids before `window.closed`. |
| Mozaik: shared state | `src/runtime/state.ts` | Trace: two participants mutate `locks`/`decisions`; `intent.proposed` / `decision.made`. |
| It works | README | `bun install && bun run custodian` offline; `bun test`; clean clone. |
| README clarity | README first screen | 60-second block, one diagram, one table, one command. |
| Ablation | `eval/results.json` | `bun run custodian:ablate`; numbers quoted only from this file. |
| Real seam | `docs/research/c02-docker-reversibility.md` | Recorded Docker run or the honest twin label. |
| Slow loop | issue #1, `outbox/inc-1/goal.txt` | Real issue URL; goal file; PR only if it exists. |

### README opening (60-second block)

1. The one sentence.
2. `bun install && bun run custodian` and the five-row table.
3. The ablation table (once `eval/results.json` exists).
4. One architecture diagram and the "what ran at the same time" paragraph.
5. Honest limitations.

### Numbers

- The P02 prototype's `naive 3 / custodian 0` is a **prototype on one scenario**, not the headline.
  Quote it only with that label.
- The headline is the full ten-scenario `eval/results.json`: `custodian = 0`, `naive > 0` on ≥3,
  `checks-only = naive`. If the pass condition fails, say so; do not quote a partial as the result.
- Cost is `$0` in mock; if live mode is used, quote the trace cost and label it.

### Docker and baro claims

- Docker: "one recorded local run" or "the adapter is implemented; this demo is the twin." Never
  pretend the twin is Docker.
- baro: issue #1 is real; the goal file is committed; a PR is upside. **No fake PR, no claimed
  merge.** The merge is the human's call.
- The scratch repo is public; the entry repo is separate. Do not imply the scratch fixture is the
  product.

### Honest limitations (put them before a judge asks)

- No memory capture; the snapshot is logs, process table, connections and hashes.
- The ten scenarios and labels are the builder's, with three external patterns cited; a judge can
  recompute and disagree.
- The offline model is canned; the runtime is real. Live mode is optional.
- Ten scenarios are not statistical significance; report per-scenario rows.
- The demo is deterministic by construction; one unedited Docker/baro run balances it, or the README
  says it was not run.
- The origin repo's EUREKA history predates the event; disclose it, do not hide it.

### Judge Q&A (evidence-backed only)

- **"Is this real?"** Open `src/domain/invariants.ts`; run `bun test`; show the trace with two loop
  ids and the window.
- **"Why not just CDN/WAF rules?"** A WAF cannot defer to an evidence lock, hold two half-formed
  intents in one window, or require a second key for an irreversible action. CUSTODIAN is an authority
  model, not a signature.
- **"What stops a compromised agent?"** Capability, provenance and taint are checked in code before
  the action; a compromised agent can propose, but it cannot clear the taint bit or exceed its
  capability. The airlock is the only path to effect.

### Fallback wording

If a claim fails, say exactly which command failed and what was not run. "The adapter is implemented,
the demo is the twin" is acceptable; a fake 403 is not.
