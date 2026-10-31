# CUSTODIAN — documentation

CUSTODIAN is the Track 3 (Freestyle) entry. `packages/eureka/` is the completed Track 2 (EINSTEIN)
submission and is not part of this entry.

The product README is [../README.md](../README.md). The presenter script is
[../DEMO.md](../DEMO.md). This folder holds the design notes, the claim map, and the history.

## Start here

| Doc | What it answers |
| --- | --- |
| [judging](judging.md) | One row per rubric criterion, with a file and a command. Start here when judging. |
| [00-thesis](00-thesis.md) | What the system is, and the sentence that makes it not another AI SOC. |
| [01-architecture](01-architecture.md) | Participants, events, state, module map. |
| [02-action-model](02-action-model.md) | The closed schema: capabilities, blast radius, compensation, narrowing. |
| [03-airlock](03-airlock.md) | The only place an intent becomes an action. Algorithm, precedence, failure modes. |
| [04-judge-and-evidence](04-judge-and-evidence.md) | Invariants, scenario suite, ablation arms, pass conditions. |
| [05-scenarios](05-scenarios.md) | The ten incidents. |
| [06-infrastructure-and-repo-handoff](06-infrastructure-and-repo-handoff.md) | The Docker adapter mapping, evidence bundle, and baro handoff. |
| [07-demo-and-rubric](07-demo-and-rubric.md) | Freestyle mapping and the three-minute script. |
| [09-mozaik-api-notes](09-mozaik-api-notes.md) | Verified v4.1.0 signatures and pitfalls. |
| [research/c02](research/c02-docker-reversibility.md) | The Docker fact sheet behind the ingress claim. |

## History

These are records of how the build was decided. They are not required to run anything.

| Doc | What it records |
| --- | --- |
| [11-demo-surfaces-plan](11-demo-surfaces-plan.md) | The execution plan for the dashboard, Docker recording and baro handoff, with a post-execution note. |
| [wayfinder/](wayfinder/README.md) | The pre-execution map and its 22 decision and task tickets. Archive. |
| [research/c01](research/c01-correlation-mechanics.md) | The Mozaik correlation fact sheet that preceded the runtime. |

## Run it

```bash
bun install                 # from the workspace root
bun run custodian             # live money run, real loops, one decision window
bun run custodian --scenario benign
bun run custodian:dashboard   # http://localhost:8787
bun run custodian:ablate      # three arms, writes eval/results.json
bun run custodian:test        # 81 tests, 75 pass and 6 skip without Docker
npm install -g baro-ai        # slow-loop CLI; modules/baro is reference source only
bun run custodian:baro -- --dry-run
```

The live run prints five decisions and `INFLIGHT 5`. One capture is accepted, one block is narrowed,
one isolate is deferred by the evidence lock, one injection is rejected, and one scale-up is
accepted. The measured numbers and the honest limits are in the [README](../README.md).
