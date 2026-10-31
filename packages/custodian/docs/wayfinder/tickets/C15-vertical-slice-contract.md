---
id: C15
title: "Vertical slice contract"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: [C03, C06, C07, C09, C10, C11, C12, C14, P01, P03]
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Vertical slice contract

## Question

Define the slice precisely enough that the builder implements it without another architectural
decision.

Decide:

- **What `bun run custodian` runs.** Which scenario(s), which adapter (`sim`, `docker`, or both),
  which role set, which inference runner, which mode (live loops vs replay). What does a stranger
  see in the first 30 seconds? Include the **no-action beat** (scenario 10): the system may conclude
  that the safest action is no action, and the trace must say so.
- **What "not the fixture" means.** The current `src/index.ts` replays five intents in one call. The
  slice must show real Mozaik loops, real event bus traffic, real interception, and real state
  mutation. What is the minimum evidence of that: event counts, loop ids, interleaved trace lines,
  timestamps, two workers holding leases simultaneously?
- **The concurrency proof.** What exactly demonstrates "two or more agents actually run together" —
  a trace with overlapping `inference.started`/`function_call` spans, two pending intents in one
  decision window, two workers mutating `locks`/`decisions`, or all three? Include an **asserted
  invariant printed by the run** (e.g. `INFLIGHT 2`), not only a log a reader has to interpret. How
  is it visible without reading JSONL?
- **The conflicting-intent proof.** Which scenario shows one agent's intent changing another's
  outcome (narrow, defer, reject), and what is the before/after row?
- **Lease market.** Is the CAS/generation lease market in the slice, or is it deferred? What does it
  add to the concurrency proof, and what does it cost?
- **Scope cuts.** The docs' cut order: Docker adapter, GitHub filing, baro run, second adapter. Is
  that still right? What is *not* cuttable (the airlock and the ablation)?
- **Acceptance checklist.** A short, ordered list the builder ticks: `bun install`, `bun test`,
  `bun run custodian`, trace file exists, ablation numbers match, viewer opens, README command works
  offline. Include the failure fallback for each.
- **Timebox.** What must be true by the 22:00 Fri go/no-go, and what can land Sat morning?

## Why this is a decision, not a build

This is the keystone: it turns the individual decisions into one executable slice and fixes what
"done" means. Without it, the builder still has to choose what to wire, what to cut, and what to
show. It must satisfy the ablation design's pass condition and the correlation mechanism's proof of
concurrency.

## Inputs

- `07-demo-and-rubric.md` §"The gap that matters" and §"Three-minute script".
- `08-plan-risks-and-decisions.md` §"The plan" and §"Go / no-go".
- All mechanism decisions: correlation, model roles, second key, denial semantics, taint, adapter
  scope, evidence format, ablation design.
- `Prototype: the live run's trace table` and `Prototype: the airlock/lease timeline` for the visible
  shape.

## Resolution

**Resolved 2026-10-30 (delegated).** This is the last architectural decision before execution.

### Command contract

| Command | What it does | Required? |
| --- | --- | --- |
| `bun install && bun run custodian` | Live money scenario: real Mozaik runtime, real loops/events/interception/state, mock inference, sim adapter, CLI table + `trace.jsonl`. Exit 0 only if the five expected decisions match and `INFLIGHT >= 2`. | **Yes** |
| `bun run custodian --verbose` | Same, with every finding and vote. | Yes |
| `bun run custodian --scenario benign` | Scenario 10: open an incident, propose nothing, close with "no action". | Yes |
| `bun run custodian:ablate` | All ten scenarios × naive / checks-only / custodian (+ patched if available), writes `eval/results.json`. | **Yes** |
| `bun run custodian --adapter docker` | The money scenario against the local Compose stack; records the 403 and the evidence bundle. | Optional (recorded) |
| `bun run custodian --viewer` | Observer viewer over the trace. CLI table is the fallback. | Optional |

### What "not the fixture" means

The run initializes the real Mozaik runtime, joins every participant, publishes real events, calls
`runLoop` fire-and-forget, holds real `function_call` transitions in the interception handlers, runs
the Airlock participant's per-incident window, mutates `CustodianState.locks/decisions/intents`, and
writes JSONL. The **model is the only canned part**; the trace labels `runner: "mock"` and
`costUsd: 0`, and the README says so. The current `src/index.ts` replay (one `reconcile` call) is
replaced, not wrapped.

### Concurrency and conflict proof

- Two `interception.started` events with **different `loopId`s** before one `window.closed`.
- `window.closed` carries `INFLIGHT n`, and the CLI prints `INFLIGHT 2` (or more) plus both loop ids.
- At least two participants mutate `locks`/`decisions` in the same run; the trace shows it.
- The money scenario shows the conflict: `i-block` widened → narrowed, `i-isolate` deferred by the
  evidence lock, `i-injected` rejected despite `edge-bot` holding the capability.
- The matching evidence is the **asserted invariant** printed by the run, not a prose claim.

### Lease market

**Lightweight lease only.** Each pending intent carries `intentId + generation`; a handler that
returns after `airlock.timeout` is stale and its decision is ignored. No market, no bidding, no
work queue. The full CAS/generation market from EUREKA is not needed to prove joint authority and
would cost time. The timeline's stale-write arrow uses this generation.

### Pools and participants

Three model roles (Watch, Contain, Scribe) and four deterministic participants (Triage, Preserve,
Availability, Auditor) plus the Airlock and the Human. Caps from the role decision: Watch 1,
Triage 1, Contain 2, Preserve 1, Availability 1, Scribe 1, Auditor 1. At most 8 concurrent
participants, 3 model loops.

### Cut order (top is cut first)

1. Viewer (keep the CLI table + JSONL).
2. Docker adapter (keep the recorded sim run; label "the adapter is implemented, this demo is the
   twin").
3. GitHub issue filing (keep `outbox/` + the exact `gh` command).
4. baro run (keep the issue + goal file; no fake PR).
5. Live model (keep the mock; label it).

**Not cuttable:** the airlock, the ablation, the trace, the offline mock. Without them there is no
entry.

### Acceptance checklist

1. `bun install` in a clean clone.
2. `bun test` green: unit, invariants, airlock, ten scenarios, dual-build.
3. `bun run custodian` exits 0 offline; five decisions match; `INFLIGHT >= 2`; `trace.jsonl` written.
4. `bun run custodian --scenario benign` closes with no action and a trace reason.
5. `bun run custodian:ablate` writes `eval/results.json`; the README numbers match it.
6. `bun run custodian --adapter docker` recorded once (optional; label honestly if it fails).
7. `bun run custodian --viewer` opens the timeline (optional).
8. Clean clone on a second machine; no key required.

### Timebox

- **Fri 22:00:** airlock wired into a live loop; all ten scenarios; ablation `naive > 0`,
  `custodian = 0`. If not, EUREKA fallback.
- **Sat 08:00–12:00:** Docker recording, issue/baro handoff, README, judging map.
- **Sat 12:00–13:30:** clean-clone rehearsal and submission.
