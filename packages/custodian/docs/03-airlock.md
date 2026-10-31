# 03 — The airlock

## The hook (verified)

From the workspace's `@mozaik-ai/core@4.1.0` (`modules/mozaik/dist/index.d.ts`):

```ts
interface InterceptionHandler {                    // line 189
  isSatisfiedBy(transition: ExecutableTransition): boolean;
  handle(transition: ExecutableTransition): Promise<ExecutableTransition>;
}

runLoop(agentId, message, inferenceInput, interceptionHandler?): void   // line 510
```

The `function_call` transition carries `input.call: FunctionCallItem` and `input.inferenceInput`.
`FunctionCallItem.rehydrate({ callId, name, args })` constructs a substitute call, and spreading the
transition with a new `input` is a legal rewrite. Because `handle` is `async`, it can **await** —
which is exactly what holding a decision window requires. This is the mechanism that makes the
whole design possible; it was verified against the installed types, not inferred from docs.

## Algorithm

`reconcile(intents, ctx)` in `src/agents/airlock.ts`:

1. **Order by arrival** (`requestedAt`, then id). Deterministic, so the replay is reproducible.
2. For each intent, run every invariant in `checkIntent`.
3. Apply authority in precedence order:
   - **evidence** → `defer` (never destroy what proves the incident)
   - **taint / provenance** → `reject` (untrusted text is not authority)
   - **capability / compensation** → `reject` (no permission or no undo)
   - **protected CIDR** → `reject` (internal range = self-inflicted outage)
   - **blast** → try `narrow`; accept the rewrite if the narrowed intent passes; else `reject`
   - **joint budget** → `defer` if accepted actions so far plus this one exceed the budget
   - otherwise → `accept`
4. Return decisions, the flattened findings, the accepted intents, and counts.

Precedence is the design. Evidence before containment is a policy statement, not an implementation
detail: the system would rather leave an attacker connected for 30 seconds than destroy the capture
that proves what they took.

## Votes

Each failed invariant is attributed to the participant that owns it:

| Code | Voter |
| --- | --- |
| `capability`, `provenance`, `compensation` | auditor |
| `taint` | provenance |
| `blast`, `protected_cidr` | availability |
| `evidence` | preserve |

Votes are recorded on the decision and printed in the viewer. They are not a vote-counting scheme —
one veto is enough. They exist so the trace explains *who* stopped the action and *why*.

## Rewrite vs deny

- **Rewrite** returns the same transition with a new `FunctionCallItem`, so the tool executes with
  narrowed arguments. Used for blast narrowing.
- **Deny** rewrites the call to `refuse_action`, a registered no-op tool. The loop stays alive, the
  refusal is a normal event, and the model sees the reason on its next turn. Throwing inside
  `handle` would break the loop and lose the reason.
- **Defer** is not an airlock-level operation in the Mozaik adapter: the intent is returned to the
  queue with a reason, and a later window re-evaluates it. In the replay, deferral is a decision
  value; in the live system it is a re-enqueue plus a `intent.deferred` event.

## Failure modes to design against

| Failure | Symptom | Mitigation |
| --- | --- | --- |
| Window too long | incident response latency | 1–2 s window; the clock starts at the first intent, not per intent |
| Window too short | misses a peer's veto | measure: percentage of scenarios where a late intent would have changed the outcome |
| Starvation | a deferred intent never returns | every defer carries a retry time and a cap |
| Duplicate execution | two windows both accept | intent ids are unique; accepted intents leave the queue atomically |
| Lease expiry mid-turn | duplicate work, double cost | no renewal today; emit `lease.expired` and let `isCurrent` discard the stale write |
| Deadlock | Preserve waits for snapshot, snapshot waits for Preserve | locks are time-bounded and visible; no participant waits on another's lock to *propose* |
| Model returns an unknown action | parse failure | fail closed: unknown action = rejected intent, not a free-text command |

## Open questions for the wayfinder session

1. **Correlation — resolved.** A dedicated Airlock participant owns a per-incident window, while
   each agent's handler suspends its own loop and awaits the joint decision. The public API does
   suspend: `handle()` is awaited inside `AgentLoop.run`, so no Mozaik patch is needed. See
   [Live correlation mechanism](wayfinder/tickets/C03-live-correlation.md) and
   [the correlation fact sheet](research/c01-correlation-mechanics.md).
2. **Denial semantics — resolved.** Rewrite to the registered `refuse_action` no-op; see
   [Denial semantics](wayfinder/tickets/C09-denial-semantics.md).
3. **Second key — resolved.** A typed confirmation grants a 30 s single-intent lease; see
   [Second key mechanics](wayfinder/tickets/C07-second-key.md).
4. **Taint propagation — resolved.** Ingestion sets per-field taint before any model; see
   [Taint authority and boundary](wayfinder/tickets/C10-taint-authority.md).
