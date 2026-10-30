# Architecture

## The bet

Most "multi-agent" systems are a `for` loop with LLM calls inside. The distinction the judges
care about — and the one the EINSTEIN brief names explicitly — is whether agents **actually run
together and coordinate**, or whether one script hands work to the next agent in a fixed order.

EUREKA has no script. There is one runtime, a set of queues, and a lease market. Every participant
is woken by an event and competes for work.

```
                    ┌──────────────────────────── Mozaik runtime ───────────────────────────┐
                    │                                                                       │
  data ──► index ──► queues ──► [profiler ×3] [analyst ×3] [matchmaker ×3] [writer ×3] [critic ×2]
                    │              ▲                 │                │             │           │
                    │              └──── claim / release ─── lease market (CAS + generation)   │
                    │                                                                       │
                    │  Scheduler: publishes initial work, closes the run when quiet          │
                    │  Trace:     subscribes to everything, writes JSONL                     │
                    └───────────────────────────────────────────────────────────────────────┘
```

## Participants

| Participant | Kind | Model | Reacts to | Publishes |
| --- | --- | --- | --- | --- |
| `Scheduler` | Human (no inference) | — | `proposal.reviewed`, `proposal.abandoned`, `task.failed` | `work.available`, `portfolio.ready`, `run.completed` |
| `Profiler-N` | Agent | fast | `work.available(profiler)` | `researcher.profiled` |
| `Analyst-N` | Agent | fast | `work.available(analyst)` | `challenge.analyzed` |
| `Matchmaker-N` | Agent | strong | `work.available(matchmaker)` | `pairs.ranked` |
| `Writer-N` | Agent | strong | `work.available(writer)` | `proposal.drafted`, `proposal.revised` |
| `Critic-N` | Agent | fast | `work.available(critic)` | `proposal.reviewed`, `proposal.abandoned` |
| `Trace` | Human observer | — | every event | — |

The Scheduler is a `Human` on purpose: it never calls `runLoop`, so it cannot become the hidden
bottleneck a "coordinator agent" usually becomes, and it costs nothing.

## Event catalogue

| Event | Payload | Meaning |
| --- | --- | --- |
| `work.available` | `{ role }` | A queue for this role is non-empty. Wakes every worker of that role. |
| `task.claimed` | `{ role, item, worker, generation }` | A worker won the lease. |
| `task.measured` | `{ role, item, model, tokens, costUsd, durationMs }` | Per-task accounting; this is the trace's cost spine. |
| `task.failed` | `{ role, item, worker, reason }` | Parse failure, stale lease, or unknown id. |
| `researcher.profiled` | `{ researcherId, profile, generation }` | Sourced profile ready. |
| `challenge.analyzed` | `{ challengeId, analysis, candidates, generation }` | Needs extracted + retrieval done. |
| `pairs.ranked` | `{ challengeId, scores[], generation }` | Candidate pairs with fit and reasons. |
| `proposal.drafted` / `proposal.revised` | `{ proposal, generation }` | First draft / post-critique revision. |
| `proposal.reviewed` | `{ proposalId, verdict, note, claims[], generation }` | Approve or reject, with the claim ledger. |
| `proposal.abandoned` | `{ proposalId, reason }` | Failed twice; not shipped. |
| `portfolio.ready` | `{ entries[] }` | Final selection. |
| `run.completed` | `{ summary }` | Counters, cost, elapsed. |

Mozaik's own loop events (`message_received.*`, `inference.*`, `model.answer`,
`function_call.*`, `interception.*`) are published alongside these and land in the same trace.

## Lease protocol

`src/domain/market.ts`.

1. A worker wakes on `work.available`, shifts an id off the queue.
2. It calls `market.claim(key, workerId, ttl)`. If another live lease holds the key, the claim fails
   and the item goes back on the queue.
3. The claim returns a **generation** — a monotonically increasing integer, not just an owner name.
4. When the answer arrives, the worker verifies `market.isCurrent(key, generation)` before writing.
   A lease that expired and was re-claimed by someone else makes the old worker's write a no-op.
5. The worker releases the lease *before* publishing the result. `apply` is synchronous, so nothing
   can interleave; releasing first means the completion check that runs on the resulting event sees
   a quiet market. (This ordering was a real bug: with release-after-publish, every run idled until
   the watchdog fired.)

TTL defaults to 120s. An expired lease is reclaimable, which is how a crashed or wedged worker
recovers without a supervisor.

## Why one task in flight per worker

`runLoop` is fire-and-forget, and `model.answer` carries no loop id. If a worker ran two loops at
once, it could not tell which answer belonged to which task without threading correlation ids
through the prompt — fragile and provider-dependent.

So each worker runs exactly one turn at a time. Parallelism comes from the **pool**, not from
fan-out inside one agent. This also bounds cost: N workers = at most N concurrent model calls.

The alternative — one "orchestrator" agent fanning out — hides concurrency inside a single context
window and is exactly the anti-pattern the brief warns about.

## Context isolation

Agent memory is not used for task state. Every turn builds a fresh `ModelContext` with the role's
developer message and the JSON envelope:

```ts
const context = ModelContext.create();
context.addContextItem(DeveloperMessageItem.create(instruction));
runLoop(id, JSON.stringify(envelope), { model, context, tools: [] });
```

Two reasons. First, a long-lived `Memory` accumulates every previous task, so tokens grow
quadratically and an agent's later work is contaminated by earlier work. Second, the published
Mozaik guidance is that one `Memory` across two live turns mutates in place and can be rejected by
the provider. Fresh context per turn is the safe concurrent default.

## The Critic's two passes

1. **Code.** Every citation is looked up in `state.sourceIds` (researchers, publications, projects,
   patents, challenges, companies — ~14k ids built once at boot). Unknown id ⇒ `reject`, no matter
   what the model says. Claims are re-checked against the same index, and sources that do not
   resolve are dropped from the claim.
2. **Model.** The Critic receives the proposal, its claims, and a **scoped** `allowedSources` list
   for this pair. It judges relevance and support, not existence.

Scoping matters: passing all 14k ids cost ~62k input tokens per review in an early build. Scoped,
a review is ~1k tokens. The full-index check did not get weaker — it moved into code, where it
belongs.

Rejection path:

```
Writer ──proposal.drafted──► Critic ──proposal.reviewed(reject)──► Writer (revision 1)
                                                                     │
                                                        ──proposal.drafted──► Critic
                                                                                │
                                                approve ◄── or ── abandon after 2 revisions
```

The revision counter lives in `state.attempts`, and a rejection costs a full re-draft rather than a
patch — the Writer sees the previous citations and the Critic's note, and must produce a coherent
new document.

## Completion

`settled(state)` is true when:

- the market has no live leases,
- every queue is empty,
- every challenge has been analysed,
- every analysed challenge has a proposal that is `approved` or `rejected`, or is in `unmatched`.

The Scheduler evaluates this on every decision event. In the mock run it fires about a second in, on the
same event that approves the last proposal. A watchdog (`20s` mock, `15min` real) force-closes the
run and prints a diagnosis (queues, leases, undecided challenges) so a stall is debuggable instead
of silent.

## Cost model

`src/inference/pricing.ts` holds estimated USD/M-token prices, overridable with
`EUREKA_PRICES='{"model":{"in":1,"out":3}}'`. Every turn emits `task.measured`, so the trace can
answer "which role spends the money" — usually the Writer, because Matchmaker and Writer use the
strong model while Profiler, Analyst and Critic use the fast one.

The mock run above: 53 model calls, 61k in / 17k out, ~$0.16 estimated, 0.9s wall clock. In real
mode expect minutes rather than milliseconds, and a few dollars for the default scale.

## Failure modes and what happens

| Failure | Handling |
| --- | --- |
| Model returns prose around JSON | `parseJson` strips fences and takes the outermost object; failure ⇒ retry once, then `task.failed`. |
| Model returns structurally valid but wrong JSON | Crop-level filters: Matchmaker rows for unknown researchers are dropped; Writer citations are checked downstream. |
| Worker dies mid-turn | Lease TTL expires; another worker reclaims the item. |
| Duplicate wake events | Workers are idempotent per item: the queue entry is removed on claim, and the lease blocks a second claim. |
| Everything stalls | Watchdog closes the run and prints `diagnose(state)`. |
| No acceptable pair | `unmatched` is recorded and reported in the portfolio. |
