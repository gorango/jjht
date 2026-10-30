# C02 — Docker adapter reversibility and evidence capture

Research finding for ticket `C02`. Everything below was observed locally on a throwaway Compose
stack; it is not a design for the Docker adapter and does not decide adapter scope or the evidence
format. Where an experiment was not run, the text says so.

- **Date:** 2026-10-30
- **Host:** Linux, Docker Engine 29.8.2, Compose 5.5.1, cgroup v2, overlay2
- **Images:** `nginx:1.27-alpine` (nginx 1.27.5), `redis:8.2.2`, `python:3.12-alpine`,
  `alpine:latest`
- **Access:** uid 1000 with access to the Docker socket. No host root, no `sudo`, no `nsenter`.
- **Scratch artifacts (not committed):** `/tmp/opencode/c02`
  - `stack/` — full test harness (edge, app, app2, redis, slow)
  - `minimal/` — smallest viable stack (edge + app)
  - `snapshot.sh` — capture script
  - `evidence/` — three snapshot bundles (`snapA`, `snapB`, `snapC`)
  - `transcript_block_undo.txt` — block/unblock transcript

## Bottom line

1. `block_egress` as implemented by nginx `deny <cidr>` is an **ingress** filter. It returns a real
   403 to matching clients, but it does **not** stop the edge from connecting out to that CIDR. A
   destination-based egress block was not implemented or verified.
2. Every registry action except `revoke_token` has a real, observable compensation on this stack.
   `revoke_token` has none: rotation is recreate + reissue, and the old container is destroyed.
3. “Reversible” is not “no impact”. Reload closes idle keep-alive connections, `pause` freezes
   in-flight requests and health checks, `stop` kills connection state, and scale-down deletes
   containers. The undo restores the *configuration*, not the traffic that was already dropped.
4. The bundle hashes prove **integrity after capture**. They do not prove **identity** (the same
   state captured twice hashes differently because logs and connection tables move) and do not
   prove **pre-capture integrity**.
5. The smallest stack that shows a real 403 and a real container action is **two containers**:
   nginx edge + nginx app. Redis is not required for any verified action.

## Per-action findings

Commands assume the full harness in `/tmp/opencode/c02/stack` (project `c02stack`, edge published
on `127.0.0.1:18080`, app network `172.28.0.0/24`). The minimal variant behaves the same with one
upstream.

| Action | Exact command(s) | Precondition | Observed result | Reversibility verdict | Residual state after undo |
| --- | --- | --- | --- | --- | --- |
| `block_egress(edge, cidr)` | `printf 'deny <cidr>;\n' > edge/conf.d/egress.conf`; `docker exec c02stack-edge-1 nginx -t`; `docker exec c02stack-edge-1 nginx -s reload` | Edge nginx runs with `include /etc/nginx/conf.d/egress.conf;` at `http` level; config directory bind-mounted writable. | Matching client gets `403 Forbidden`; a different client still gets `200`; an in-flight 4 s request completed `200` after the reload; idle keep-alive connections were closed (`EOF`) on reload 3/3 trials; reload command 56–76 ms, effect on a new connection 64–190 ms. | **Reversible, automated compensation feasible** if the adapter owns/tracks the exact line. Remove the line, `nginx -t`, reload. | Empty `egress.conf`; new connections `200`. Access log keeps the 403s. No config diff. Old worker generation gone. |
| `unblock_egress` | `: > edge/conf.d/egress.conf`; `nginx -t`; `nginx -s reload` | Same as above. | New connection `200`; transcript below. | Compensation only. | None beyond the log entries of the blocked period. |
| `isolate(host)` — pause | `docker pause <container>`; undo `docker unpause <container>` | Container running, no evidence lock (not implemented). | State `paused`, health immediately `unhealthy`; requests hang (curl timed out at 4 s, code `000`); after 9 s still `paused/unhealthy`; after unpause health returned `healthy` within about 2–7 s and traffic returned `200`. A 4 s in-flight request through a paused service completed `200` after a 6 s pause (`time=7.07 s`), i.e. the TCP connection survived. | **Reversible while the container exists**; pause preserves memory and connections. | Running, healthy; no config change. In-flight requests were delayed, not dropped. |
| `isolate(host)` — stop | `docker stop <container>`; undo `docker start <container>` | Same. | `exited`, health `unhealthy`; edge returned `502`; `docker start` + 3 s → `running/healthy`, `200`. A mid-request `docker stop --time=1` produced `502` after 2.10 s (stop itself took 1.56 s). | **Service-level reversible; state is not.** Memory, sockets and in-flight requests are destroyed. | Running, but restart count incremented and prior in-container state is gone. |
| `release` | `docker unpause <c>` or `docker start <c>` | A paused or stopped container. | `200` after recovery; health lag observed. | Compensation only. | None. |
| `drain_node` | Remove `server app2:8080;` from the edge `upstream` block; `nginx -t`; `nginx -s reload`. Re-add the line and reload to undo. | At least two upstreams for a zero-downtime result; target container stays running. | Before: responses alternated between `app` and `app2`. After: 4/4 responses from `app`; `app2` still `Up`, its `/health` returned `ok`, `docker exec` and logs still worked. After re-add: alternation resumed. | **Reversible.** The container is not touched. | None; upstream list restored. In-flight requests to the removed upstream were not tested. With a single upstream this is a full outage, not a drain. |
| `scale(service, n)` | `docker compose up -d --scale app=3`; undo `docker compose up -d --scale app=1` | Service has no published host port. | 1 → 3 created `app-1..app-3`, all healthy when queried directly; names unique. Edge kept routing only to the pre-existing `app-1` and `app2` — the two new replicas received **no traffic** because the nginx `upstream` is static. 3 → 1 removed `app-2`/`app-3` cleanly; no errors, no port collision, service still `200`. Scaling the published-port service (`--scale edge=2`) failed with `Bind for 0.0.0.0:18080 failed: port is already allocated` and left a `Created` `c02stack-edge-2` container, which was removed manually; the original edge stayed up. | **Container count reversible; data-plane integration is not automatic.** Needs edge config regeneration (or dynamic discovery) to use new replicas. | No extra containers after scale-down; edge unchanged. |
| `snapshot(host)` | See bundle schema below: `docker logs --timestamps`, `docker top -eo …`, `docker exec <c> netstat -tnp` + `/proc/net/tcp[6]`, `docker inspect` (env redacted), then SHA-256 the files. | Container running (works while paused for logs/top; `exec` fails while paused). | Static artifacts (`logs`, `processes`, `inspect`) were byte-identical across two captures 2 s apart; `connections.txt` differed (TIME_WAIT/ephemeral ports); after 6 s more, `logs.txt` also differed (227 → 233 lines, health-check access log entries). The hash chain verified (`sha256sum -c` all OK). | **No service change.** Delete the directory to undo; deleting evidence is not a technical undo of the capture. | Bundle directory remains unless deleted; no effect on the container. |
| `revoke_token(service)` | Edit the service env (`API_KEY`), then `docker compose up -d --force-recreate app`. | Env is the only credential store; no external secret manager. | Old container `a30e77c9…` disappeared (`docker inspect` failed); new container `48b36cd5…` served `key-v2-cccc`; old value was no longer in any running container. Old container logs were gone with the container. | **No undo.** Rolling the env back and recreating re-issues the old secret; it does not un-revoke it. | New container, new key, old container and its logs destroyed. Deliberately manual and irreversible. |

### Pause vs stop (isolate)

| | `docker pause` | `docker stop` |
| --- | --- | --- |
| Process | Frozen (SIGSTOP-like), memory retained | SIGTERM, then SIGKILL after grace period |
| In-flight connection | Survives; request completes after unpause | Reset/killed; edge returns 502 |
| Health check | Immediately reported `unhealthy` while paused | `exited`, health `unhealthy` |
| Undo | `docker unpause`, fast, state intact | `docker start`, new process namespace, state lost |
| Container observability while down | `docker logs`, `docker top` work; `docker exec` fails | `docker logs`/`docker top` work; `docker exec` fails |
| Health recovery after undo | ~2–7 s (next successful check) | ~3 s in this test |

A nuance observed with the Python `slow` service: a 2 s pause during its 4 s `time.sleep` did not
add 2 s to wall time (4.00 s total) because the timer deadline elapsed while frozen. With a 6 s
pause the request completed at 7.07 s. The connection was preserved in both cases; the process
timer semantics differ from the TCP semantics.

## Smallest viable stack

**Two containers: nginx edge + nginx app.** No redis, no second app, no probe container. Both a real
`403` and a real `pause`/timeout were reproduced on this stack (project `c02min`, port `18081`).

`/tmp/opencode/c02/minimal/compose.yaml`:

```yaml
name: c02min
services:
  edge:
    image: nginx:1.27-alpine
    ports: ["18081:80"]
    volumes:
      - ./edge/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./edge/conf.d:/etc/nginx/conf.d:rw
    depends_on: [app]
  app:
    image: nginx:1.27-alpine
    environment:
      API_KEY: "minimal-key"
    volumes:
      - ./app/template.conf:/etc/nginx/templates/default.conf.template:ro
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/health"]
      interval: 2s
      timeout: 1s
      retries: 3
networks:
  default:
    ipam:
      config: [{subnet: 172.29.0.0/24}]
```

`edge/nginx.conf`:

```nginx
worker_processes 1;
events { worker_connections 64; }
http {
  access_log /dev/stdout;
  error_log /dev/stderr warn;
  include /etc/nginx/conf.d/egress.conf;
  upstream backend { server app:8080; }
  server {
    listen 80;
    location / { proxy_pass http://backend; }
  }
}
```

`app/template.conf` (the official nginx entrypoint envsubsts `$API_KEY`; `$hostname` is left alone
because it is not an environment variable):

```nginx
server {
  listen 8080;
  location = /health { return 200 "ok\n"; }
  location / { return 200 "app host=$hostname key=$API_KEY\n"; }
}
```

`edge/conf.d/egress.conf` starts empty. Observed on this stack:

```
baseline: app host=c6d8b25f8a41 key=minimal-key code=200
denied (deny 172.29.0.1/32): code=403
undo:     app host=c6d8b25f8a41 key=minimal-key code=200
paused:   curl: (28) Operation timed out ... code=000
released: code=200
```

The full harness added `app2` only for drain, `slow` only to have a request longer than a reload,
`redis` for the ticket's nominal stack, and a probe container to test a non-host client CIDR. None of
those are needed for the two core demonstrations.

## What `deny <cidr>` actually blocks

This is the most important honesty correction to the mapping in
`06-infrastructure-and-repo-handoff.md`.

- With `deny 172.28.0.51/32;` installed, client `172.28.0.51` requesting the edge got
  `HTTPError 403`.
- In the same state, the edge itself successfully fetched `http://172.28.0.51:8081/` and received
  the server's HTML. The `deny` did not affect nginx's outbound connection to the same CIDR.
- The edge image has no `iptables`, no `nft`, and the default Docker capability set does not include
  `NET_ADMIN` (`CapEff 00000000a80425fb`).

So the verified capability is **“deny requests from this client CIDR at the edge”** (ingress), or
equivalently “block traffic *sourced from* this CIDR”. A true destination-based egress block would
need a different mechanism (host/container packet filter with `NET_ADMIN`, an allowlist proxy, or
Kubernetes NetworkPolicy) and was **not tested**. The adapter should either name the action
accordingly or the registry mapping should be treated as an ingress approximation, not an egress
guarantee.

## Evidence bundle schema and hash chain

The capture script is `/tmp/opencode/c02/snapshot.sh`. Bundle layout:

```text
evidence/<incident>/<host>/<UTC timestamp>/
  meta.json               # canonical JSON, includes per-artifact SHA-256
  logs.txt                # docker logs --timestamps
  processes.txt           # docker top -eo pid,ppid,user,stat,lstart,args
  connections.txt         # docker exec netstat -tnp + /proc/net/tcp + /proc/net/tcp6
  inspect.redacted.json   # selected docker inspect fields, env values redacted
  hashes.txt              # sorted "<sha256>  <filename>" for every file incl. meta.json
  anchor.sha256           # sha256 of hashes.txt (record this outside the bundle)
```

Actual `meta.json` from `snapA` (canonical: sorted keys, compact separators, UTF-8, trailing
newline):

```json
{"adapter":"docker","artifacts":{"connections.txt":"4be5a91c…","inspect.redacted.json":"2608166c…","logs.txt":"31d45eb3…","processes.txt":"533ade54…"},"capturedAt":"20261030T143217Z","commands":["docker logs --timestamps","docker top -eo pid,ppid,user,stat,lstart,args","docker exec netstat -tnp; cat /proc/net/tcp","docker inspect (env redacted)"],"host":"c02stack-app-1","incident":"snapA"}
```

Actual `hashes.txt` shape:

```text
<sha256>  connections.txt
<sha256>  inspect.redacted.json
<sha256>  logs.txt
<sha256>  meta.json
<sha256>  processes.txt
```

Chain, in order:

1. Capture each artifact to a file.
2. Compute `sha256(raw bytes)` for each artifact; put the map in `meta.json`.
3. Canonicalise `meta.json` (sorted keys, no insignificant whitespace, UTF-8, trailing newline) and
   write it.
4. Compute SHA-256 of `meta.json` and of every artifact; write `hashes.txt` with lines sorted by
   filename.
5. Compute `sha256(hashes.txt)` and record it in `anchor.sha256` **and** out-of-band (airlock
   trace / append-only log). `anchor.sha256` inside the directory is for convenience only; an
   attacker who rewrites the bundle can rewrite it too.

Verification:

```bash
cd <bundle>
sha256sum -c hashes.txt            # all files OK
sha256sum hashes.txt              # compare to anchor.sha256 and the trace entry
```

In the experiment, `sha256sum -c hashes.txt` returned OK for `connections.txt`,
`inspect.redacted.json`, `logs.txt`, `meta.json`, and `processes.txt`; recomputing
`sha256(hashes.txt)` reproduced `38bc3ee3…` for `snapA`.

Doc 06 says “the hash of `meta.json` is the chain-of-custody anchor”. Operationally that is one
link, not the root: `meta.json` cannot contain its own hash without circularity. The root that
covers the whole directory is `sha256(hashes.txt)`, and it only becomes tamper-evident if copied
outside the directory. This finding does not choose which one the product should display.

### Stability: hashes are integrity, not identity

Three captures of the same running app container:

| Artifact | A vs B (2 s apart) | A vs C (13 s apart) | Why |
| --- | --- | --- | --- |
| `logs.txt` | SAME | **DIFF** (227 → 233 lines) | health-check requests write access-log lines to stdout every 2 s |
| `processes.txt` | SAME | SAME | PIDs and start times did not change |
| `connections.txt` | **DIFF** | **DIFF** | ephemeral ports and `TIME_WAIT` entries |
| `inspect.redacted.json` | SAME | SAME | state did not change |
| `meta.json` | **DIFF** | **DIFF** | `capturedAt` and the `connections.txt` hash |
| `hashes.txt` / anchor | **DIFF** | **DIFF** | inherits the above |
| static subset (exclude `connections.txt`, exclude `capturedAt`) | SAME (`22dd6fa6…`) | **DIFF** (`2cdf4783…`) | logs kept growing |

Conclusions:

- Given byte-identical inputs, the chain is deterministic: A and B's static subset hash matched
  exactly.
- A live container does not have a stable bundle hash. Logs move, connection tables move, and a
  timestamp makes `meta.json` unique per capture. A “state hash” would require freezing the
  container, defining a cut, or hashing an explicitly chosen static subset — and then it is a hash
  of that projection, not of the host.
- Canonical JSON is necessary but not sufficient: removing `capturedAt` alone still leaves
  `connections.txt`. Both the timestamp and the volatile artifacts must be handled deliberately.
- File capture is sequential, not atomic. There is no consistent cut across logs, processes and
  connections; a request can land between two reads.

### What the bundle cannot prove

- **No memory dump.** No process memory, heap, JIT state, or deleted-file contents.
- **No packet capture.** No pcap, no payloads, no retransmission history. Adding `tcpdump` would be
  a separate, explicit capability.
- **No disk/rootfs image.** No `docker export`/`docker diff`; no files written inside the container
  are preserved unless they appear in logs.
- **No kernel/eBPF/audit state.** No syscall trace, no host audit log, no daemon events.
- **No pre-capture tamper evidence.** Anyone with root in the container or on the host can rewrite
  logs before capture. The chain starts at capture time. Container logs are also attacker-influenced
  text and must stay `tainted`.
- **No trusted time.** `capturedAt` is the host clock; no RFC 3161 timestamp or external witness.
- **No secret values.** Env values are redacted, so the bundle cannot prove which key was live.
  `docker inspect` would expose it; the bundle deliberately does not.
- **No history across destruction.** `docker logs` covers the current container only. Recreate
  (revoke) or `docker rm` destroys them. The old container's logs were unrecoverable in the
  rotation experiment.
- **No container-to-container visibility from host `ss` alone.** The host `ss` showed the published
  listener and host-originated sockets, but not the edge→app socket inside the bridge network.
  Container `netstat` showed it. Host root `nsenter` would be needed for a host-side view; no
  `sudo`/root was available here.
- **No atomicity or authenticity.** Hash chain proves the files have not changed since the chain was
  written; it does not prove they are complete or that the recorder was honest.

## Host-level vs in-container access

“Host-level” here means access to the Docker daemon (usually root-equivalent through the socket),
not necessarily a root shell on the host.

| Action | What access is required | Notes |
| --- | --- | --- |
| `block_egress` / `unblock_egress` | Write access to the edge config + ability to signal nginx. In this experiment: `docker exec` from the host into the edge. | Could be done from inside the edge container if the config is mounted and the process can reload. The app container cannot do it. Not a host-root operation. |
| `isolate` / `release` | Docker daemon. | A container cannot pause/stop itself; `pause` is a daemon operation. |
| `drain_node` | Edge config + reload, plus Docker API to observe the target. | Target container is untouched. |
| `scale` | Docker daemon / Compose. | Needs the host socket; impossible from inside an ordinary container. |
| `snapshot` | Docker API for `logs`, `top`, `inspect`; `exec` into the target for connections. | Host `ss` alone is insufficient for container-to-container sockets. `docker exec` fails while the container is paused; `logs`/`top` still work. |
| `revoke_token` | Edit env/compose and recreate via Docker API. | In-container env is immutable; the old container is removed. No secret-manager integration. |

## When Docker is unavailable

No Docker-unavailable run was performed; this section is derived from the observed dependencies, not
from a second experiment.

| Action | Simulation fallback | What is lost |
| --- | --- | --- |
| `block_egress` / `unblock_egress` | `SimAdapter` changes topology state and reports the intended block. | No real HTTP 403, no reload, no latency, no proof the edge honours the rule. |
| `isolate` / `release` | Sim state transition; health and traffic are modelled. | No real container freeze, no real connection state, no real health check. |
| `drain_node` | Sim removes a node from routing. | No live container to observe, no real upstream reload. |
| `scale` | Sim changes replica count. | No real containers, no name/port collision behaviour. |
| `snapshot` | Serve a pre-recorded bundle and verify its SHA-256 chain offline. | Cannot capture a live host; a replay is not fresh evidence. Verifying a recorded bundle with `sha256sum` still works with no Docker at all. |
| `revoke_token` | Sim marks the credential revoked. | No recreate, no destroyed old container, no real key rotation. |

What survives on a judge's laptop without Docker: the decision/airlock logic, the compensation
intents, the topology and blast radius, and offline verification of a previously captured bundle.
What does not survive: any claim of a “real action”. The demo must say it is replaying a recorded
Docker run, not performing one. Natively running nginx on the host would be a different adapter and
was not tested.

## What “reversible” means operationally

Three distinct tiers came out of the experiments:

1. **Automated `compensate()` is honest and feasible** for:
   - `block_egress` → remove the exact line, test, reload (`unblock_egress`);
   - `isolate` via `pause` → `unpause`;
   - `drain_node` → re-add the upstream server and reload (`release`);
   - `scale` → restore the recorded prior replica count.

   Feasible only if the adapter recorded the exact prior state: the line it added, the upstream it
   removed, the pause/stop choice, and `from` replicas. The compensation must be idempotent and must
   verify the result (new connection 200, container running/healthy, expected replica count). The
   registry's `compensation` closures already carry enough parameters for block/scale; for drain and
   isolate the adapter must persist the concrete edge/upstream or pause/stop choice.

2. **Documented manual sequence, not automatic:**
   - `isolate` via `stop` → `start` restores service but not state;
   - `scale` beyond a static upstream → the edge config must be regenerated before new replicas
     carry traffic;
   - `revoke_token` → reissue and redeploy a **new** key (rolling back the env is re-issuing the old
     secret, which is not un-revoking it).

3. **Neither:** un-revoking a leaked secret, recovering traffic already dropped, un-sending a 403
   that was logged, restoring idle connections closed by a reload, or proving the pre-capture state
   was untampered.

So the registry's `Undo` column is accurate as a statement about *intent availability*, not about
zero impact. `revoke_token` with no undo matches reality; the others map to real commands, with the
caveats above.

## Transcript: `block_egress` and its undo

Full output saved at `/tmp/opencode/c02/transcript_block_undo.txt`. The in-flight request is a 4 s
`/slow` endpoint proxied by the edge; the denied CIDR is the host's address as seen by the bridge
(`172.28.0.1/32`).

```text
$ date -u
Fri Oct 30 02:33:40 PM UTC 2026
$ cat edge/conf.d/egress.conf
(empty)
$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/
200
# start an in-flight 4s request through the edge, then block the client CIDR
$ printf 'deny 172.28.0.1/32;\n' > edge/conf.d/egress.conf
$ cat edge/conf.d/egress.conf
deny 172.28.0.1/32;
$ docker exec c02stack-edge-1 nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
$ docker exec c02stack-edge-1 nginx -s reload
2026/10/30 14:33:41 [notice] 285#285: signal process started
reload_command_ms=56  until_new_conn_403_ms=64  polls=1
slow-ok

in-flight code=200 time=4.002516
$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/  # new connection
403
# undo: remove the line and reload
$ : > edge/conf.d/egress.conf
$ docker exec c02stack-edge-1 nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
2026/10/30 14:33:44 [notice] 298#298: signal process started
undo_reload_ms=72 until_200_ms=80 polls=1
$ curl -sS -w ' code=%{http_code}\n' http://127.0.0.1:18080/
app host=8d4f83f9a159 key=key-v1-bbbb
 code=200
$ cat edge/conf.d/egress.conf
(empty)
```

Repeated reload measurements: 5 cycles toggling a `/32`, reload command 62–76 ms, new-connection
effect 121–184 ms including the `docker exec` and probe overhead.

### Corroborating excerpts

Isolate/pause and release:

```text
$ docker pause c02stack-app-1
$ docker inspect -f '{{.State.Status}} paused={{.State.Paused}} health={{.State.Health.Status}}' c02stack-app-1
paused paused=true health=unhealthy
$ curl -sS --max-time 4 -o /dev/null -w 'code=%{http_code}\n' http://127.0.0.1:18080/
curl: (28) Operation timed out after 4001 milliseconds with 0 bytes received
code=000
$ docker unpause c02stack-app-1; sleep 4
$ docker inspect -f '{{.State.Status}} paused={{.State.Paused}} health={{.State.Health.Status}}' c02stack-app-1
running paused=false health=healthy
$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/
200
```

Stop vs pause with an in-flight request:

```text
# pause for longer than the 4s handler sleep
slow-ok
code=200 time=7.071459
# stop --time=1 mid-request
<html>...<title>502 Bad Gateway</title>...</html>
code=502 time=2.103460
stop_duration_ms=1557
```

Scale:

```text
$ docker compose up -d --scale app=3
 Container c02stack-app-2 Started
 Container c02stack-app-3 Started
# edge responses: only the pre-existing app-1 and app2 hostnames
$ docker compose up -d --scale app=1
 Container c02stack-app-2 Removed
 Container c02stack-app-3 Removed
# scaling the published-port edge:
Error response from daemon: ... Bind for 0.0.0.0:18080 failed: port is already allocated
```

Revoke:

```text
old_id=a30e77c94a99be96ed82e33a15f92a887cfa4663d55ce44f67efe3f70b4a218d
app host=a30e77c94a99 key=key-v1-aaaa
$ docker compose up -d --force-recreate app
 Container c02stack-app-1 Recreated
new_id=48b36cd531b22bb39cdfceb607330786a2fc162e4565a9a5d929a662abc64446
app host=48b36cd531b2 key=key-v2-cccc
$ docker inspect a30e77c9... >/dev/null
old container gone (inspect failed)
```

Snapshot comparison:

```text
logs.txt                 A=31d45eb35913 B=31d45eb35913 SAME
processes.txt            A=533ade54d0c9 B=533ade54d0c9 SAME
connections.txt          A=4be5a91c9701 B=da40d27b55b7 DIFF
inspect.redacted.json    A=2608166cc7f3 B=2608166cc7f3 SAME
meta.json                A=c16590f98ab6 B=640345cd2dae DIFF
hashes.txt               A=38bc3ee3338e B=07e3e7f7536c DIFF
anchor.sha256            A=e72cfffa7b28 B=6ca9d53b9021 DIFF
# 6 s later
logs.txt DIFF  (227 -> 233 lines)
connections.txt DIFF
static-subset hash: A=B=22dd6fa6..., C=2cdf4783...
```

## Experiments that failed, were skipped, or are deliberately narrow

- **`ss -tnp` inside the container:** not possible. `nginx:alpine` has no `ss`; it has BusyBox
  `netstat`. I used `netstat -tnp` plus `/proc/net/tcp` and `/proc/net/tcp6`. The PID column was
  `-`, so the “p” part is weaker than on a full `iproute2` system.
- **Host `ss -tnp` for container connections:** it did not show the edge→app bridge socket; it
  showed only the published listener and host-originated sockets. No root/`nsenter` was available
  (`sudo` requires a password), so the host-side alternative was not tested.
- **`limit_rate 400` to make a slow response:** did not slow the 2,000-byte response (2 ms), reason
  not established. I replaced it with a Python `http.server` that sleeps 4 s; the timeout results
  above come from that service, not from `limit_rate`.
- **`docker stop` with the default grace period** delivered a `200` to the Python service's in-flight
  request because Python is PID 1 and ignores SIGTERM; the container was killed only after the
  10 s grace. With `--time=1` the request got `502` after 2.10 s. This is PID-1 signal behaviour, not
  a contradiction of the pause/stop result; nginx handles SIGTERM and stops promptly.
- **Drain with an in-flight request to the removed upstream:** not tested. Only the no-traffic
  case was measured.
- **Drain with a single replica:** not run separately. It follows that removing the only upstream
  produces a full outage; treat that as an inference, not a measurement.
- **True destination-based egress filtering:** not implemented and not tested. No `iptables`,
  `nft`, or `NET_ADMIN` in the edge container; no host root.
- **Docker-unavailable mode:** not run. The fallback table is derived from the commands each action
  depends on.
- **Evidence lock / `Preserve`:** not implemented in this harness. No host was locked during capture;
  `CustodyState.locks` and the airlock were not exercised.
- **Memory dump, packet capture, rootfs export, signing, trusted timestamp:** not attempted.
- **Kubernetes adapter scope:** not investigated; deliberately out of scope for C02.

## Cleanup

The scratch stacks (`c02stack`, `c02min`), containers, networks and volumes were removed with
`docker compose down -v` after the experiments; the `c02stack_default` bridge network briefly
reported “resource is still in use” after the last container was removed and was deleted with a
final `docker network rm`. A final check found no `c02` containers, networks or volumes. The evidence
bundles and transcripts under `/tmp/opencode/c02` were kept as artifacts. No production system,
privileged/host networking, or published secret was used. Nothing was committed.
