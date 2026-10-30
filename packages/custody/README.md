# CUSTODY

**An incident-response runtime where no agent can act alone.**

Every AI security demo lets a model read attacker-controlled logs and then run commands. CUSTODY
inverts that: agents propose typed, reversible actions; an **airlock** holds every pending action and
decides them *together*, weighing containment against evidence preservation, availability, and
provenance. An attacker who can write the logs still cannot write the system.

Built for the **Freestyle** track of the NTP Novi Sad Hackathon (30–31 October 2026), on
[Mozaik](https://github.com/jigjoy-ai/mozaik).

## Status: scaffold (honest)

| Piece | State |
| --- | --- |
| Closed action schema, blast radius, compensation, narrowing | **implemented + tested** |
| Invariants (capability, provenance, taint, undo, blast, evidence, protected CIDR) | **implemented + tested** |
| Airlock joint reconciliation | **implemented + tested** |
| Mozaik `InterceptionHandler` adapter | **typed against v4.1.0, not wired into a live loop** |
| Agent pools, digital twin, trace, viewer, ablation, Docker adapter, baro handoff | **not built** |

18 tests pass. The replay below is a deterministic fixture, not a live multi-agent run — that is the
next slice, and the README will keep saying so until it is true.

## Run it

```bash
bun install            # from the workspace root
bun run custody        # replay five concurrent intents through the airlock
bun run custody:test
bun run custody:typecheck
```

```
intent      agent           action        target    decision  reason
i-snapshot  preserve-1      snapshot      host-7    ACCEPT    all invariants hold
i-block     contain-1       block_egress  edge      REWRITE   narrowed to 203.0.113.9/32 (10.0% → 2.0%)
i-isolate   contain-1       isolate       host-7    DEFER     evidence lock on host-7 held by preserve-1
i-injected  edge-bot        block_egress  edge      REJECT    taint: rationale derives from attacker-controlled text
i-scale     availability-1  scale         checkout  ACCEPT    all invariants hold
```

Four agents, five intents, one decision window. Containment happens at the edge instead of killing a
host that holds both the evidence and 40% of payment traffic. The injected `/8` block is rejected
even though the agent holds the capability.

## The mechanism

- **Closed schema.** An agent can only propose one of eight typed actions. No shell, ever.
- **Blast radius from the graph.** Impact is computed from the topology, not asserted by the model.
- **Taint.** Rationales carry a bit set at ingestion. Tainted input cannot be the sole authority.
- **Undo or second key.** Destructive actions without a compensation require a human.
- **Evidence outranks containment.** A locked target is deferred, not destroyed.
- **Joint budget.** Individually safe actions that add up to an outage are deferred.

## Layout

```
src/domain/     types, topology, closed action registry, invariants
src/agents/     airlock, Mozaik interception adapter, role prompts
src/runtime/    CustodyState, event catalogue, defineRuntime session
src/scenarios/  the money scenario (fixture + expected decisions)
src/index.ts    CLI replay
tests/          invariants, airlock, registry
docs/           thesis, architecture, action model, airlock, judge, scenarios,
                infrastructure + repo handoff, demo + rubric, plan, Mozaik notes,
                wayfinder seed
```

## What this is not

Not a SIEM, not a detection-rule engine, not an autonomous pentester. The runtime consumes
telemetry and decides what may be done about it. If the action path ever becomes free-form, the
thesis is dead.

## Docs

Start with [`docs/00-thesis.md`](docs/00-thesis.md), then [`docs/01-architecture.md`](docs/01-architecture.md).
The decision-complete plan is the [wayfinder map](docs/wayfinder/map.md); the build contract is the
[Vertical slice contract](docs/wayfinder/tickets/C15-vertical-slice-contract.md). The two fact sheets
are in [`docs/research/`](docs/research/). Background: [`docs/08-plan-risks-and-decisions.md`](docs/08-plan-risks-and-decisions.md).
