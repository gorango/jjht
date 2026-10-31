# CUSTODIAN — NTP Novi Sad 2026, Track 3 (Freestyle)

CUSTODIAN is the entry in this workspace. It is an incident-response runtime where no agent can act
alone. Agents propose typed, reversible actions. An airlock holds them and decides together in one
window, weighing containment against evidence preservation, availability and provenance. Only an
accepted intent reaches an adapter. The runtime, the bus, the five concurrent loops and the shared
state are real Mozaik.

**Track note.** `packages/eureka/` is a completed Track 2 (EINSTEIN) submission, kept for reference.
It is not the entry. CUSTODIAN, Track 3, is.

## Run it

Requires Bun 1.4 or newer. Docker 29 and Compose 5 are needed only for the recorded infrastructure
surface.

```bash
git clone --recurse-submodules https://github.com/gorango/jjht.git
cd jjht
bun install
bun run custodian                # live money run, INFLIGHT 5
bun run custodian --scenario benign
bun run custodian:dashboard      # http://localhost:8787
bun run custodian:test
bun run custodian:ablate
```

The five-row table, the ablation, the dashboard walkthrough, the Docker recording and the baro
handoff are in [`packages/custodian/README.md`](packages/custodian/README.md). The presenter script is
[`packages/custodian/DEMO.md`](packages/custodian/DEMO.md). The claim map, one row per rubric criterion
with a file and a command, is [`packages/custodian/docs/judging.md`](packages/custodian/docs/judging.md).

## Workspace layout

| Path | What it is |
| --- | --- |
| `packages/custodian/` | The Track 3 entry. Live Mozaik loops, an airlock, a dashboard, a Docker adapter with one recorded run, an ablation, and a baro handoff. |
| `packages/eureka/` | Completed Track 2 (EINSTEIN) submission. Kept for reference; not the entry. |
| `modules/mozaik/` | [`jigjoy-ai/mozaik`](https://github.com/jigjoy-ai/mozaik) submodule, the agent runtime, pinned at `v4.1.0` and linked into the workspace. |
| `modules/baro/` | [`jigjoy-ai/baro`](https://github.com/jigjoy-ai/baro) submodule, the software-factory reference. |
| `modules/custodian-scratch/` | [`gorango/jjhts`](https://github.com/gorango/jjhts) submodule, the small checkout fixture CUSTODIAN hands to an independent agent. |
| `packages/custodian/docs/` | CUSTODIAN design, the judging map, and the historical decision record. |
| `packages/eureka/docs/` | EUREKA documentation. Its commit history predates this event. |

Already cloned? Run `git submodule update --init --recursive`. `bun install` builds the pinned
Mozaik submodule (`tsup`) so every package resolves `@mozaik-ai/core` from the workspace instead of
npm.

Every package script is available from the root with a package prefix. `bun run custodian`,
`custodian:test`, `custodian:typecheck`, `custodian:dashboard`, `custodian:ablate` and `custodian:docker:*`
are CUSTODIAN. `bun run eureka:*` is the Track 2 package.
