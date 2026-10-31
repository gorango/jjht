# 11. Demo surfaces and handoff completion plan

**Status:** execution plan, opened 2026-10-31 01:15 CET. Not a wayfinder decision. The map stays
closed. This document fixes the execution order, interfaces, files, acceptance tests and fallbacks
for the remaining demo work so a builder needs no further architecture call.

**Post-execution note (2026-10-31):** the scratch repository was renamed from
`gorango/custody-scratch` to `gorango/jjhts` and made public, then pinned in this repository at
`modules/custody-scratch`. The "private" statements below describe the conditions during execution
and are kept as the record. Issue #1 now exists at
<https://github.com/gorango/jjhts/issues/1>.

**Baseline:** `master` at `5f82c19`. The vertical-slice predicate is met. `bun run custody` exits 0
with `INFLIGHT 5`, all ten scenarios pass, and `bun run custody:ablate` reports `custody = 0` and
`naive = 15`. Nothing in this plan may regress that baseline.

## Destination

Three demo surfaces, all equally weighted, plus the closing handoff:

1. **A dashboard** that triggers any scenario and shows the run live: loops in flight, intents,
   the decision window, decisions with reasons, and executed effects.
2. **A Docker adapter** behind the existing `InfraAdapter` seam, with one recorded run that shows a
   real 403 and a verifiable evidence bundle.
3. **A baro handoff** with a real issue or a committed outbox, a goal file, an independent run, and
   a patched reproduction that shows the attack no longer works.

The plan is done when a clean clone can run the CLI, open the dashboard, replay the Docker recording,
and read the baro artifacts and the patched result, with every claim tied to a committed artifact.

## Operator directive

The earlier cut order in the Vertical slice contract put the viewer first and Docker second. The
operator has reversed that for the demo. Dashboard, Docker and baro are peers. This plan re-ranks
only the remaining execution work. It does not change any closed decision in C01 through C17.

## Baseline inventory

| Thing | State |
| --- | --- |
| Runtime | `bun run custody`, mock inference, real Mozaik loops and bus |
| Trace | `trace.jsonl`, 103 events for money, JSONL, one row per bus event |
| Adapter seam | `InfraAdapter` with a synchronous `apply`, one `SimAdapter` |
| Viewer | none in CUSTODY. EUREKA has `packages/eureka/public/viewer.html` and `src/trace-server.ts` |
| Tests | 53 pass, 0 fail |
| Ablation | `eval/results.json`, three arms, `patched` labelled not run |
| Docker | daemon 29.8.2, Compose 5.5.1 available |
| GitHub | `gh` logged in as `gorango` |
| Scratch repo | `gorango/custody-scratch`, currently **private** |
| baro | submodule `modules/baro` at `e81b87e` (`v0.91.0-540`), package `baro-ai` 0.121.0, binary not installed, `OPENAI_API_KEY` set, `opencode` and `pi` available |

## Workstream A. Dashboard

### Goal

A local page where the operator clicks a scenario and watches the run. It must show concurrency
without reading JSONL, and it must let the operator replay any recorded trace.

### Command contract

| Command | What it does | Required |
| --- | --- | --- |
| `bun run custody:dashboard` | Serve `http://localhost:8787`, open the dashboard | Yes |
| `bun run custody:dashboard --port 0` | Bind an ephemeral port and print the URL | Yes |
| `bun run custody:dashboard --replay <trace.jsonl>` | Start with a saved trace loaded | Yes |
| `bun run custody --scenario <id>` | Unchanged CLI fallback | Yes |

### Architecture

- **One server, one page.** `src/server.ts` uses `Bun.serve` or `node:http`. `public/dashboard.html`
  is one file with inline CSS and JavaScript. No framework, no build step, no new dependency, no
  network asset.
- **Child process per run.** `defineRuntime` is a process singleton. The server spawns
  `bun src/index.ts --scenario <id> --adapter <sim|docker> --trace runs/<runId>/trace.jsonl` and
  never boots the runtime itself. One active run at a time. A second `POST /api/runs` returns 409
  while one is running.
- **Polling, not sockets.** The page polls `GET /api/runs/<id>/events?offset=n` every 200 ms while
  the child is alive. The server reads the JSONL file and returns rows after the offset plus the
  child state. Simple, debuggable, good enough for a demo.
- **Summary from the trace, not from stdout.** On exit the server writes `runs/<runId>/result.json`
  with the exit code, the expected match count, executed effects, harmful effects, `INFLIGHT` max,
  and the window loop ids. Parse the trace and the scenario fixture, never the CLI text.
- **Replay.** The same page loads a completed `trace.jsonl` and steps through it at a fixed rate or
  on demand. Replay uses the same renderer as the live feed.

### HTTP contract

| Method and path | Body or query | Returns |
| --- | --- | --- |
| `GET /` | none | `dashboard.html` |
| `GET /api/scenarios` | none | `[{id, title, expected}]` from `SCENARIOS` |
| `POST /api/runs` | `{scenario, adapter?}` | `{runId, tracePath}`, or 409 |
| `GET /api/runs` | none | saved runs with scenario, time, pass/fail |
| `GET /api/runs/:id/events` | `offset` | `{rows, next, running, exitCode}` |
| `GET /api/runs/:id/summary` | none | the `result.json` body |
| `GET /runs/:id/trace.jsonl` | none | raw JSONL |

### Screen

- Header: CUSTODY, scenario name, run state, elapsed time, a large `INFLIGHT` badge.
- Left rail: scenario buttons (money first, benign second, then the rest), an adapter toggle that
  appears only when the Docker adapter is available, and a replay dropdown.
- Center: event feed. Time, producer, event type, one-line summary. Color by class: proposal,
  window, decision accept/rewrite/defer/reject, evidence, executed, error. Filter chips for
  `intents`, `decisions`, `evidence`, `all`.
- Right: decision table with intent, agent, action, target, decision, reason. Selecting a row shows
  votes and the matching findings.
- Bottom: result strip. Expected `n/n`, effects executed, harmful effects, trace path.
- A run is a sequence of visible beats. `window.opened`, then every `intent.proposed`, then
  `window.closed` with the INFLIGHT count, then `decision.made`, then `action.executed`.

### Files and ownership

| Path | Change |
| --- | --- |
| `src/server.ts` | New. Server, run registry, child spawn, trace polling, summary |
| `public/dashboard.html` | New. Single-file UI, adapted from EUREKA's viewer |
| `tests/dashboard.test.ts` | New. Start on port 0, run money with `CUSTODY_WINDOW_MS=120`, assert 5 proposals before `window.closed`, `INFLIGHT >= 2`, 5 decisions, replay |
| `packages/custody/package.json` | Add `dashboard` script |
| root `package.json` | Add `custody:dashboard` |

`runs/` is already gitignored. Do not commit run output.

### Acceptance

1. `bun run custody:dashboard` serves and prints the URL.
2. Clicking money runs the scenario and the feed shows five `intent.proposed` before one
   `window.closed`, with `INFLIGHT 5` and five distinct loop ids.
3. The decision table matches the CLI, including the REWRITE, DEFER and REJECT reasons.
4. Clicking benign shows `NO ACTION` and zero executed effects.
5. Replay loads the last run's trace without starting a process.
6. A second run while one is active is refused with 409.
7. No new dependency, no external asset, works with the network off.
8. `bun test` remains green. A manual browser check uses the `control-ui` skill.

### Minimum and fallback

Minimum: scenario buttons, live feed, INFLIGHT badge, decision table. Stretch: replay scrubbing,
loop lanes, finding and vote detail.

If child spawn or polling proves unreliable, fall back to a two-step page that runs the CLI in a
terminal and loads `trace.jsonl` after it exits. The trigger and the result table must still work.
The CLI remains the source of truth.

## Workstream B. Docker adapter and recorded run

### Goal

A second real `InfraAdapter` implementation behind the same port, plus one recorded run that shows a
real edge 403 and an evidence bundle that verifies. The claim is "swap the adapter, keep the
runtime", not "production ready".

### Interface decision

`InfraAdapter.apply` becomes asynchronous. Docker commands take seconds; blocking the event loop
would freeze the window clock and the other loops.

```ts
export interface InfraAdapter {
  apply(intent: Intent, path: ExecutedAction["path"]): Promise<ExecutedAction>;
  lockEvidence(input: LockInput): EvidenceLock;
}
```

Changes required:

- `SimAdapter.apply` becomes `async` and returns the same value.
- `actTool.invoke` awaits `adapter.apply`.
- `AirlockCoordinator.execute` becomes async and is invoked with a `.catch` that publishes
  `action.failed {intentId, path, reason}`. A failed action is not added to `state.executed`, per
  C05.
- Any test that calls `apply` awaits it.

This is the only cross-cutting change in the plan. The Docker lane owns it and merges before the
dashboard lane's final rebase. The dashboard lane does not edit these files.

### Stack

`docker/compose.yaml` with two services:

- `edge`: nginx, published on `127.0.0.1:8080`, proxies to `app`.
- `app`: nginx, internal only, returns 200 on `/checkout`.

The compose network is declared with the subnet `203.0.113.0/24`, so the attacker address can be
real. A `probe` service is not long running. The adapter runs a one-shot curl container at
`203.0.113.9` on that network, so the `/24` and the narrowed `/32` both match. The network name,
subnet and probe image are configuration, not hardcoded in the domain. The edge itself sits on the
same subnet; nginx `deny` applies to client addresses, so the edge to app hop is unaffected.

### Adapter mapping

| Intent | Docker action | Reversible | Required |
| --- | --- | --- | --- |
| `block_egress(edge, cidr)` | Append `deny <cidr>;` to the edge include, `nginx -t`, reload, probe from `203.0.113.9` for 403 | Remove the line and reload | Yes |
| `unblock_egress` | Remove the line, reload | n/a | Yes |
| `snapshot(host)` | Logs, process table, connections, redacted inspect, `meta.json`, `hashes.txt`, `anchor.sha256` | Delete the bundle | Yes |
| `isolate(host)` | `docker pause <app>` | `unpause` | Stretch |
| `release(host)` | `docker unpause <app>` | n/a | Stretch |
| `scale(service, n)` | `docker compose up -d --scale app=n` and record replica count | Scale back | Stretch |
| `drain_node`, `revoke_token` | Fail closed with `not_supported` | n/a | No |

Name the block honestly. C02 found that nginx `deny` is an ingress approximation, not a
destination-based egress block. The README and the recording must say "ingress 403 at the local
edge", never "real egress block".

`block_egress` validates its CIDR against the same protected ranges as the airlock. It records the
previous include file so `unblock_egress` restores exactly.

### Evidence bundle and verifier

`snapshot` writes to the recording directory, not the gitignored `evidence/`:

```text
recordings/docker-<date>/evidence/<incident>/<host>/<timestamp>/
  meta.json
  logs.txt
  processes.txt
  connections.txt
  inspect.redacted.json
  hashes.txt
  anchor.sha256
```

`meta.json` is canonical JSON (sorted keys, compact separators, trailing newline). `hashes.txt` is
sorted `<sha256>  <file>`. `anchor.sha256` is the hash of `hashes.txt`. The trace gains
`evidence.anchored {bundle, anchor}`.

`bun run custody:verify-evidence <dir>` recomputes `sha256sum -c hashes.txt` and the anchor, prints
`OK` or the first mismatch, and exits non-zero on failure. This is a small script, not a service.

### CLI and reporting

Add `--adapter sim|docker` to `bun src/index.ts`. Default `sim`. The `ScenarioReport` gains
`adapter` and `failed` (actions that raised). The CLI prints `adapter: docker` and the recording
path. For the recorded run, set the adapter's evidence root through `CUSTODY_EVIDENCE_DIR` or a
flag so the bundle lands under `recordings/`.

### Files and ownership

| Path | Change |
| --- | --- |
| `src/infra/adapter.ts` | Async `apply`, `action.failed` semantics |
| `src/infra/docker.ts` | New `DockerAdapter` |
| `src/agents/scheduler.ts`, `src/agents/airlock-coordinator.ts` | Await apply, catch and publish failure |
| `src/index.ts`, `src/run.ts` | `--adapter` flag, report field, evidence root |
| `docker/compose.yaml`, `docker/edge/`, `docker/app/` | New stack |
| `scripts/verify-evidence.ts` | New verifier |
| `tests/docker-contract.test.ts` | Same action sequence against Sim and Docker, skipped unless `CUSTODY_DOCKER=1` |
| `recordings/docker-<date>/` | Committed trace, stdout, evidence bundle, `README.md` |
| `packages/custody/package.json` | `verify-evidence` script, `docker:up`, `docker:down` |

### Acceptance

1. `docker compose -f docker/compose.yaml up -d` brings the stack up; `curl 127.0.0.1:8080/checkout`
   returns 200 before any block.
2. `bun run custody --adapter docker` completes the money scenario. The narrowed block executes and
   the probe records a 403. The snapshot writes a bundle. `scale` is either implemented for Docker or
   fails closed as `action.failed`; the recording says which, and a failed action is not counted as
   executed.
3. `bun run custody:verify-evidence <bundle>` prints `OK`.
4. `CUSTODY_DOCKER=1 bun test` runs the contract test and passes. Without the env, the test is
   skipped with a clear reason.
5. `docker compose down -v` leaves no containers or volumes.
6. The recording under `recordings/docker-<date>/` contains the trace, the 403 proof, the bundle,
   the hashes, and the exact commands.
7. The README says "one recorded Docker run", lists which actions ran, and names the ingress
   approximation and the absence of memory capture.

### Minimum and fallback

Minimum: `block_egress`, `unblock_egress`, `snapshot`, verifier, contract test, one recording with a
403 and a verified bundle.

If the daemon, the network, or the probe fails, do not fake a recording. Keep the adapter and the
skipped contract test, and label the surface "adapter implemented, not recorded". The twin remains
the demo.

**Timebox:** 4 hours. Hard stop at 4.5 hours.

## Workstream C. Baro handoff and patched reproduction

### Goal

Close the slow loop with a real issue or a committed outbox, a goal file, an independent baro run,
and a reproduction that fails before the patch and passes after it. No fake PR.

### Preconditions

1. Install the baro binary. From `modules/baro`, run `npm rebuild baro-ai` or
   `cargo build --release -p baro-tui` and place the binary at `~/.baro/bin/baro`. Then run
   `baro --doctor`.
2. Choose a backend. `OPENAI_API_KEY` is set, so `--llm openai` is the default. `opencode` and `pi`
   are installed and are the fallback. Never use `--local-only` off against this repository.
3. Resolve the scratch repo visibility. `gorango/custody-scratch` is **private**, while C13 assumes
   public. Making it public is an irreversible external action and needs the operator. Default to
   the private repo plus the committed outbox and the exact `gh` command. A public issue URL is
   upside, not a requirement.

### Steps

1. **Issue.** File issue #1 in the scratch repo if it is public and authenticated:
   `gh issue create --repo gorango/custody-scratch --title ... --body-file outbox/inc-1/issue.md`.
   Otherwise write `outbox/inc-1/issue.md` and print the exact command. The issue text comes from
   the scenario: the tainted log line, the affected `src/checkout.ts`, the failing
   `test/checkout.test.ts`, and the evidence ids.
2. **Goal file.** Write `outbox/inc-1/goal.txt` exactly as C13 specifies: repo, file, failing test,
   acceptance (`bun test` passes, no shell interpolation remains, argument array not a WAF rule),
   constraints (do not edit the test, no new dependencies, open a PR, do not merge), evidence.
3. **Run.** Clone the scratch repo to `/tmp/custody-scratch`, branch `custody/inc-1`, then:
   `baro --llm openai --headless --detach --local-only --goal-file outbox/inc-1/goal.txt`.
   Capture the run id, `baro watch <run-id>` output, and `baro logs <run-id>`.
4. **Verify.** In the patched checkout run `bun test`, capture the diff and the commit. If baro
   produced no commit, stop and use the fallback.
5. **Commit artifacts.** `recordings/baro-inc-1/` contains `issue.md` or the issue URL, `goal.txt`,
   `run-id.txt`, `watch.log`, `diff.patch`, `test-output.txt`, and `README.md` with the exact
   commands.
6. **Patched reproduction.** Add `scripts/patched-check.ts` with this contract:

   ```text
   bun scripts/patched-check.ts --vulnerable <path-or-ref> --patched <path-or-ref>
   ```

   It runs the goal's reproduction against both checkouts and merges the result into
   `eval/results.json` under a new `patched` object:

   ```json
   "patched": {
     "status": "run",
     "scenario": "dependency-vuln",
     "before": { "attackSucceeded": true },
     "after": { "attackSucceeded": false },
     "command": "bun test test/checkout.test.ts",
     "vulnerableRef": "main",
     "patchedRef": "custody/inc-1"
   }
   ```

   If no patched checkout exists, the block is `{ "status": "not run" }` and the README says so.
   The current `patched` string in `results.json` is replaced by this object.

   The reproduction is the failing test, not a live shell. `attackSucceeded` is true when the
   reproduction shows the vulnerability. Before the patch the injection test fails, so the attack
   succeeds. After the patch it passes, so the attack fails. This is narrower than C14's "same ten
   scenarios" wording, and deliberately so: the patch lives in the scratch app, not in the airlock.
   The claim is scoped to the reproduction, and `results.json` labels it.

7. **README.** Link the issue or the outbox, the goal file, the run id, the branch or commit, and
   the patched block. Use the C17 wording. Never say CUSTODY fixed the code. Say an independent
   agent did, and CUSTODY produced the claim-backed goal.

### Files and ownership

| Path | Change |
| --- | --- |
| `outbox/inc-1/issue.md`, `goal.txt` | New, committed |
| `recordings/baro-inc-1/` | New, committed |
| `scripts/patched-check.ts` | New |
| `src/eval/ablate.ts`, `scripts/ablate.ts` | Accept and merge the `patched` block |
| `tests/patched.test.ts` | New, runs only when both checkouts are supplied |

### Acceptance

1. The issue exists and is linked, or the outbox and exact command are committed.
2. The goal file matches C13 and names the file, the failing test, and the acceptance criterion.
3. The baro run id and log are committed, or the fallback is labelled.
4. The patched checkout passes `bun test`; the vulnerable checkout fails the reproduction.
5. `eval/results.json` has either the patched object with `before.attackSucceeded: true` and
   `after.attackSucceeded: false`, or `status: "not run"`.
6. The README claim matches the artifact.

### Minimum and fallback

Minimum: issue or outbox, goal file, exact command, and `patched: not run`. Stretch: the baro run,
the branch, and the patched reproduction.

If baro cannot install, cannot reach a backend, or produces no commit, commit the artifacts and the
exact command, and label the run "not run". Do not fake a PR, a branch, or a test result.

## Equal-priority execution

All three lanes run with their own owner and their own files. Use separate worktrees or serialize
merges; do not let two agents edit the same file.

| Lane | Owns | Shared with others |
| --- | --- | --- |
| A Dashboard | `src/server.ts`, `public/`, `tests/dashboard.test.ts` | package scripts (integrator) |
| B Docker | `src/infra/`, `src/agents/scheduler.ts`, `src/agents/airlock-coordinator.ts`, `src/run.ts`, `docker/`, `scripts/verify-evidence.ts`, `tests/docker-contract.test.ts`, `recordings/docker-*` | `src/index.ts` adapter flag, package scripts (integrator) |
| C Baro | `outbox/`, `recordings/baro-*`, `scripts/patched-check.ts`, `src/eval/ablate.ts`, `scripts/ablate.ts`, `tests/patched.test.ts` | `eval/results.json`, README (integrator) |

The integrator owns `package.json`, the root scripts, `README.md`, `docs/judging.md`, and the final
`.gitignore` changes. Recorder artifacts are committed. `runs/`, `evidence/` and `outbox/` remain
ignored, except the specific outbox files that are evidence and are force-added.

### Gates

| Gate | Exit test |
| --- | --- |
| G0 Baseline | clean clone passes install, test, live, harmless, ablate; tag `slice-green` |
| G1 Lane minimums | each lane reaches its minimum; full suite green |
| G2 Integration | dashboard triggers all ten; Docker recording verifies; baro artifacts committed; full suite green |
| G3 Claims and docs | README, judging map, and recordings match artifacts; every number has a source |
| G4 Rehearsal || a second clean clone runs the README commands; demo script rehearsed twice |
| Freeze || no feature edits after this; fixes and docs only |
| Submit | entry confirmed on the site |

## Ordered acceptance checklist

1. `git tag slice-green 5f82c19`. Clean clone, `bun install`, `bun run custody`,
   `bun run custody --scenario benign`, `bun run custody:test`, `bun run custody:ablate`.
2. `bun run custody:dashboard` opens, runs money, shows `INFLIGHT 5`, runs benign, replays a trace.
3. `docker compose -f docker/compose.yaml up -d`, `bun run custody --adapter docker`, 403 recorded,
   bundle verifies, `docker compose down -v`.
4. `outbox/inc-1/goal.txt` and the issue or the exact `gh` command exist. If baro ran, the run id,
   branch and `bun test` output are committed. `eval/results.json` has the patched block or
   `not run`.
5. `docs/judging.md` maps each rubric criterion to a file and a command.
6. README updates: dashboard command, Docker claim and limits, baro claim and limits, patched
   status, new test count, new event count if it changed.
7. Full suite green, tree clean, all recordings committed.
8. Clean clone on a second path or machine repeats steps 1 to 3.

## Claims

| Artifact | Proves | Does not prove |
| --- | --- | --- |
| Dashboard | Loops and the window were observed together | Real infrastructure |
| Docker recording | One real ingress block and one real capture path | Egress blocking, production safety, memory capture |
| Baro handoff | An independent agent received a claim-backed goal and changed the scratch repo | CUSTODY wrote or merged the fix |
| Patched reproduction | The injection test fails before the patch and passes after it | A general security fix or a statically safe app |

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Dashboard eats the day | High | 3 hour timebox, minimum defined, no framework |
| Docker probe cannot get a 403 | Medium | Fixed probe address on the compose network; if it fails, label the run not recorded |
| Async adapter breaks the window | Medium | Merge the Docker lane first, run the full suite, keep the Sim adapter behavior identical |
| baro will not install or has no backend | High | 30 minute install box; outbox plus exact command is the documented fallback |
| Scratch repo is private | Certain | Operator decision on visibility; default to private plus outbox |
| Three lanes collide in `src/index.ts` and `package.json` | Medium | Integrator owns shared files; lanes rebase and hand off |
| Time lost to visual polish | High | Minimum screen defined; polish only after G2 |

## Non-goals

- Live inference. The mock is honest and sufficient.
- Viewer authentication, multi-user access, or remote hosting.
- Kubernetes, production deployment, or a second real adapter.
- Memory capture, packet capture, or evidence signatures.
- Faking a PR, a Docker run, or a baro result.
- Any change to the airlock's precedence, the ten scenarios' expectations, or the ablation pass
  condition.

## Links

- [Vertical slice contract](wayfinder/tickets/C15-vertical-slice-contract.md)
- [Adapter scope](wayfinder/tickets/C11-adapter-scope.md)
- [Docker reversibility and evidence capture](wayfinder/tickets/C02-docker-reversibility.md)
- [Evidence format](wayfinder/tickets/C12-evidence-format.md)
- [Baro handoff contract](wayfinder/tickets/C13-baro-handoff.md)
- [Ablation and verification design](wayfinder/tickets/C14-ablation-design.md)
- [Claim discipline](wayfinder/tickets/C17-claim-discipline.md)
- [Prototype: airlock and lease timeline](wayfinder/assets/p03-timeline.md)
