# 01 — Architecture

## One bus, seven mandates, one gate

```mermaid
flowchart LR
  subgraph telemetry["Untrusted telemetry"]
    T[(network · auth · runtime · logs)]
  end

  subgraph bus["Mozaik runtime — one event bus"]
    W[Watch]
    TR[Triage]
    C[Contain]
    P[Preserve]
    A[Availability]
    S[Scribe]
    AU[Auditor]
    H[Human]
    MKT[[lease market<br/>CAS + generation]]
    AIR{{airlock<br/>joint decision window}}
  end

  T --> W
  W -- incident.opened --> TR
  TR -- incident.triaged --> C & P & A
  C -- intent.proposed --> AIR
  P -- intent.proposed + evidence.lock --> AIR
  A -- intent.proposed --> AIR
  AIR -- decision.made --> EXEC[InfraAdapter<br/>sim · docker]
  AIR -- decision.made --> S
  S -- repo.issue.filed --> BARO[baro coding agent]
  BARO -- PR --> S
  AU -. replay + invariants .-> AIR
  H -. second key / scenario injection .-> AIR
  C & P & A -. claim / release .-> MKT
```

Nobody calls anybody. Each participant reacts to events it cares about, publishes what it did, and
the airlock is the only path from intent to effect.

## Participants

| Participant | Mandate | May propose | May veto | Notes |
| --- | --- | --- | --- | --- |
| **Watch** | Turn telemetry into incidents | nothing | — | Cheap model or no model. High volume. Marks taint. |
| **Triage** | Name affected services and the smallest target set | nothing | — | Refuses to act on weak evidence. |
| **Contain** | Stop the harm | block, isolate, drain, revoke | — | Two proposals in one turn are normal; the airlock decides them together. |
| **Preserve** | Keep the evidence | snapshot, lock | destructive actions on locked targets | Lock is time-bounded and visible in state. |
| **Availability** | Keep the product up | scale, drain | blast over budget | Owns the budget number. |
| **Scribe** | Timeline, postmortem, issue, baro goal | nothing | — | Only writes claims the trace supports. |
| **Auditor** | Re-run invariants over the trace | nothing | any action without provenance | Deterministic. Can fail a run. |
| **Human** | Second key, scenario injection | any (wildcard capability) | anything | The only participant with `*`. |

Deliberate asymmetry: **the agents that want to act are not the agents that judge the act.** Contain
cannot approve Contain. That is the same reason a reviewer is a separate participant in EUREKA.

## Shared state

`CustodyState extends RuntimeState` (see `src/runtime/state.ts`):

| Field | Holds |
| --- | --- |
| `topology` | services, hosts, links, protected CIDRs — the dependency graph blast radius is computed from |
| `telemetry` | raw events by id; never mutated |
| `intents` | every proposal, including rejected ones |
| `decisions` | the airlock's verdict per intent, with votes and reason |
| `locks` | evidence locks: target, holder, reason, expiry |
| `incidents` | phase per incident (watch → triage → act → recover → closed) |
| `capabilities` | agent id → capability list |
| `secondKey` | intent ids a human approved |
| `config` | blast budget, decision window, mock flag |

The trace is a participant, not a debugging aid. In the wired system it subscribes to everything and
writes JSONL, exactly like `packages/eureka/src/runtime/trace.ts`.

## Concurrency: what is actually parallel

- **Pools, not a pipeline.** Contain, Preserve and Availability are separate agents with separate
  loops. They see the same `incident.triaged` event and start thinking at the same time.
- **One turn per worker.** A worker handles one item at a time; parallelism comes from the pool and
  from cross-role concurrency, not from a hidden queue inside one agent. This keeps
  `model.answer → intent` correlation unambiguous.
- **The decision window.** The airlock awaits for `windowMs` (default 1500 ms) after the first
  intent, then decides the set. That await is the mechanism: it is the only interval in which one
  agent's half-formed intent can change another's.
- **Leases, not assignments.** A claim carries a generation. A worker that stalls past its TTL
  cannot write back over the worker that replaced it. Reused from `packages/eureka/src/domain/market.ts`.
- **Human as a held lease.** A second-key request is an open lease; the trace shows the wait.

## Module map

```
src/
  domain/
    types.ts        Intent, Decision, Topology, EvidenceLock, TelemetryEvent   [implemented]
    topology.ts     demo fixture + blast helpers                               [implemented]
    registry.ts     closed action schema, compensation, narrowing              [implemented]
    invariants.ts   capability/provenance/taint/compensation/blast/evidence     [implemented]
  agents/
    airlock.ts      joint reconciliation + precedence rules                    [implemented, tested]
    airlock-handler.ts  per-loop InterceptionHandler: propose, await, apply     [implemented]
    airlock-coordinator.ts  the pending set, window clock, deferrals, retries   [implemented]
    scheduler.ts    boot, participants, one loop per intent                    [implemented]
    roles.ts        role prompts                                               [implemented]
  runtime/
    state.ts        CustodyState                                               [implemented]
    events.ts       event catalogue                                            [implemented]
    session.ts      defineRuntime                                              [implemented]
    trace.ts        JSONL observer participant                                 [implemented]
    clock.ts        injected time and timers                                   [implemented]
    ingest.ts       taint before any participant sees telemetry                [implemented]
  infra/
    adapter.ts      InfraAdapter + deterministic SimAdapter                     [implemented]
    docker.ts       real adapter                                               [not built]
  inference/
    mock-runner.ts  scripted InferenceRunner, labelled mock, costUsd 0          [implemented]
  scenarios/
    *.ts            ten fixtures with expected decisions and harm labels        [implemented]
  eval/
    ablate.ts       naive / checks-only / custody over all ten                 [implemented]
  index.ts          `bun run custody` live CLI                                 [implemented]
```

## What exists today, precisely

- 50 passing tests: invariants, airlock, registry, taint, all ten scenarios, the live CLI, and the
  ablation.
- `bun run custody` boots the real Mozaik runtime, joins ten participants, starts one loop per
  proposed action, holds every `act` call in the interception handler, and prints the decisions,
  `INFLIGHT 5`, and five distinct loop ids. It exits non-zero unless the five decisions match and at
  least two loops were held together.
- `bun run custody --scenario benign` closes with no action and executes nothing.
- `bun run custody:ablate` writes `eval/results.json`; `custody` is 0 harmful and 0 obeyed, `naive`
  is 15 harmful and 2 obeyed in 9 of 10 scenarios.
- `tsc --noEmit` is clean against the workspace Mozaik build.

## What does not exist yet

The Docker adapter, the observer viewer, live inference, the baro handoff, and the evidence hash
bundle. Those are cut or later work, and the README says so.
