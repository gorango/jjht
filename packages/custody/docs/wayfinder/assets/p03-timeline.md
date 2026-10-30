# P03 — Airlock / lease timeline (prototype)

A Mermaid sequence diagram of the same money scenario. The point is to show **concurrency and the
window**, not decoration: Contain, Preserve and Availability start together, the airlock holds their
transitions, and one decision changes another.

```mermaid
sequenceDiagram
    autonumber
    participant W as Watch
    participant T as Triage
    participant C as Contain (model)
    participant P as Preserve
    participant A as Availability
    participant X as Airlock
    participant H as Human

    W->>T: incident.opened
    T->>C: incident.triaged
    T->>P: incident.triaged
    T->>A: incident.triaged

    par three loops think at once
        C->>X: intent.proposed (block 203.0.113.0/24)
    and
        P->>X: intent.proposed (snapshot host-7)
    and
        A->>X: intent.proposed (scale checkout 3 -> 6)
    end

    Note over X: window inc-1#1 opens at first intent<br/>deadline = +1500 ms (fixed)
    C->>X: intent.proposed (isolate host-7)
    Note over X: a peer proposes while the first is held
    Note over X: window.closed — INFLIGHT 4

    X-->>P: ACCEPT snapshot
    X-->>A: ACCEPT scale
    X-->>C: REWRITE block /24 -> /32
    X-->>C: DEFER isolate (evidence lock; retryAt +2000)
    Note over C: the loop resumes with the narrowed call
    Note over P: the snapshot runs; the lock stays held
    Note over X: i-injected is rejected: tainted, protected, 90%<br/>edge-bot held the capability and still lost

    opt destructive-without-undo (e.g. revoke_token)
        X->>H: second_key.requested (intent id, action, target)
        H->>X: APPROVE (typed confirmation, 30 s lease)
        X-->>C: ACCEPT with second key
    end

    Note over X: deferred isolate re-enters a later window<br/>attempt 1/3; accepted retries execute via the shared port
```

## What a judge should see

- **Three lanes active at once** — the `par` block, not a pipeline.
- **A held transition** — `intent.proposed` arrives before `window.closed`; the handler is suspended.
- **A peer effect** — Contain's block is narrowed, Preserve's lock defers Contain's isolate.
- **A capability that is necessary but not sufficient** — edge-bot's rejected injection.

## Trace fields the timeline needs

`intent.proposed`, `window.opened`, `window.closed` (with `INFLIGHT`), `decision.made`,
`intent.deferred`, `intent.retried`, `second_key.*`, `action.executed`, plus `loopId`/`producerId` on
every event. If any is missing, add it to the trace, not to the viewer.

## Lease lane (if the slice includes it)

A pending intent carries a generation; a handler that returns after `airlock.timeout` is stale and
its decision is ignored. The timeline draws the stale resolution as a crossed-out arrow, not a second
execution.
