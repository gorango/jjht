---
id: C02
title: "Docker adapter reversibility and evidence capture"
type: research
status: closed
parent: CUSTODIAN-MAP
blocked_by: []
assignee: Goran
labels: [wayfinder:ticket, wayfinder:research]
---

# Docker adapter reversibility and evidence capture

## Question

For each action in the closed registry, what can a local Compose stack (nginx + app + redis) honestly
do, what can be reversed, and what evidence can be captured — offline, without touching production?

Verify at least:

| Action | Claimed mapping | What to verify |
| --- | --- | --- |
| `block_egress(edge, cidr)` | append `deny <cidr>;` to nginx config, reload | reload latency, whether existing connections survive, how to remove the line |
| `isolate(host)` | `docker pause` / `stop` | pause vs stop, connection state, `unpause` safety, health-check behaviour |
| `drain_node` | remove from upstream, keep alive | whether the container stays observable, how to re-add |
| `scale(service, n)` | `compose up --scale` | whether scale-down is clean, port/name collisions |
| `snapshot(host)` | logs + `docker top` + `ss -tnp` + hashes | consistency of the capture, what is missing, whether hashes are stable |
| `revoke_token(service)` | rotate env key | why this is deliberately manual and irreversible |

Also answer:

- What is the **smallest** stack that still shows a real 403 and a real container action?
- What breaks when Docker is unavailable (judge's laptop, CI, offline demo)? What can be shown
  without it?
- Which actions can be observed from inside the stack, and which need host-level access?
- What does "reversible" mean operationally: an automated `compensate()`, a documented manual
  sequence, or neither?

## Why this is research, not a build

The credibility risk is claiming an undo that does not exist. The facts must be established before
the adapter scope and the evidence format are decided. Building the adapter is execution.

## Evidence needed

- A per-action table: exact command(s), precondition, observed result, reversibility verdict,
  residual state after undo.
- The evidence bundle contents and the exact hash chain (what is hashed, in what order).
- A note on what cannot be captured (no memory dump, no packet capture unless explicitly added).
- A local transcript or short recording of one action and its undo, even if the full adapter is not
  built.

## Do not decide

Do not decide adapter scope (Docker-only vs K8s stub) or the evidence format. Those are separate
grilling tickets. Do not claim a capability the experiment did not show.

## Resolution

**Resolved 2026-10-30.** Findings: [c02-docker-reversibility.md](../../research/c02-docker-reversibility.md).

The experiments confirm most of the mapping and correct one important claim:

- **`block_egress` is ingress, not egress.** nginx `deny <cidr>` returns a real 403 to matching
  clients, but the edge can still connect *out* to the same CIDR; a destination-based egress block
  was not implemented and needs a different mechanism (packet filter with `NET_ADMIN`, allowlist
  proxy, or NetworkPolicy). The action must be named honestly or the mapping treated as an ingress
  approximation.
- **Reversible with automated compensation if prior state is recorded:** block/unblock (write/clear
  the line + reload), isolate via pause/release (`unpause`), drain/release (remove/re-add upstream),
  and scale-back. `isolate` via stop is service-level reversible but destroys memory, sockets and
  in-flight requests. `revoke_token` has **no undo**: rotate and recreate, old container destroyed.
- **"Reversible" is not "impact-free".** Reload closes idle keep-alive connections; pause freezes
  in-flight requests and health checks; scale-down deletes containers; a static nginx upstream does
  not route to new `--scale` replicas without config regeneration.
- **Smallest stack: nginx edge + nginx app, two containers.** Redis is not required for any verified
  action. A real 403 and a real pause/timeout were reproduced.
- **Evidence hashes prove integrity after capture, not identity or reproducibility.** `logs.txt` and
  `connections.txt` change between captures; `logs`/`processes`/redacted `inspect` were stable over a
  short interval. The bundle can verify `sha256sum -c`; it cannot prove pre-capture tampering, and it
  captures no memory, packets, or disk.

This is a fact sheet. *Adapter scope* decides what to ship; *Evidence format* decides what to claim.
