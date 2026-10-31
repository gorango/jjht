---
id: C04
title: "Authority precedence"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Authority precedence

## Question

Is **evidence always above containment**, and is the precedence configurable?

The current algorithm applies, in order:

1. evidence → `defer`
2. taint / provenance → `reject`
3. capability / compensation → `reject`
4. protected CIDR → `reject`
5. blast → narrow or `reject`
6. joint budget → `defer`
7. otherwise → accept

Decide:

- Is that order correct for all ten scenarios, or does any pair need to invert by policy? In
  particular: evidence vs taint (a tainted intent that would destroy evidence), and evidence vs
  capability (an unauthorized action on a locked host).
- Is precedence a constant or a small policy object? If configurable, what is the default and what
  must the trace record when a higher rule *masks* a lower one?
- Does a `defer` on evidence block the target for all actions, or only destructive ones?
- What happens when two high-precedence rules disagree: first-match, all-findings, or a combined
  verdict? The current code returns all findings but one decision; confirm that is the contract.
- Is "evidence outranks containment" a claim the ablation can measure? If so, how?

## Why this is a decision, not a build

Precedence is the thesis in code. It changes the headline demo row (isolate deferred vs accepted),
the ablation's harm count, and what the README is allowed to claim. A configurable policy is a
different product from a fixed one.

## Inputs

- `03-airlock.md` §"Algorithm" and §"Votes".
- `src/domain/invariants.ts`, `src/agents/airlock.ts`, `tests/airlock.test.ts`.
- `05-scenarios.md` scenario 1 and 3.

## Resolution

**Resolved 2026-10-30 (delegated).** Precedence is a fixed constant, not a policy object:
**evidence → taint/provenance → capability/compensation → protected CIDR → blast → joint budget →
accept.**

- Evidence defers **only destructive** actions on a locked target; `snapshot` and other
  non-destructive actions still run. The current `checkIntent` already implements this.
- A tainted destructive intent on a locked target is **deferred**, not rejected, because evidence is
  the higher rule. Its taint finding and vote are still recorded; on the retry after the lock expires
  it is rejected for taint. The lock masks the decision kind, not the finding.
- The decision kind is the highest-precedence failed rule; `reason` names that rule; `votes` carry
  every veto; `AirlockResult.findings` carries every finding keyed by `intentId`. No `masked` field
  is added — the viewer joins findings to the decision.
- Protected CIDR is checked before blast, so a protected range is rejected, never narrowed.
- Blast narrowing re-runs **all** invariants on the narrowed intent; if any fail, the original is
  rejected. A narrow that still exceeds the budget is rejected, not deferred.
- Joint budget is last and **defers** (not rejects): a later window may free budget.
- No configuration switch. A configurable precedence would let an operator weaken evidence-first,
  which is the thesis, not a setting. The ablation may compare precedence variants, but the shipping
  arm is fixed.
