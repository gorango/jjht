---
id: P01
title: "Prototype: the live run's trace table"
type: prototype
status: closed
parent: CUSTODIAN-MAP
blocked_by: [C03, C06, C07, C09]
assignee: null
labels: [wayfinder:ticket, wayfinder:prototype]
---

# Prototype: the live run's trace table

## Question

What does the live run's trace table look like, and what must it make obvious at a glance?

Build a **cheap, rough** prototype from a simulated concurrent trace — not the final worker — and
react to it. The prototype answers the viewer's information design, not its implementation.

Decide by looking at the artifact:

- **Columns.** Time, participant, event, intent, vote, decision, reason, window, loop id, cost? Which
  are load-bearing and which are noise?
- **Ordering.** Arrival order, decision order, or grouping by intent? How do two loops in flight
  appear without interleaving into unreadability?
- **The one row that wins the argument.** The narrowed block, the deferred isolate, the rejected
  injection. How does the table make each legible in under five seconds?
- **Defer/retry.** How does a deferred intent reappear without looking like a duplicate?
- **Denial.** How does a refused intent show the vote and reason (`C09`), without looking like a
  no-op tool ran?
- **Density.** How much fits on one terminal screen / one slide? What is the `--verbose` view?
- **Trace vs table.** The JSONL trace is the machine artifact; the table is the human view. Which
  fields are derived, and which are authored?

## Artifact

A Markdown or HTML mock (or a tiny script over a hand-written trace) committed under
`docs/wayfinder/assets/` or linked from this ticket. It must be disposable; do not build the real
trace observer here.

## Why this is a prototype, not a build

The viewer shape follows the trace shape, and the trace shape follows the concurrency mechanism.
A rough table is the cheapest way to discover that a column is missing before the worker is wired.

## Inputs

- `03-airlock.md` §"Votes" and §"Rewrite vs deny".
- `07-demo-and-rubric.md` §"Three-minute script".
- `Live correlation mechanism`, `Model-driven roles and the offline runner`, `Second key mechanics`,
  `Denial semantics`.

## Resolution

**Resolved 2026-10-30.** Artifact: [p01-trace-table.md](../assets/p01-trace-table.md).

- **Columns:** `t`, `participant`, `event`, `intent`, `vote`, `decision`, `reason`, `window`. The
  real trace adds `loopId`, `producerId`, runner/cost and wall-clock `at`.
- **Ordering:** proposal order within the window, then one `window.closed` row carrying `INFLIGHT n`,
  then decisions in arrival order, then executions. Grouping by intent would hide the concurrency;
  grouping by time shows it.
- **The winning rows:** the widened block → narrowed `/32`, the deferred isolate, the rejected
  injection with three votes. Each fits on one line.
- **What the prototype revealed:** without an explicit `window.closed`/`INFLIGHT` row, the table
  reads like a sequential pipeline even when the events overlap. The row is load-bearing, not
  decoration.
- **Defer/deny:** a deferred intent shows `intent.deferred` with `retryAt` and `attempt`; a denied
  intent shows `decision.made` + `refuse_action`, never `action.executed`. The viewer distinguishes
  them by the presence of `action.executed`.
- **Density:** one screen for the five-intent money scenario; `--verbose` adds every finding and
  vote; the JSONL stays the machine artifact. The CLI table is enough for the demo if the viewer
  breaks.
