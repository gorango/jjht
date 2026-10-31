# Judging map

One row per rubric criterion, with the file a judge can open and the command that proves the claim.
Every number quoted in the README comes from one of these commands or from a committed artifact.

Run every command from the repository root unless the row says otherwise.

| Criterion | Where | Proof |
| --- | --- | --- |
| Useful and original | [`00-thesis.md`](00-thesis.md), README opening | The sentence and the conflict table. No number is required. |
| Mozaik: agents in parallel | `src/agents/scheduler.ts`, `src/agents/airlock-coordinator.ts` | `bun run custodian` prints one `window` line with `INFLIGHT 5` and five distinct loop ids, and the trace carries the same ids on the `interception.started` spans. |
| Mozaik: shared state | `src/runtime/state.ts` | The same run's `trace.jsonl` shows Preserve writing `evidence.locked` and the Airlock writing `decision.made` against one `CustodianState`. |
| It works | README `## Run it` | `bun install && bun run custodian` offline, then `bun run custodian --scenario benign`, `bun run custodian:test`, `bun run custodian:ablate`. |
| README clarity | README first screen | The one sentence, one command, one five-row table, one ablation table, one diagram. |
| Dashboard | `src/server.ts`, `public/dashboard.html` | `bun run custodian:dashboard`, click money, read `INFLIGHT 5`, the five decision rows, and `PASS 5/5`. From `packages/custodian`, `bun test tests/dashboard.test.ts` covers the same beats over HTTP, and `bun scripts/dashboard-check.ts` drives all ten through a running server. Screenshots of the live page and replay are in `recordings/dashboard/`. A passing money run shows **Hand off to baro**, which starts the push-and-PR job against `gorango/jjhts` and streams the log. That button opened [PR #2](https://github.com/gorango/jjhts/pull/2), a labelled checkpoint whose head passes `bun test`. It is open and unmerged; merge is not automated. |
| Ablation | `eval/results.json` | `bun run custodian:ablate`. The quoted numbers are `totals.naive.harmful = 15`, `totals.checks-only.harmful = 15`, `totals.custodian.harmful = 0`, `totals.naive.obeyed = 2`, `totals.custodian.obeyed = 0`, `pass = true`. |
| Real seam: Docker | `src/infra/docker.ts`, `recordings/docker-2026-10-31/` | `bun run custodian:docker:up`, `bun run custodian --adapter docker` with `CUSTODIAN_EVIDENCE_DIR` set, then `bun run custodian:verify-evidence <bundle>` prints `OK`. The recorded probe is `403` from `203.0.113.9`. From `packages/custodian`, `CUSTODIAN_DOCKER=1 bun test tests/docker-contract.test.ts` runs the contract against both adapters. |
| Slow loop: baro handoff | `outbox/inc-1/`, `recordings/baro-inc-1/`, `modules/custodian-scratch/` | Public issue #1 at <https://github.com/gorango/jjhts/issues/1>, the goal file, the baro run id and watch log, the recorded diff and commit log, and the repository pinned as a submodule. The diff applies cleanly to the pinned commit. The recorded run produced no PR; the dashboard handoff later opened [PR #2](https://github.com/gorango/jjhts/pull/2) as a checkpoint. It is open and unmerged. `bun run baro:check` prints the current OpenCode Go command, and `bun run baro` reruns the handoff against the pinned submodule. |
| Closed loop: patched reproduction | `scripts/patched-check.ts`, `eval/results.json` | `CUSTODIAN_SCRATCH_REPO=<clone> bun scripts/patched-check.ts --vulnerable main --patched 7c3d7ba` records `before.attackSucceeded: true` and `after.attackSucceeded: false`; `bun run custodian:ablate` copies that object into `eval/results.json`. |

## What the artifacts prove and do not prove

| Artifact | Proves | Does not prove |
| --- | --- | --- |
| Dashboard | Loops and the decision window were observed together, live | Real infrastructure |
| Docker recording | One real ingress block at the local edge and one real capture path | Destination-based egress blocking, production safety, memory capture |
| baro handoff | An independent agent received a claim-backed goal and produced a test-passing fix commit | CUSTODIAN wrote, pushed, or merged the fix; the checkpoint PR is verified or merge-ready |
| Patched reproduction | The injection test fails before the patch and passes after it | A general security fix, or that the scratch app is safe under other inputs |

## Honest limitations

- No memory, packet, disk, or rootfs capture. The snapshot is logs, process table, connections,
  redacted inspect, and hashes.
- The Docker block is an ingress `deny` at the local edge. The edge can still connect out to the
  same CIDR. The README and the recording say "ingress 403", never "real egress block".
- The ten scenarios and their labels are the builder's. Three external patterns are cited (OWASP
  LLM01 and MITRE ATT&CK). A judge can recompute and disagree; the fixtures are committed.
- The offline model is canned. The runtime, bus, interception, and state are real. Every inference
  span names `mock`, and the trace says `costUsd: 0`.
- Ten scenarios are not statistical significance. The results are per scenario, not a p-value.
- The demo is deterministic by construction. One unedited Docker run and one real baro run balance
  it; the recorded baro run failed its own PR-evidence gate, and a later handoff opened a checkpoint
  PR instead.
- The baro fix was produced on a local clone of the repository now public as `gorango/jjhts`.
  Issue #1 is public. The recorded run pushed nothing; the dashboard handoff opened PR #2 as a
  checkpoint. It is open and unmerged. The recording binds the recorded commit with `commit.txt`,
  and the recorded diff applies cleanly to the pinned `modules/custodian-scratch` submodule.
- The repo's EUREKA package predates the event. Its history is disclosed in the workspace README.

## Likely judge questions

**"Is this real?"** Open `src/domain/invariants.ts`, run `bun run custodian:test`, and read the trace
for one window with five loop ids. Then run the Docker recording's verifier.

**"Why not just CDN or WAF rules?"** A WAF cannot defer to an evidence lock, hold five half-formed
intents in one window, or reject an action because its rationale derives from attacker-controlled
text. CUSTODIAN is an authority model; the block is one small effect it can order.

**"What stops a compromised agent?"** Capability, provenance, taint, undoability, blast radius, and
the evidence lock are checked in `src/domain/invariants.ts` before an effect. A compromised agent
can propose. It cannot clear the taint bit, exceed its capability, or execute except through the
airlock.
