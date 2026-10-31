# CUSTODY — NTP Novi Sad 2026, Track 3 (Freestyle)

CUSTODY is the entry in this workspace. It is an incident-response runtime where no agent can act
alone. Agents propose typed, reversible actions. An airlock holds them and decides together in one
window, weighing containment against evidence preservation, availability and provenance. Only an
accepted intent reaches an adapter. The runtime, the bus, the five concurrent loops and the shared
state are real Mozaik.

**Track note.** `packages/eureka/` is a completed Track 2 (EINSTEIN) submission, kept for reference.
It is not the entry. CUSTODY, Track 3, is.

## Run it

Requires Bun 1.4 or newer. Docker 29 and Compose 5 are needed only for the recorded infrastructure
surface.

```bash
git clone --recurse-submodules https://github.com/gorango/jjht.git
cd jjht
bun install
bun run custody                # live money run, INFLIGHT 5
bun run custody --scenario benign
bun run custody:dashboard      # http://localhost:8787
bun run custody:test
bun run custody:ablate
```

The five-row table, the ablation, the dashboard walkthrough, the Docker recording and the baro
handoff are in [`packages/custody/README.md`](packages/custody/README.md). The presenter script is
[`packages/custody/DEMO.md`](packages/custody/DEMO.md). The claim map, one row per rubric criterion
with a file and a command, is [`packages/custody/docs/judging.md`](packages/custody/docs/judging.md).

## Workspace layout

| Path | What it is |
| --- | --- |
| `packages/custody/` | The Track 3 entry. Live Mozaik loops, an airlock, a dashboard, a Docker adapter with one recorded run, an ablation, and a baro handoff. |
| `packages/eureka/` | Completed Track 2 (EINSTEIN) submission. Kept for reference; not the entry. |
| `modules/mozaik/` | [`jigjoy-ai/mozaik`](https://github.com/jigjoy-ai/mozaik) submodule, the agent runtime, pinned at `v4.1.0` and linked into the workspace. |
| `modules/baro/` | [`jigjoy-ai/baro`](https://github.com/jigjoy-ai/baro) submodule, the software-factory reference. |
| `modules/custody-scratch/` | [`gorango/jjhts`](https://github.com/gorango/jjhts) submodule, the small checkout fixture CUSTODY hands to an independent agent. |
| `packages/custody/docs/` | CUSTODY design, the judging map, and the historical decision record. |
| `packages/eureka/docs/` | EUREKA documentation. Its commit history predates this event. |

Already cloned? Run `git submodule update --init --recursive`. `bun install` builds the pinned
Mozaik submodule (`tsup`) so every package resolves `@mozaik-ai/core` from the workspace instead of
npm.

Every package script is available from the root with a package prefix. `bun run custody`,
`custody:test`, `custody:typecheck`, `custody:dashboard`, `custody:ablate` and `custody:docker:*`
are CUSTODY. `bun run eureka:*` is the Track 2 package.
