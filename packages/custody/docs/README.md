# CUSTODY — design notes

Everything decided, verified, or still open about the Freestyle pivot. The wayfinder map is
**complete**: all 22 tickets are closed, and execution follows the
[Vertical slice contract](wayfinder/tickets/C15-vertical-slice-contract.md).

**Status: scaffold.** The decision core (closed action schema, invariants, airlock reconciliation)
is implemented and tested. No agent is wired to it yet; no infrastructure is touched. The plan is
decision-complete; the slice is the next phase.

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
| [wayfinder/map](wayfinder/map.md) | The completed map: 21 decisions, the remaining fog, and what is out of scope. |
| [wayfinder/tickets/C15](wayfinder/tickets/C15-vertical-slice-contract.md) | The command contract, concurrency proof, cut order, and acceptance checklist for the build. |
| [research/](research/) | The two fact sheets: Mozaik correlation mechanics and Docker reversibility. |

## Run it

```bash
bun install                 # from the workspace root
bun run custody             # replay the money scenario through the airlock
bun run custody:test        # 18 tests
bun run custody:typecheck
```

The replay prints five decisions for five intents that arrive from four agents at the same time:
one accepted capture, one narrowed block, one deferred isolate, one rejected injection, one
accepted scale-up. That table is the whole thesis in one screen.
