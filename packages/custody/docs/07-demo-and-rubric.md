# 07 — Demo and rubric

## Freestyle scoring (from the brief)

| Criterion | Points | What the jury is asking |
| --- | --- | --- |
| Useful and original | 30 | Is this a real problem, solved in a way we have not seen? |
| How it uses Mozaik: agents in parallel, shared state | 30 | Do agents actually run together, and is the coordination on the bus? |
| It works: we can run it from the README | 25 | Does `install && run` produce the thing, without keys? |
| README: clear what it does and how | 15 | Can a stranger explain it after two minutes? |

## Mapping, honestly

| Criterion | Current evidence | Missing |
| --- | --- | --- |
| Useful & original | the thesis + the five-intent replay + the injection rejection | the ablation numbers; a real adapter run |
| Mozaik use | `reconcile` is the joint decision; adapter is typed against v4.1.0 | agents are not wired yet, so "parallel" is still a fixture |
| It works | `bun run custody` is deterministic and exits non-zero on mismatch | `npm ci`-equivalent from a clean clone; the wired run |
| README | this docs set + package README | the 60-second block is drafted, not final |

**The gap that matters:** right now the concurrency is *modelled* (five intents in one call), not
*observed* (five loops actually interleaving). The 30-point criterion is about the latter. Wiring the
worker/pool is the highest-value next step, ahead of any adapter.

## Three-minute script

**0:00 — the sentence.**
> "Every AI security demo lets a model read attacker-controlled logs and then run commands. That is
> remote code execution with extra steps. CUSTODY is the version where the attacker can write the
> logs and still cannot write the system."

**0:20 — the replay.** `bun run custody`.

Point at the five rows, not the prose:
- snapshot accepted
- block narrowed from /24 to /32 because the blast budget is 8%
- isolate **deferred** because forensics holds the host and it carries 40% of payments
- injected `/8` **rejected** — tainted rationale, protected range, 90% blast
- scale accepted

> "Four agents, five intents, one decision window. No agent called another; the airlock decided them
> together."

**1:00 — the mechanism.** Show `src/domain/invariants.ts` for ten seconds.

> "Authority is code, not a prompt. Capability, provenance, taint, undoability, blast radius,
> evidence lock. The model cannot talk its way past a function."

**1:30 — the ablation.** Show the table (once it exists).

> "Same ten incidents, two arms. Without the airlock: N harmful actions, M injected instructions
> obeyed. With it: zero. The scenarios and labels are in the repo."

**2:15 — the real seam.** One Docker run, recorded: nginx deny → 403 in the log; snapshot bundle
with hashes.

**2:40 — the handoff.** The issue text and the baro goal file.

> "The runtime does not write code. It writes a claim-backed issue and a goal an independent coding
> agent can execute. The PR is the slow loop; containment is the fast one."

**2:55 — close.**
> "The deliverable is not a SOC. It is an authority model for agents that can touch production —
> and the loop closes: contain, fix, prove."

## 60-second cut

Replay table (15s) → "taint rejected, capability held" (10s) → ablation numbers (15s) → Docker 403
(10s) → issue/goal file (5s) → close (5s).

## Failure fallbacks

| Failure | Fallback |
| --- | --- |
| Docker will not start | twin only; say "the adapter is implemented, the demo is the twin" — do not pretend |
| Model provider is slow | run the mock; the airlock is deterministic and does not need a model |
| baro is flaky | show the goal file + the intended command; do not fake a PR |
| Viewer breaks | `trace.jsonl` + the CLI table |
| A judge asks "is this real?" | open `src/domain/invariants.ts` and run `bun test` |

## Judging map (to finish)

Create `docs/judging.md` at the end with one row per criterion, each pointing at a file and a
command:

```md
| Criterion | Where | Proof |
| --- | --- | --- |
| Parallel agents | src/agents/pool.ts | `bun run custody` → N turns in flight (fill N after wiring) |
| Shared state | src/runtime/state.ts | trace: two participants mutate `locks` and `decisions` |
| Works | README | `bun install && bun run custody` |
```

A judge with five minutes will not read 22 KB of prose. That table is the entry's index.
