---
id: C07
title: "Second key mechanics"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Second key mechanics

## Question

Is a human participant holding a lease enough for the second key, or does the demo need a typed
confirmation, or both?

Decide:

- **Who** can issue a second key: the Human participant only, or also an independent agent? The
  thesis says a tainted rationale can support an action only with a second key; an agent-held key is
  a weaker claim.
- **What** it authorizes: a specific intent id, a class (tainted rationale / destructive without
  undo), or a target? Can one key cover a batch?
- **When** it expires, and whether it can be pre-authorized before the incident (a standing policy)
  or must be live (a held lease with a visible wait).
- **How** it is represented: `CustodianState.secondKey` set of intent ids, an open lease, a typed
  phrase, or a signed token. What does the trace show while the human is deciding?
- **What happens** on refusal or timeout: reject, defer, or fall back to a narrower action.
- **Demo beat:** is the human's confirmation the 2:00 moment, or does it slow the run and hurt the
  "fire-and-forget concurrency" impression?

## Why this is a decision, not a build

It determines the human participant's role, the airlock's taint path, the ablation's treatment of
tainted intents, and a visible demo moment. "Lease" and "typed confirmation" are different products:
one is coordination, the other is ceremony. The demo must not look like a fake approval dialog.

## Inputs

- `03-airlock.md` §"Open questions" 3.
- `02-action-model.md` §"Taint" and the destructive-without-undo rule.
- `01-architecture.md` §"Participants" (Human has `*`).
- `08-plan-risks-and-decisions.md` open decision 3.

## Resolution

**Resolved 2026-10-30 (delegated).** **Both**: a typed confirmation is the human gesture; the lease
is the state it grants.

- The Human participant holds `*` (wildcard capability) but the second key is an **approval**, not a
  capability. It authorizes one `intentId`, one action, one target; it is not transferable or
  batchable in the slice.
- The CLI asks the operator to type `APPROVE <intentId> <action> <target>` (or a short confirmation
  phrase in the viewer). On success the intent id enters `CustodianState.secondKey` with
  `expiresAt = now + 30_000`; the airlock re-evaluates at the window deadline.
- A key may be granted before the window or while the window is open. If the window closes without a
  key, the intent is **rejected** with `second_key_denied` (not deferred): the operator declined.
- Tainted rationales and destructive-without-undo actions require the key; everything else does not.
  A tainted intent with a valid key is allowed (the existing invariant).
- The trace records `second_key.requested`, `second_key.granted`, `second_key.expired`,
  `second_key.denied`; the viewer shows the human lane and the wait as a held lease.
- The ablation uses a deterministic Human policy (`auto-grant` for the scenario's
  `secondKeyIntentIds`, `deny` otherwise). The live demo uses the typed phrase for one intent —
  `revoke_token` in the money scenario is the natural beat. No pre-authorized standing policy in the
  slice; that is a fog item.
- Refusal/timeout: reject, never silently fall back to a narrower action. A narrower action would
  need its own decision.
