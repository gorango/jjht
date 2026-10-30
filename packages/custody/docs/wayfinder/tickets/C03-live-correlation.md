---
id: C03
title: "Live correlation mechanism"
type: grilling
status: closed
parent: CUSTODY-MAP
blocked_by: [C01]
assignee: Goran
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Live correlation mechanism

## Question

How does the live airlock see peer intents, and what exactly is the decision window?

Choose one mechanism and specify it:

- **(a) Short await + shared pending set.** Each interception registers its intent in a shared set
  keyed by loop/agent, waits `windowMs`, then reconciles the set. The first registration starts the
  clock.
- **(b) Dedicated Airlock participant.** A participant owns the pending set and releases transitions.
  More elegant, but `runLoop` does not expose suspension; check what `C01` found.
- **(c) Deterministic ordering, no window.** Reconcile in arrival order without waiting. Simplest,
  but loses the "one intent changes another while both are half-formed" claim.

Then decide:

- `windowMs` and whether it is configurable per scenario.
- Ordering and tie-break (arrival time, id, severity) and whether priority can pre-empt arrival.
- What happens to a deferred intent: re-enqueue with retry time and cap, or drop? How is
  `intent.deferred` represented?
- What happens to an intent that arrives after the window closes.
- How the trace proves two loops were actually in flight, not a sequential fixture.
- Failure behaviour: timeout, throw, duplicate window, stale loop.

## Grilling log

**Round 1 (mechanism).** Chosen: **B — handler suspends, Airlock participant coordinates.** Each
agent's handler registers its intent and a deferred promise, publishes `intent.proposed`, and
awaits. A dedicated Airlock participant owns the pending set and the window, calls the pure
`reconcile` at the deadline, emits the window/decision events, and resolves each handler's promise.
Handler-only pending set (A) is the fallback; deterministic ordering without a window (C) is
rejected because it loses the half-formed-intent claim.

**Round 2 (mechanics).** Agreed: 1500 ms default, fixed from the first intent, one window per
incident, late intents open a fresh window; arrival order (`requestedAt`, then id); caps 32 per
window and 8 per agent, overflow `window_overflow`; `defer` resolves the handler now with a refusal
and retries the stored intent up to 3 times, then `intent.exhausted`; events `intent.proposed`,
`window.opened`, `window.closed`, `decision.made`, `intent.deferred`, `intent.retried`,
`intent.exhausted`, `airlock.timeout`; `INFLIGHT n` on `window.closed`; injected `Clock`; handler
timeout at `windowMs + 1000 ms` fails closed as `airlock_timeout`; duplicate intent id is idempotent;
stale decisions are ignored; pending is keyed by `intentId`; the per-agent cap is the only same-agent
limit.

**Round 3 (retry execution).** Agreed: an accepted retry is executed by the Airlock participant
through the **shared execution port** (the same `act` executor/adapter the tool uses), not by a
model. The trace records `action.executed` with `path: "airlock-retry"`; the same rule covers an
intent accepted after its handler timed out. The airlock remains the only path from intent to
effect.

## Why this is a decision, not a build

This is the mechanism the 30-point Mozaik criterion rests on. It also fixes the demo's central beat:
one agent's veto rewrites another's action before either runs. Getting it wrong turns the entry back
into a pipeline in disguise.

## Inputs

- `Correlation mechanics in Mozaik v4.1.0` for what the API permits.
- `03-airlock.md` §"Open questions" 1 and §"Failure modes".
- `01-architecture.md` §"Concurrency".
- `09-mozaik-api-notes.md` on `runLoop` being fire-and-forget and `handle` being awaited.

## Resolution

**Resolved 2026-10-30.** Chosen: **B — handler suspends, Airlock participant coordinates.** The full
decision:

### Mechanism

- Each agent gets its own `InterceptionHandler` instance, closed over `agentId` (C01: the transition
  carries no identity). On a `function_call` to `act`, the handler parses the call into an `Intent`,
  registers a deferred promise under `intentId`, publishes `intent.proposed`, and awaits.
- A dedicated **Airlock participant** subscribes to `intent.proposed`. It owns the pending set and
  the window clock, calls the existing pure `reconcile(intents, ctx)` at the deadline, emits the
  window/decision events, and resolves each handler's promise with its own `Decision`.
- The handler applies allow / rewrite / deny to **its own** transition. Peer influence is mediated by
  the airlock's joint decision, not by one handler mutating another's transition.

### Window

- Default `1500 ms`, configurable through `CustodyState.config.windowMs`.
- Starts at the **first** `intent.proposed` for an incident; the deadline is fixed. Later intents
  join if they arrive before it; they never extend it.
- **One window per `incidentId`**; missing incident id falls into a synthetic `global` bucket.
- An intent arriving after `window.closed` opens a fresh window immediately and shares it with other
  late arrivals.
- `window.closed` records `lateByMs` so a busy timer is visible.

### Ordering and caps

- Reconcile in arrival order: `requestedAt`, then `intentId`. No severity ordering — severity is
  agent-asserted and would let a compromised agent jump the queue.
- Cap 32 pending intents per window and 8 per agent. Overflow is rejected with `window_overflow`;
  it does not extend the window.
- Pending is keyed by globally unique `intentId`; one agent may hold multiple intents in a window
  (Contain legitimately proposes two). The per-agent cap is the only same-agent limit.

### Defer and retry

- `defer` resolves the handler **immediately** with a refusal/no-op so the loop is not parked. The
  airlock stores the intent with `retryAt`, `attempt`, and a cap of 3.
- A later window re-evaluates the stored intent as a new attempt. On acceptance, the Airlock
  participant executes it through the **shared execution port** (the same `act` executor/adapter),
  emitting `action.executed` with `path: "airlock-retry"`. The same rule applies to an intent
  accepted after its handler timed out.
- After the cap the intent becomes `reject` with `intent.exhausted`. Deferred is not forgotten, and
  deferred does not hold a loop.
- The exact refusal wire format is *Denial semantics* (C09); this ticket fixes the lifecycle only.

### Trace and proof

- New events: `intent.proposed`, `window.opened`, `window.closed`, `decision.made`,
  `intent.deferred`, `intent.retried`, `intent.exhausted`, `airlock.timeout`, `action.executed`.
- `window.closed` carries `INFLIGHT n` (handlers held at the deadline). The CLI prints the assertion.
- Concurrency proof: two `interception.started` events with different `loopId`s before one
  `window.closed`, plus `INFLIGHT n`. The viewer subscribes only to bus events.
- Inject a `Clock` (`now`, `sleep`) so tests advance the window deterministically; production uses
  real timers.
- Because `runLoop` is fire-and-forget and has no `loop.completed` (C01), the trace listener must be
  attached before `runLoop`; quiescence is tracked separately by the scheduler.

### Failure

- Handler safety timeout at `windowMs + 1000 ms`; on expiry emit `airlock.timeout` and fail closed
  with refusal reason `airlock_timeout`.
- If the Airlock participant is absent or its processor throws, it catches and logs, then resolves
  every pending handler with a deny. A handler that returns after timeout is stale; its decision is
  ignored.
- Duplicate `intent.proposed` for the same `intentId` is idempotent — first wins.
- Process death has no recovery; persistence is out of scope.

### Rejected

- **A — handler-only pending set:** kept as the fallback; both share `reconcile`, so the switch is
  cheap, but it gives the airlock no bus identity and races on who owns the timer.
- **C — deterministic ordering with no window:** rejected; it loses the half-formed-intent claim.
- **Holding a deferred transition until retry:** rejected; it parks a loop unboundedly and starves
  the pool.
- **Re-proposing a retry to the original agent:** rejected; it depends on the model and can silently
  fail. The airlock owns the intent after the handler returns.

Implementation is now a wiring exercise: `src/agents/airlock-handler.ts` becomes the propose/await
adapter, a new Airlock participant owns the window, and `reconcile` stays untouched. The executor
port's concrete shape is fixed by *Vertical slice contract* (C15).
