---
id: P03
title: "Prototype: airlock/lease timeline in the viewer"
type: prototype
status: closed
parent: CUSTODIAN-MAP
blocked_by: [P01]
assignee: null
labels: [wayfinder:ticket, wayfinder:prototype]
---

# Prototype: airlock/lease timeline in the viewer

## Question

What does the airlock/lease timeline look like, and what makes it **proof of concurrency** rather
than decoration?

Build a rough timeline from the trace-table prototype's simulated trace. React to it.

Decide by looking at the artifact:

- **Lanes.** One per participant? One per loop? One per intent? How do Contain, Preserve and
  Availability appear to start at the same moment?
- **The window.** How is the 1.5 s decision window drawn, and how does a peer's intent enter it while
  another is held?
- **Leases.** How does a claim/generation appear, and how does an expired lease show a stale write
  being discarded? If the lease market is cut from the slice, what replaces this proof?
- **Decisions.** How do accept / rewrite / defer / reject map to colour or shape, and how does a
  narrowing show as a before/after bar?
- **Human second key.** How does the held lease and the wait appear? Is the human lane visible?
- **Failure.** What does a timeout, a stale loop, or a starvation look like in the timeline?
- **The five-second test.** Can a judge see "two agents ran at once, and one changed the other"
  without reading labels?

## Artifact

A static HTML/SVG mock or a tiny script that renders a hand-written trace, committed under
`docs/wayfinder/assets/` or linked from this ticket. Disposable; do not build the final viewer here.

## Why this is a prototype, not a build

The 30-point criterion is judged by what a judge can see. A timeline makes concurrency legible in a
way a table cannot. The prototype tests whether the trace has the spans the timeline needs before
the trace observer is built.

## Observer, not a special case

The viewer must be an **observer participant** subscribed to the bus, not a side-channel that reads
internal state. Confirm in the prototype which events it needs and whether the current event
catalogue emits them; a missing event is a trace requirement, not a viewer hack.

## Inputs

- `Prototype: the live run's trace table` for the trace shape.
- `01-architecture.md` §"Concurrency" and §"Shared state".
- `07-demo-and-rubric.md` §"Three-minute script".
- `Second key mechanics` for the human lane.
- EUREKA's existing viewer may be liftable; check `packages/eureka` before designing from scratch.

## Resolution

**Resolved 2026-10-30.** Artifact: [p03-timeline.md](../assets/p03-timeline.md).

- **Lanes:** Watch, Triage, Contain, Preserve, Availability, Airlock, Human. The three acting lanes
  are drawn in a `par` block; the airlock is a single lane that receives all proposals.
- **Window:** a shaded interval from the first `intent.proposed` to `window.closed`, with `INFLIGHT`
  on the closing line. A late intent opens a new interval.
- **Decisions:** accept = solid arrow, rewrite = arrow with the old/new label, defer = dashed arrow
  to a later window, reject = crossed arrow. A stale resolution after `airlock.timeout` is a
  crossed-out arrow, not a second execution.
- **Human lane:** the second-key request/grant is a held lease with a visible wait and a 30 s expiry.
  The human lane is optional in the first demo cut but the trace events exist either way.
- **Five-second test:** a judge sees three lanes active before the window closes and one arrow change
  another. That is the proof; the topology graph is not.
- **Observer:** the viewer subscribes to the bus as an observer participant, not a side-channel. The
  trace fields it needs are listed in the artifact; a missing field is a trace change, not a viewer
  hack.
- **Lease lane:** the timeline needs a generation on each pending intent to draw a stale write as
  stale. This is the one lease requirement the slice keeps: a lightweight `intentId + generation`,
  not a full market.
