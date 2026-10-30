---
id: C11
title: "Adapter scope: Docker only or also a K8s stub"
type: grilling
status: closed
parent: CUSTODY-MAP
blocked_by: [C02]
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Adapter scope: Docker only or also a K8s stub

## Question

Is the slice Docker-only, or does it also ship a Kubernetes stub to show the interface generalises?

Decide **scope, not capability**:

- What does a second adapter prove that the `InfraAdapter` interface plus one Docker run does not?
- What would the stub actually implement: `observe`, `execute`, `compensate`, `blastRadius`,
  `describe` — or only type-level conformance? A stub that throws is honest; a stub that pretends
  to act is not.
- What is the cost in the remaining hours, and what does it displace (trace, viewer, ablation,
  Docker run)?
- Does a stub weaken credibility ("they wrote an interface and a fake") or strengthen it ("swap the
  adapter, keep the runtime")?
- What does the README claim: "adapter-agnostic" or "two adapters"? The first is an interface
  claim; the second is a tested claim.
- If Docker is unavailable on the judge's machine, does the stub become the fallback path, or does
  the sim adapter?

## Why this is a decision, not a build

The architecture's claim is "swap the adapter, keep the runtime". One real adapter plus a clean
interface may be enough; a second adapter may buy generality at the cost of the ablation. The
answer also fixes what "on top of existing infrastructure" means for the README.

## Inputs

- `06-infrastructure-and-repo-handoff.md` §"The twin is the fixture, the adapter is the product".
- `Docker adapter reversibility and evidence capture` for what Docker can actually do.
- `02-action-model.md` §"The adapter interface".
- Out of scope: real Kubernetes/cloud **deployment**.

## Resolution

**Resolved 2026-10-30 (delegated).** **Docker only.** No Kubernetes stub in the slice.

- The `InfraAdapter` seam is proven by **two real implementations**: `SimAdapter` (deterministic
  digital twin, the default and the ablation adapter) and `DockerAdapter` (local Compose, one
  recorded run). A type-only K8s stub would add no tested capability and would cost time better spent
  on the ablation.
- Generality is proven by a **contract test**: the same action sequence runs against both adapters
  and asserts the same observable effect (403, paused container, upstream removal, bundle hashes).
  That is stronger than a stub.
- The README claim is: "two adapters behind one interface; swap the adapter, keep the runtime." It
  does **not** claim Kubernetes readiness.
- A K8s adapter is ruled out of scope (see the map's Out of scope), not deferred as fog: real
  deployment was already out, and a stub is not worth the remaining hours.
