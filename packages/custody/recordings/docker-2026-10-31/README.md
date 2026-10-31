# Docker recording, 2026-10-31

One real run of the money scenario through the Docker adapter. The runtime, the airlock, the
scenarios, and the trace are the ones the simulated adapter uses. Only the adapter changed.

## What produced this

- Docker 29.8.2 and Docker Compose 5.5.1 on Linux.
- `nginx:1.27-alpine` for the `edge` and `app` services.
- `curlimages/curl:8.10.0` for the one-shot probe from `203.0.113.9`.
- The Compose stack starts with three `app` replicas. The scenario's `scale` intent asks for six,
  and the adapter runs `docker compose up -d --scale app=6 app`.

## Reproduce it

Run these commands from `packages/custody`.

```sh
docker compose -f docker/compose.yaml down -v
docker compose -f docker/compose.yaml up -d --scale app=3
curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:8080/checkout
CUSTODY_WINDOW_MS=1500 \
CUSTODY_TRACE=recordings/docker-2026-10-31/trace.jsonl \
CUSTODY_EVIDENCE_DIR=recordings/docker-2026-10-31/evidence \
bun src/index.ts --adapter docker
```

The `curl` prints `200` before any block. The CLI exits `0`, prints `adapter: docker`, and names
the evidence bundle it wrote. This recording used window `1500`, so the live wall-clock run takes a
few seconds while the Docker actions execute.

To check the bundle, use the recorded path:

```sh
bun scripts/verify-evidence.ts recordings/docker-2026-10-31/evidence/inc-1/host-7/2026-10-31T09-39-03-075Z
cd recordings/docker-2026-10-31/evidence/inc-1/host-7/2026-10-31T09-39-03-075Z
sha256sum -c hashes.txt
sha256sum hashes.txt
cat anchor.sha256
cd -
```

The verifier prints `OK <path>` and exits `0`. The `sha256sum` output and the anchor matching
`hashes.txt` are in `sha256sum-check.txt`.

To run the contract test:

```sh
CUSTODY_DOCKER=1 bun test tests/docker-contract.test.ts
```

To clean up after the capture:

```sh
: > docker/edge/include/deny.conf
docker compose -f docker/compose.yaml exec -T edge nginx -s reload
docker compose -f docker/compose.yaml down -v
```

The adapter appends `deny 203.0.113.9/32;` to `docker/edge/include/deny.conf` during the run. The
recording copied that file while the block was active to `edge-include.during-block.conf`. The
committed include is empty again, and the stack is removed.

## What the run did

The output in `run.stdout.txt` says `expected outcomes: 5/5 match`, `INFLIGHT 5 (>= 2 required)`,
`effects executed: 3`, and `adapter: docker`. The exit code in `run.exit.txt` is `0`.

| Intent | Decision | Docker effect |
| --- | --- | --- |
| `i-snapshot` | ACCEPT | Captured and hashed the `app` container into the bundle. |
| `i-block` | REWRITE to `203.0.113.9/32` | Appended `deny 203.0.113.9/32;`, ran `nginx -t`, reloaded, probed from `203.0.113.9`, required `403`. |
| `i-isolate` | DEFER | None. The evidence lock outranks containment. |
| `i-injected` | REJECT | None. Tainted rationale needs a second key. |
| `i-scale` | ACCEPT | `docker compose up -d --scale app=6 app`; the stack went from 3 to 6 running replicas. |

There were no failed actions. The trace has one `adapter.probe` event with status `403`, one
`adapter.scaled` event, and one `evidence.anchored` event.

## The 403

`probe-403.txt` records the exact command and result:

```text
docker run --rm --network custody-docker_custody --ip 203.0.113.9 curlimages/curl:8.10.0 -sS -o /dev/null -w '%{http_code}' http://edge/checkout
403
```

The edge sits on the same `203.0.113.0/24` network. nginx applies `deny` to the client address, so
the edge-to-app hop is unaffected. `probe-host-during-block.txt` shows the host-side
`127.0.0.1:8080/checkout` call still returned `200` while the probe address was denied.

## Evidence bundle

```text
evidence/inc-1/host-7/2026-10-31T09-39-03-075Z/
  meta.json               canonical JSON: host, incident, timestamps, lock, per-artifact sha256
  logs.txt                docker logs --timestamps
  processes.txt           docker top -eo pid,ppid,user,stat,lstart,args
  connections.txt         /proc/net/tcp and /proc/net/tcp6 from inside the app container
  inspect.redacted.json   selected docker inspect fields, every env value redacted
  hashes.txt              sorted "<sha256>  <file>" for the five capture files
  anchor.sha256           sha256 of hashes.txt
```

`hashes.txt` does not list itself or `anchor.sha256`. `meta.json` records `lockId`,
`lockHolder: preserve-1`, and `lockUntil`, so a reviewer can line the capture up with the
`evidence.locked` event in the trace. The bundle alone does not prove the lock was respected. The
trace does.

The `evidence.anchored` event in the trace stores the absolute bundle path from the recording
machine. The anchor value is the same as `anchor.sha256`, and the bundle is committed at the relative
path above, so the verifier works from a clean clone.

## What this proves, and what it does not

This proves one real ingress `403` at a local nginx edge, one real `docker compose` scale action,
and one capture path whose hashes recompute. It also shows the same runtime code and the same
scenario ran with a different adapter.

It does not prove destination-based egress filtering. nginx `deny` matches the client address at the
edge; C02 showed that the edge can still connect out to the same CIDR. The honest label is
"ingress 403 at the local edge", never "real egress block".

It does not capture memory, packets, disk, or a rootfs. The hashes prove integrity after capture.
They do not prove identity, reproducibility, or the absence of tampering before capture.
`logs.txt` and `connections.txt` change between captures; `meta.json`,
`inspect.redacted.json`, and `processes.txt` were stable over the short capture window.

`isolate` and `release` are implemented as `docker pause` and `docker unpause`. The money scenario
deferred the isolate intent, so this recording did not exercise them; the contract test does.
`drain_node` and `revoke_token` fail closed with `not_supported`; the contract test asserts that
failed actions are not counted as executed.

## Contract evidence

`contract-test.txt` is the run of `tests/docker-contract.test.ts` with `CUSTODY_DOCKER=1`. It runs
the same action sequence against `SimAdapter` and `DockerAdapter`: lock, block, snapshot, isolate,
release, scale, and unblock. The Docker side asserted `403` during the block, a paused and then
unpaused app container, `200` after the unblock, two running app replicas after scaling to two, and
byte-for-byte restoration of the edge include. It also ran `bun scripts/verify-evidence.ts` against
the bundle and asserted `OK`. The test project is `custody-contract`, on `203.0.114.0/24` and
`127.0.0.1:18080`, so it does not collide with the demo stack. It removed its containers, volumes,
and network after the run.
