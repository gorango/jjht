# 06 — Infrastructure and the repo handoff

## The twin is the fixture, the adapter is the product

You cannot safely demo mutating production, and a judge knows it. The honest architecture is:

- **`SimAdapter`** — a deterministic digital twin: services, hosts, links, load, vulnerability state,
  seeded RNG, replayable. This is the test harness and the demo. It must be boring and exact.
- **`DockerAdapter`** — the same interface against a local Compose stack (nginx + app + redis). One
  recorded run proves the seam is real.
- **The interface** — `InfraAdapter` (see [02-action-model](02-action-model.md)). The claim is "swap
  the adapter, keep the runtime", not "trust our mock".

The previous edition's winner was a simulation with a control arm. A simulator is not a weakness;
an unmeasured simulator is.

## Docker mapping

| Intent | Real action | Reversible by |
| --- | --- | --- |
| `block_egress(edge, cidr)` | append `deny <cidr>;` to the nginx config and reload | remove the line, reload |
| `isolate(host)` | `docker pause <container>` (or stop) | `docker unpause` |
| `snapshot(host)` | copy logs, `docker top`, `ss -tnp`, hash the bundle | delete the bundle (no effect on service) |
| `revoke_token(service)` | rotate the app's API key in its env | reissue + redeploy — deliberately manual |
| `drain_node` | stop routing to a container, keep it alive | re-add to upstream |
| `scale(service, n)` | `docker compose up --scale app=n` | scale back down |

**Honesty constraint:** do not claim memory capture. A container snapshot is logs + process table +
connections + hashes. Say that in the README; it is more credible than a fake memory dump.

## Evidence bundle

`snapshot` produces a directory with:

```
evidence/<incident>/<host>/<timestamp>/
  meta.json          { host, capturedAt, adapter, command, sha256 }
  logs.txt
  processes.txt
  connections.txt
  hashes.txt
```

The hash of `meta.json` is the chain-of-custody anchor. `Preserve` locks the host while the bundle is
being written; the lock is visible in `CustodyState.locks` and in the trace.

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
3. **Hand off to baro.** Write a goal file, then:

   ```bash
   baro --headless --detach --goal-file outbox/<incident>/goal.txt
   baro watch <run-id>
   ```

   The goal file must name the file, the failing test, and the acceptance criterion. baro's own
   README is explicit that narrow goals work and vague ones do not.
4. **Verify.** `npm test` + re-scan. The PR is evidence; the merge is the human's call.

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
