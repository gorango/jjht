---
id: C09
title: "Denial semantics"
type: grilling
status: closed
parent: CUSTODY-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Denial semantics

## Question

When the airlock refuses an intent, what does the agent and the judge actually see?

The adapter currently rewrites a refused call to `refuse_action`, a registered no-op tool. Decide
whether that is the contract, or whether the refusal should live elsewhere:

- **(a) Rewrite to `refuse_action`.** The loop stays alive, the refusal is a normal event, the model
  sees the reason on its next turn. Risk: a judge reads it as "the tool ran a no-op", i.e. a
  workaround.
- **(b) Tool-level refusal.** The real tool consults the airlock verdict and returns a structured
  refusal. Risk: every tool needs the check; a bug in one tool becomes an authority bypass.
- **(c) Throw / stop the loop.** Risk: loses the reason, breaks the loop, weakens the "the model can
  retry with a narrower intent" story.
- **(d) A dedicated denied-transition type.** Only if the public API exposes it; check `C01`.

Also decide:

- What the trace records for a denied intent: the original call, the refusal, the vote, the reason,
  and the agent's next turn?
- Does the model get to retry, and how many times before the intent is dropped?
- Is a deferred intent distinguishable from a denied one in the trace and the viewer?
- What does "the action did not happen" mean for a tool with side effects before the call (e.g. a
  read that happened during planning)?

## Why this is a decision, not a build

This is the mechanism by which authority is visible. It affects the airlock adapter, the trace, the
viewer, and the judge's interpretation of the whole demo. It is also the difference between "we
blocked it" and "we made it look blocked".

## Inputs

- `03-airlock.md` §"Rewrite vs deny" and §"Open questions" 2.
- `02-action-model.md` §"The adapter interface".
- `src/agents/airlock-handler.ts`, `src/domain/registry.ts`.

## Resolution

**Resolved 2026-10-30 (delegated).** Denial is a **rewrite to the registered no-op `refuse_action`**,
not a throw and not a tool-level check.

- Every agent's tool list includes `refuse_action`, which returns
  `{ refused: true, code, reason, intentId }` and has no side effects. The loop stays alive and the
  model sees the reason on its next turn.
- The airlock adapter rewrites the `function_call` transition exactly as
  `createAirlockHandler` already does. The trace records the original call, the `decision.made`
  verdict (kind, votes, reason), and the refusal. `action.executed` never fires for a denied intent.
- **Defer vs deny:** both resolve the handler now with `refuse_action`, but `defer` also stores the
  intent for retry (`intent.deferred` / `intent.retried`) and the reason is `deferred`; `reject` does
  not retry. The viewer distinguishes them.
- **Retry:** a denied intent is not auto-retried by the airlock. The model may re-propose once with a
  narrower intent in its next turn; that is a new `intentId` and a fresh decision. Cap one model
  retry per denial to avoid a loop.
- **Tool-level refusal (b) is rejected:** it duplicates the authority check in every tool and a bug
  in one tool becomes an authority bypass. **Throw/stop (c) is rejected:** it loses the reason and
  kills the loop. `pause`/`stop` are unreachable anyway (C01).
- **"Did the action happen?"** No: `refuse_action` is a no-op, the adapter is never called, and the
  trace has no `action.executed`. The refusal is not a fake success; the model and the viewer both
  see a refusal.
- **Side effects before the call:** the closed schema means the only side-effecting tool is `act`;
  reads are separate tools and are not intercepted.
- A denied intent remains in `CustodyState.intents` and `decisions` with its votes, so the audit can
  explain who stopped it and why.
