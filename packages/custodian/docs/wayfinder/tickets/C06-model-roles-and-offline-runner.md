---
id: C06
title: "Model-driven roles and the offline runner"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Model-driven roles and the offline runner

## Question

Which roles actually run a model, and what inference runner makes the live run work **offline**?

Decide together, because the two answers constrain each other:

### Role set

- Which of Watch, Triage, Contain, Preserve, Availability, Scribe, Auditor run a model?
- A defensible default is three model roles (Watch, Contain, Scribe) with the rest deterministic.
  Fewer models means a more reliable demo but a weaker "agents" claim; more models means real
  concurrency but more latency and failure modes.
- For each deterministic role, what is its fixed policy, and is it still a `Participant` on the bus?
- Does the Auditor stay deterministic by design? (Its whole value is that it cannot be talked out
  of a verdict.)
- **Bounded in-flight work:** how many workers per role, what caps concurrency, and what happens when
  the cap is hit? Last edition's winners used a pool cap, not unbounded fan-out; a cap also keeps
  cost and latency defensible.

### Offline runner

- Use a custom `InferenceRunner` with canned/deterministic responses, a recorded real call
  transcript replayed, or live provider calls with a mock fallback?
- If mocked, what makes the run "live" rather than a fixture? (Real Mozaik loops, real event bus,
  real interception, real state mutation — the model is the only canned part.)
- How are model calls and cost labelled in the trace so the README does not imply real spend?
- How does the run degrade when a provider is slow, rate-limited, or returns unparseable output?
- DeepSeek lacks structured output; which provider/model per role, and how is parsing defensive?

## Why this is a decision, not a build

The 30-point criterion asks whether agents actually run together. The answer determines the worker
pool, the trace shape, the demo's failure fallback, and the cost line. It also determines whether
"works offline" and "live multi-agent" can both be true — the central tension in the constraints.

## Inputs

- `01-architecture.md` §"Participants" and §"Concurrency".
- `07-demo-and-rubric.md` §"Failure fallbacks".
- `08-platform-mozaik.md` §"Models" and `09-mozaik-api-notes.md` §"Models".
- `03-airlock.md` §"Failure modes" (unknown action, model parse failure).

## Resolution

**Resolved 2026-10-30 (delegated).** Three roles run a model; four are deterministic. The model is
canned by default so the run is offline and reproducible; the bus, loops, interception and state are
real.

| Participant | Model? | Model / policy | May propose |
| --- | --- | --- | --- |
| Watch | **yes** | `deepseek-v4-flash` (live) or scripted (mock) | nothing |
| Triage | no | deterministic: incident → affected services + smallest target set | nothing |
| Contain | **yes** | `deepseek-v4-pro` (live) or scripted (mock) | block, isolate, drain, revoke |
| Preserve | no | deterministic: lock the evidence target, snapshot first | snapshot, lock |
| Availability | no | deterministic: budget owner; scale/narrow veto | scale, drain |
| Scribe | **yes** | `deepseek-v4-flash` (live) or template + scripted summary (mock) | nothing (writes issue/goal) |
| Auditor | no | deterministic invariants over the trace | nothing (vetoes) |

- **Runner:** a custom `InferenceRunner` injected through
  `initializeRuntime({ inferenceRunnerConfig })`. Default `CUSTODIAN_MODE=mock` returns role-specific
  `FunctionCallItem` / `ModelMessageItem` values keyed by the scenario; `CUSTODIAN_MODE=live` uses the
  configured provider. The mock is not a fixture of the airlock: the loops, events, interception,
  state mutation and decisions are the real runtime.
- **"Live multi-agent"** means real Mozaik loops and real cross-loop interleaving. The trace labels
  `runner: "mock"` and `costUsd: 0`; the README says the model is canned offline and shows the live
  mode as optional.
- **Bounded in-flight:** pool caps Watch 1, Triage 1, Contain 2, Preserve 1, Availability 1, Scribe
  1, Auditor 1. At most 8 concurrent participants, 3 of them model loops.
- **Live failure:** on provider error/timeout, emit `inference.fallback`, use the scripted response
  for that role, and continue. If no scripted response exists, propose nothing (fail closed). DeepSeek
  has no structured output, so parse defensively and validate the action against the registry.
- **Fresh `ModelContext` per turn**; never share one across concurrent loops.
- Why not six: cost, latency and offline reliability. The deterministic Preserve/Availability are
  more credible as judges than as prompted agents, and the concurrency claim rests on participants
  running together, not on the model count.
