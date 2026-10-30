# Judging map

One row per rubric criterion. Every row points at code that exists and a command that proves the
claim from the committed tree. Line numbers are approximate after edits; the command is the source
of truth.

| Criterion | Pts | Evidence in the tree | Command that proves it |
| --- | --- | --- | --- |
| **Multi-agent architecture: roles, coordination, review loops** | 30 | Five role specs in `src/agents/roles.ts`: profiler, analyst, matchmaker, writer (`:272`), critic (`:566`). Pools are built in `src/agents/pool.ts:18`; every worker is an independent participant (`src/agents/worker.ts:99`). Work is claimed through a generation-carrying lease market (`src/domain/market.ts:23`) and a stale write is rejected (`src/domain/market.ts:51`, `src/agents/worker.ts:272`). Completion is a property of state, not a script (`src/agents/scheduler.ts:20`). The Scheduler can leave after boot and the run still drains (`src/agents/scheduler.ts:208`, `src/index.ts` `--scheduler=off-after-boot`). | `bun run test` — includes the chaos and scheduler-drain tests in `tests/runtime.test.ts`. `bun run concurrency` — writes the 1/3/5 pool curve to `eval/concurrency.md`. `bun run mock` — 12 challenges, 103 calls, 14 in flight, $0.00. |
| **Proposals a company and a researcher would sit down over** | 25 | Writer prompt and JSON schema at `src/agents/roles.ts:272` require supervisors + candidate, research questions, a three-year plan, what each side brings, why this pair, an agreed publication/IP clause, risks and unverified evidence. Structural gates are code, not prompt (`src/agents/roles.ts:500`). Four real approved proposals are committed at `examples/run-proposals/portfolio.md`; the first three are ArmaturaSec × Kiss, Zrenjanin Game Works × Mitrović and AutomVoj × Erić. | `bun run check:examples` — asserts 4 proposals / 4 approvals / 4 rejections against `examples/run-proposals/run.json` and the README table. `bun run audit run-openrouter` — every claim in those proposals resolves. |
| **Accuracy and transparency: sources, trace, no hallucinations** | 20 | Code resolves every citation before the model verdict (`src/agents/roles.ts:457`, used in `src/agents/roles.ts:566`). Structural rejects carry machine-readable codes in the trace (`src/agents/roles.ts:500`, `src/runtime/events.ts`). Per-task tokens/cost/duration are emitted by `src/runtime/trace.ts`; the trace is JSONL. The one-command audit re-resolves a committed trace offline (`src/audit.ts:86`). | `bun run audit run-openrouter` — prints claim → sources → resolved/unresolved, exits non-zero on an unknown id. `bun run check:examples` — asserts the real trace contains 4 reject entries with `hardRejects`. |
| **Potential for real use in EINSTEIN** | 15 | Retrieval is deterministic and model-free (`src/domain/dataset.ts:155`); a portfolio, not a leaderboard, picks at most one collaboration per company and never double-books a researcher (`src/agents/scheduler.ts:49`). The executable seam is `src/serve.ts:55`: `POST /challenges`, `GET /events` (SSE), `GET /portfolio/:runId`. A host can join the same bus in `examples/host.ts` without importing the agents. | `MOCK=1 bun run serve -- --port=4300`, then `curl -X POST localhost:4300/challenges -H 'content-type: application/json' -d '{"challengeId":"C001-CH1"}'`, `curl -N localhost:4300/events`, `curl localhost:4300/portfolio/<runId>`. Or `MOCK=1 bun examples/host.ts`. |
| **Responsible use of data** | 10 | Synthetic dataset only by default (`data/README.md`). A hard pre-inference guard refuses payloads carrying ORCID/OpenAlex identities unless `--allow-real-people` is set (`src/domain/realPeople.ts:13`; event `inference.refused` in `src/runtime/events.ts`). Unknown model ids no longer get a silent price (`src/inference/pricing.ts:51`; `EUREKA_PRICE_STRICT=1` throws). "No match" is a first-class result (`src/agents/scheduler.ts:20`, `unmatched` in `portfolio.md`). | `bun run test` — `tests/guard.test.ts` covers the ORCID/OpenAlex refusal and strict pricing. `grep -n "unmatched" examples/run-mock/portfolio.md`. |

## Extra deliverables from the brief

| Requirement | Where |
| --- | --- |
| Architecture diagram | `README.md` §Architecture, `docs/architecture.md`, and `examples/run-*/architecture.mmd` written by every run. |
| Trace of one full run showing where the Critic stepped in | `examples/run-openrouter/trace.jsonl`: 8 `proposal.reviewed` events, 4 real `reject`, 4 `approve`; `bun run audit run-openrouter`. |
| At least three proposals | `examples/run-proposals/portfolio.md` (4). |
| Reproducible numbers | `bun run check:examples` (README ↔ artefacts), `bun run audit <run>` (trace ↔ dataset). |

## What each command touches

```bash
bun install --frozen-lockfile       # clean install from the committed lockfile
bun run test                        # 18 tests: citations, hard gates, leases, chaos, scheduler drain, guard, pricing
bun run typecheck                   # tsc --noEmit
bun run mock                        # default-scale offline run, ~0.3 s, $0.00
bun run eval                        # hit@3 84.2%, precision@1 47.4%, MRR 0.69
bun run concurrency                 # pool curve 1/3/5 -> eval/concurrency.md
bun run check:examples              # README numbers and trace claims vs examples/
bun run audit run-openrouter        # every claim re-resolved against the dataset
```
