# 06 — Infrastructure and the repo handoff

## The twin is the fixture, the adapter is the product

You cannot safely demo mutating production, and a judge knows it. The honest architecture is:

- **`SimAdapter`** — a deterministic digital twin: services, hosts, links, load, vulnerability state,
  seeded RNG, replayable. This is the test harness and the demo. It must be boring and exact.
- **`DockerAdapter`** — the same interface against a local Compose stack (an nginx edge and an
  nginx app, both `nginx:1.27-alpine`). One recorded run proves the seam is real.
- **The interface** — `InfraAdapter` (see [02-action-model](02-action-model.md)). The claim is "swap
  the adapter, keep the runtime", not "trust our mock".

The previous edition's winner was a simulation with a control arm. A simulator is not a weakness;
an unmeasured simulator is.

## Docker mapping

The stack is `docker/compose.yaml`: an `nginx:1.27-alpine` edge published on `127.0.0.1:8080`, an
`nginx:1.27-alpine` app behind it, and a bridge network on `203.0.113.0/24`. The adapter lives in
`src/infra/docker.ts`.

| Intent | Real action in this slice | Status | Reversible by |
| --- | --- | --- | --- |
| `block_egress(edge, cidr)` | append `deny <cidr>;` to `docker/edge/include/deny.conf`, `nginx -t`, reload, probe from `203.0.113.9`, require `403` | implemented (ingress `deny`, not egress) | restore the exact include bytes and reload |
| `unblock_egress(edge, cidr)` | restore the saved include bytes, reload, probe for non-`403` | implemented | — |
| `isolate(host)` | `docker pause` the `app` container | implemented | `docker unpause` |
| `release(host)` | `docker unpause` the `app` container | implemented | — |
| `snapshot(host)` | `docker logs`, `docker top`, `/proc/net/tcp` and `/proc/net/tcp6`, redacted `docker inspect`, hashes | implemented | delete the bundle (no effect on service) |
| `scale(service, n)` | `docker compose up -d --scale app=n app`, then verify `compose ps` | implemented | scale back down |
| `revoke_token(service)` | none | **fails closed with `not_supported`** | n/a |
| `drain_node` | none | **fails closed with `not_supported`** | n/a |

`block_egress` keeps the registry's action name, but the Docker implementation is an ingress
`deny` at the local edge. It rejects the client address; it does not filter the edge's egress. The
one-shot probe is a `curlimages/curl:8.10.0` container started with the attacker's address on the
Compose network, so nginx has a real client to reject.

The recorded money run is `recordings/docker-2026-10-31/`. The rewritten `/32` block returned `403`,
the snapshot wrote a verified bundle, and the scale moved the app from three replicas to six. The
run executed three effects (snapshot, block, scale) and deferred the isolate behind the evidence
lock. `revoke_token` and `drain_node` were not exercised because the money scenario does not ask for
them.

## Evidence bundle

`snapshot` produces a directory with:

```
evidence/<incident>/<host>/<timestamp>/
  meta.json               canonical JSON: host, incident, timestamps, lock, per-artifact sha256
  logs.txt                docker logs --timestamps
  processes.txt           docker top -eo pid,ppid,user,stat,lstart,args
  connections.txt         /proc/net/tcp and /proc/net/tcp6 from inside the app container
  inspect.redacted.json   selected docker inspect fields, every env value redacted
  hashes.txt              sorted "<sha256>  <file>" for the five capture files
  anchor.sha256           sha256 of hashes.txt
```

`hashes.txt` does not list itself or `anchor.sha256`. The chain is artifact → `hashes.txt` →
`anchor.sha256`; the anchor is the hash of the manifest, not the hash of `meta.json`. The trace's
`evidence.anchored` event records the bundle path and the same anchor. `Preserve` locks the host
while the bundle is written; the lock is visible in `CustodianState.locks` and in the trace.

`bun scripts/verify-evidence.ts <bundle>` recomputes every file and the anchor, prints `OK`, and
exits non-zero on the first mismatch. The hashes prove integrity after capture, not identity,
reproducibility, or the absence of tampering before capture.

**Honesty constraint:** do not claim memory capture. A container snapshot is logs + process table +
connections + redacted inspect + hashes. Say that in the README; it is more credible than a fake
memory dump.

## Repo handoff: issue → baro → PR

This is the slow loop, and it is where "makes changes to associated system repos" becomes real.

1. **Scribe** writes `outbox/<incident>/issue.md`:
   - title, CVE/CWE if applicable, affected service and version
   - the evidence ids and what they show
   - a reproduction command
   - a proposed patch (dependency bump, config change, code fix)
2. **File it.** Two modes:
   - `--github` uses `gh issue create --repo <repo> --title ... --body-file issue.md` (real, needs
     auth; record the URL).
   - default writes to `outbox/` and prints the exact `gh` command. No silent fake.
3. **Hand off to baro.** Install the published CLI once from npm, not from the `modules/baro`
   source checkout:

   ```bash
   npm install -g baro-ai
   baro --version
   ```

   Then run the wrapper from `packages/custodian`:

   ```bash
   bun run baro -- --goal outbox/<incident>/goal.txt
   ```

   `bun run baro:check` prints the resolved command without starting a run. The wrapper targets the
   pinned scratch repo, defaults to `--local-only`, and starts its own OpenCode Go proxy. Add
   `--push` only when a PR is wanted. `modules/baro/` is the reference source and submodule; do not
   build or invoke the handoff from there.

   The goal file must name the file, the failing test, and the acceptance criterion. baro's own
   README is explicit that narrow goals work and vague ones do not.
4. **Verify.** Run the target's test command and re-scan. The PR is evidence; the merge is the
   human's call.

Safety: never point baro at the host repo with `--local-only` off during the demo. Use a fork or a
scratch repo, and say which one.

## What is cuttable

| Cut | Cost | What survives |
| --- | --- | --- |
| Docker adapter | lose "real actions", keep "real decisions" | the twin + ablation |
| GitHub filing | lose the public issue URL | `outbox/` + the exact command |
| baro run | lose the PR | the goal file and the interface |
| second real adapter | none | the interface is still the claim |

The airlock and the ablation are not cuttable. Without them there is no entry.
