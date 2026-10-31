# JigJoy — NTP Novi Sad hackathon

Workspace for the NTP Novi Sad Hackathon ("Build agents that work together", 30–31 October 2026).

## Workspace layout

| Path | What it is |
| --- | --- |
| `packages/eureka/` | EUREKA — an evidence-first, concurrent researcher–company matchmaker built on Mozaik (Track 02). |
| `packages/custody/` | CUSTODY — an incident-response runtime where no agent can act alone. Live Mozaik loops, an airlock, a dashboard, a Docker adapter with one recorded run, an ablation, and a baro handoff. |
| `modules/mozaik/` | [`jigjoy-ai/mozaik`](https://github.com/jigjoy-ai/mozaik) submodule — the agent runtime, pinned at `v4.1.0` and linked into the workspace. |
| `modules/baro/` | [`jigjoy-ai/baro`](https://github.com/jigjoy-ai/baro) submodule — the software-factory reference, kept alongside the workspace. |
| `docs/rules/` | Global hackathon reference: event, rules, tracks, judging, submission, prizes, dataset/APIs, platform, source log. |
| `packages/eureka/docs/` | EUREKA-specific docs: architecture, pivot review, project review, trace-viewer screenshot. |
| `packages/custody/docs/` | CUSTODY design: thesis, architecture, action model, airlock, judge, scenarios, plan, Mozaik API notes, wayfinder seed. |

## Quick start

Requires [Bun](https://bun.sh) 1.4+.

```bash
git clone --recurse-submodules <repo>
bun install
bun run eureka:mock               # offline, deterministic, no API key
bun run eureka:trace              # serve the trace viewer at http://localhost:4173
bun run custody                   # CUSTODY: live run, five intents, one decision window
bun run custody:dashboard         # CUSTODY dashboard at http://localhost:8787
```

Already cloned? Run `git submodule update --init --recursive` first. `bun install` builds the
pinned Mozaik submodule (`tsup`) so every package resolves `@mozaik-ai/core` from the workspace
instead of npm.

Every package script is available from the root with a package prefix: `bun run eureka:*` for the
matchmaker and `bun run custody` / `custody:test` / `custody:typecheck` for the defender. See
[`packages/eureka/README.md`](packages/eureka/README.md) for the full walkthrough and
[`docs/rules/README.md`](docs/rules/README.md) for the official event material.
