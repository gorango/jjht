# Compliance checklist (internal)

Maps every hard requirement to where EUREKA satisfies it in this repository. This is **our** check,
not an official document. Update the "evidence" column when files move.

## Eligibility and team

| Requirement (rules §2–§4) | Status | Evidence / action |
| --- | --- | --- |
| At least 18 years old, or local majority | ☐ confirm per team member | Not recorded in the repo. |
| Open worldwide; void where prohibited | ✅ | Serbia-based event; no restriction applies. |
| Organizers/judges may not win prizes | ✅ | Team is not affiliated. |
| Team of up to 4, one entry per team, one team per person | ☐ | Confirm final roster before submitting. |
| Pre-existing frameworks/libraries allowed; substance during event | ⚠️ same as above | Mozaik and the dataset are pre-existing; EUREKA's code is the substance under question. |
| Uses Mozaik (`@mozaik-ai/core`) | ✅ | `package.json` dependency `^4.1.0`; `src/runtime/session.ts`. |
| Runs **two or more concurrent agents** | ✅ | Five role pools (3/3/3/3/2); `src/agents/pool.ts`, `src/agents/worker.ts`. |
| AI-assisted development allowed | ✅ | N/A. |
| Owns or has rights to code, assets, data | ✅ | MIT code; synthetic dataset from the organizers; dataset provenance in `data/README.md`. |
| No infringing, unlawful, or harmful content | ✅ | No third-party assets beyond the organizers' data and the Mozaik package. |

## Track and submission

| Requirement | Status | Evidence / action |
| --- | --- | --- |
| One track per team, chosen at submission | ✅ | Track 02 — EINSTEIN Matchmaker. |
| Public repo the judges can access | ☐ verify at submission time | Check visibility, not just "created". |
| Project name | ✅ | EUREKA. |
| Description | ✅ | `docs/rules/05-submission.md` §Submission copy. |
| Explanation of how agents run concurrently | ✅ | README §"Why this is not a pipeline in disguise"; submission copy. |
| Demo video / deploy / screenshots (optional) | ⚠️ optional | `packages/eureka/docs/trace-viewer.png`; a live deployment is not published. |
| Submitted by 31 Oct 14:00 CET; last entry counts | ☐ | Set a reminder for 13:00. |
| Repo can be opened, run and verified | ⚠️ | Fix `npm ci` (lockfile out of sync); regenerate stale `examples/`; see main review. |

## Track 02 deliverables

| Requirement | Status | Evidence |
| --- | --- | --- |
| Architecture diagram | ✅ | `packages/eureka/README.md` §Architecture; `packages/eureka/docs/architecture.md`; `packages/eureka/examples/*/architecture.mmd`. |
| Trace of one full run showing where the Critic stepped in | ⚠️ partially | `examples/run-full/trace.jsonl` has 9 rejections; `examples/run-openrouter/trace.jsonl` has **0** and is the one linked first. Point the README at `run-full` as the evidence. |
| At least three proposals for three different pairs | ✅ | `examples/run-openrouter/portfolio.md` (3), `examples/run-full/portfolio.md` (5). |
| README answers "how would this plug into the EINSTEIN network and EINSTEIN Stars?" | ✅ | README §"How this plugs into the EINSTEIN network and EINSTEIN Stars". |
| Only public data or the provided dataset | ✅ | Vendored synthetic dataset; OpenAlex probe resolves public identifiers only. |
| Proposes collaborations; never scores people by worth | ✅ | README §Data/responsible use; portfolio rather than leaderboard. |
| No hallucinations / sources traceable | ✅ | Claim ledger; code resolves citations before the model verdict (`src/agents/roles.ts`, `src/runtime/state.ts`). |

## Rubric self-assessment (Track 02)

| Criterion | Pts | Current | Where | What is missing |
| --- | --- | --- | --- | --- |
| Multi-agent architecture | 30 | strong | Pools, lease market with generations, critic loop | Claims of scheduler-removal and pool scaling are prose, not measured |
| Proposals worth sitting down over | 25 | **weakest** | Writer schema | Missing supervisors, candidate, research questions, year-by-year plan, agreed-upon IP/publication terms — all present in the organizers' own example |
| Accuracy & transparency | 20 | strong | Claim ledger, trace JSONL, viewer | Example runs are stale/inconsistent; no one-command audit |
| Potential for EINSTEIN | 15 | medium | Integration sketch, event seam | Seam is described, not executable |
| Responsible use of data | 10 | strong | Synthetic-only default, unmatched-as-result | No hard guard against sending real identities to a model |

## Pre-submission runbook

1. `npm ci` in a clean clone (must pass), then `npm run mock` (must finish in seconds, offline).
2. `npm test`, `npm run typecheck` — both green.
3. `npm run eval` — numbers match `eval/results.json` and the README.
4. Regenerate `examples/*` with the current code; confirm every number quoted in the README.
5. `git status` clean; no `.env`, no keys, no `runs/` committed.
6. Repo public; README renders (Mermaid, image paths).
7. Submit; then re-read the submission text against `05-submission.md` for stale numbers.
8. If there is time, submit again after any last change — the last entry counts.
