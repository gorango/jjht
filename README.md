# JigJoy — NTP Novi Sad hackathon

Workspace for the NTP Novi Sad Hackathon ("Build agents that work together", 30–31 October 2026).

## Workspace layout

| Path | What it is |
| --- | --- |
| `packages/eureka/` | EUREKA — an evidence-first, concurrent researcher–company matchmaker built on Mozaik (Track 02). |
| `modules/mozaik/` | [`jigjoy-ai/mozaik`](https://github.com/jigjoy-ai/mozaik) submodule — the agent runtime, pinned at `v4.1.0` and linked into the workspace. |
| `modules/baro/` | [`jigjoy-ai/baro`](https://github.com/jigjoy-ai/baro) submodule — the software-factory reference, kept alongside the workspace. |
| `docs/rules/` | Global hackathon reference: event, rules, tracks, judging, submission, prizes, dataset/APIs, platform, source log. |
| `packages/eureka/docs/` | EUREKA-specific docs: architecture, pivot review, project review, trace-viewer screenshot. |

## Quick start

Requires [Bun](https://bun.sh) 1.4+.

```bash
git clone --recurse-submodules <repo>
bun install
bun run mock                      # offline, deterministic, no API key
bun run trace                     # serve the trace viewer at http://localhost:4173
```

Already cloned? Run `git submodule update --init --recursive` first. `bun install` builds the
pinned Mozaik submodule (`tsup`) so `packages/eureka` resolves `@mozaik-ai/core` from the workspace
instead of npm.

Every package script is available from the root through `bun run --filter`; see
[`packages/eureka/README.md`](packages/eureka/README.md) for the full walkthrough and
[`docs/rules/README.md`](docs/rules/README.md) for the official event material.
