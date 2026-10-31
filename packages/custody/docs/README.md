# CUSTODY — design notes

Everything decided, verified, or still open about the Freestyle pivot. The wayfinder map is
**complete**: all 22 tickets are closed, and execution follows the
[Vertical slice contract](wayfinder/tickets/C15-vertical-slice-contract.md).

**Status: vertical slice complete; demo surfaces in progress.** The decision core, the live Mozaik
runtime, the ten scenarios and the ablation are implemented and tested. The next execution plan is
[11-demo-surfaces-plan](11-demo-surfaces-plan.md): dashboard, Docker recording and baro handoff,
all equally weighted.

| Doc | What it answers |
| --- | --- |
| [00-thesis](00-thesis.md) | What the system is, and the one sentence that makes it not another AI SOC. |
| [01-architecture](01-architecture.md) | Participants, events, state, module map, what exists today. |
| [02-action-model](02-action-model.md) | The closed schema: capabilities, blast radius, compensation, narrowing. |
| [03-airlock](03-airlock.md) | The only place an intent becomes an action. Algorithm, precedence, failure modes. |
| [04-judge-and-evidence](04-judge-and-evidence.md) | Invariants, scenario suite, ablation arms, pass conditions. |
| [05-scenarios](05-scenarios.md) | The ten incidents, including the money scenario that ships in code. |
| [06-infrastructure-and-repo-handoff](06-infrastructure-and-repo-handoff.md) | Digital twin vs real adapter; issue → baro → PR loop. |
| [07-demo-and-rubric](07-demo-and-rubric.md) | Freestyle mapping, three-minute script, judging map. |
| [08-plan-risks-and-decisions](08-plan-risks-and-decisions.md) | The remaining hours, cut lines, risks, open decisions. |
| [09-mozaik-api-notes](09-mozaik-api-notes.md) | Verified v4.1.0 signatures and the pitfalls that cost time. |
| [10-wayfinder-seed](10-wayfinder-seed.md) | Destination, candidate decision tickets, fog, out of scope. |
| [11-demo-surfaces-plan](11-demo-surfaces-plan.md) | The remaining build: dashboard, Docker adapter, baro handoff, equal priority, gates, fallbacks. |
| [wayfinder/map](wayfinder/map.md) | The completed map: 21 decisions, the remaining fog, and what is out of scope. |
| [wayfinder/tickets/C15](wayfinder/tickets/C15-vertical-slice-contract.md) | The command contract, concurrency proof, cut order, and acceptance checklist for the build. |
| [research/](research/) | The two fact sheets: Mozaik correlation mechanics and Docker reversibility. |

## Run it

```bash
bun install                 # from the workspace root
bun run custody             # live money run, real loops, one decision window
bun run custody --scenario benign
bun run custody:ablate      # three arms, writes eval/results.json
bun run custody:test        # 53 tests
```

The live run prints five decisions and `INFLIGHT 5`. One capture is accepted, one block is narrowed,
one isolate is deferred by the evidence lock, one injection is rejected, and one scale-up is
accepted. That table is the whole thesis in one screen. See the
[README](../README.md) for the measured numbers.
