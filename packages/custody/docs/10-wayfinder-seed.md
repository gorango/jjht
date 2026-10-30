# 10 — Wayfinder seed (not run yet)

The user asked for this to be prepared, not executed. When the session starts, point wayfinder at
this file and let it chart the map. Everything below is a seed, not a decision.

## Destination

> A **decision-complete build plan** for CUSTODY plus a **working vertical slice**: a builder can
> spend the remaining hours implementing without making another architectural decision, and the
> slice proves the airlock changes outcomes under concurrent, conflicting intents.

Two deliverables, one destination: the plan is done when no design question blocks the build; the
slice is done when `bun run custody` shows a live multi-agent run (not the fixture) and the ablation
reports `naive > 0`, `custody = 0`.

## Notes

- **Track:** Freestyle. One entry per team; the entry can change until Sat 31 Oct 14:00 CET.
- **Constraints:** must use Mozaik and run two or more concurrent agents; no production mutation;
  demo must work offline; one person, ~14 usable hours.
- **Skills to consult:** `grilling`, `domain-modeling`, `prototype` for any UI/UX ticket; `research`
  for the adapter capability questions.
- **Standing preference:** decisions, not deliverables. The scaffold already exists; tickets should
  resolve *what to build*, and only the `prototype` tickets produce artifacts.
- **Fallback:** EUREKA to Track 02 if the 22:00 go/no-go fails. Do not let this map become a reason
  to miss the deadline.

## Candidate tickets

Ordered as a rough frontier. Blocking edges are suggestions; wire them in the tracker.

| # | Name | Type | Blocks | Why it is a decision, not a build |
| --- | --- | --- | --- | --- |
| 1 | Live correlation: how does the airlock see peer intents? | research | 3, 5 | The public API exposes one transition at a time; the design depends on the answer |
| 2 | Authority precedence: is evidence always above containment? | grilling | 4, 9 | A configurable policy changes the demo and the ablation |
| 3 | Which roles actually run a model? | grilling | 5, 9 | 3 vs 6 model-driven roles changes reliability, cost, and the "agents" claim |
| 4 | What counts as harm in the ablation? | grilling | 9 | The metric defines the headline number; must be chosen before measuring |
| 5 | Prototype: the live run's trace table | prototype | 7 | The viewer shape follows the trace shape |
| 6 | Second key: lease, typed confirmation, or both? | grilling | 5 | Determines the human participant and the demo beat |
| 7 | Docker adapter: which actions are honestly reversible? | research | 8 | Claiming an undo you do not have is the one unrecoverable credibility risk |
| 8 | Adapter scope: Docker only, or also a K8s stub? | grilling | 11 | Scope, not capability |
| 9 | Ablation design: arms, scenarios, and the pass condition | grilling | 11 | The number the pitch rests on |
| 10 | Get a GitHub test repo + token for filing issues | task | 11 | Blocks the real handoff demo |
| 11 | Prototype: the airlock/lease timeline in the viewer | prototype | 12 | Proof of concurrency, not decoration |
| 12 | Name and one-line framing | grilling | — | CUSTODY vs VETO vs TWO-KEY vs QUORUM |

## Not yet specified (fog)

- **Red-team generator:** an agent that mutates scenarios to find violations. Strong, but depends
  on the ablation and the live run existing first.
- **Taint at ingestion:** the exact boundary where `tainted` is set. Sharp enough to ticket once
  ticket 1 resolves.
- **Multi-tenant / network integration:** what "on top of existing infrastructure" means beyond one
  Compose stack. Depends on the adapter-scope decision.
- **Persistence and replay:** whether a run can be resumed. Not needed for the demo, might be
  needed for the story.
- **Cost and latency budget:** how many model calls a realistic incident can afford. Depends on the
  role-count decision.
- **Judge Q&A:** the three questions most likely to be asked ("is this real?", "why not just
  CDN/WAF rules?", "what stops a compromised agent?"). Prepare answers after the ablation.

## Out of scope

- A real SIEM, log store, or detection-rule engine.
- Offensive tooling against real systems.
- Kubernetes/cloud deployment.
- Model training or fine-tuning.
- A mobile or desktop client.
- Multi-tenant SaaS concerns (billing, orgs, RBAC beyond the capability model).

## When the map is done

The frontier is empty and every row above is either a closed decision or explicitly out of scope.
At that point the remaining work is execution against the plan, which is not wayfinding.
