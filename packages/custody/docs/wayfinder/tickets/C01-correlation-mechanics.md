---
id: C01
title: "Correlation mechanics in Mozaik v4.1.0"
type: research
status: closed
parent: CUSTODY-MAP
blocked_by: []
assignee: Goran
labels: [wayfinder:ticket, wayfinder:research]
---

# Correlation mechanics in Mozaik v4.1.0

## Question

What can the **public** `@mozaik-ai/core@4.1.0` API actually do to let one agent's interception
observe, and be changed by, another agent's pending intent — without patching the submodule?

Answer these precisely, with file/line references from the installed build and from a local
experiment:

1. Does `InterceptionHandler.handle` receive a stable loop/agent identity beyond the transition? What
   is available on `ExecutableTransition` (`input.inferenceInput`, `call`, loop id, producer id)?
2. Can `handle` await an external promise that a *different* loop's handler resolves? If yes, what is
   the smallest working example with two agents?
3. Is holding a `function_call` transition for ~1.5 s safe? What happens to the provider stream, the
   loop lifecycle events, and the tool execution while it is held?
4. Can a held transition be **rewritten** by a peer (narrowed args, replaced with a no-op) and then
   returned? What does `FunctionCallItem.rehydrate` preserve and drop?
5. What do `pause` / `stop` in the `InterceptionOutput` union actually expose, and are they reachable
   through `runLoop`'s public signature? If not, say so explicitly.
6. What happens on timeout, throw, or a second interception while the first is held? Is there a
   lock, a queue, or undefined behaviour?

## Why this is research, not a build

The design in `03-airlock.md` depends on a fact about the runtime: whether a transition can be held
while peers propose. That fact is checkable now, offline, in the vendored submodule. Choosing the
mechanism (window + pending set, dedicated Airlock participant, or deterministic ordering) is a
separate decision (`Live correlation mechanism`).

## Evidence needed

- Exact lines from `modules/mozaik/dist/index.d.ts` and, where available, `modules/mozaik/src`.
- A minimal script or test under `/tmp` (not committed) with two `runLoop` calls and one shared
  pending map, showing either interleaving or the specific failure.
- A short verdict per question: **supported / supported with caveat / not supported**.
- Any behaviour that only works because of a local build artifact, called out for the README.

## Do not decide

Do not choose the correlation mechanism, the window length, or the defer semantics. That belongs to
`Live correlation mechanism`. Do not patch Mozaik; a patch changes what judges can run.

## Resolution

**Resolved 2026-10-30.** Findings: [c01-correlation-mechanics.md](../../research/c01-correlation-mechanics.md).

The public v4.1.0 API does permit the mechanism the airlock needs, with four constraints:

- **Peer await works.** `handle()` is awaited by `AgentLoop.run`, and a handler can hold its
  `function_call` transition on a promise resolved by a different loop's handler. The experiment
  held agent A for ~1.5 s while agent B registered, rewrote A's held transition, and released it;
  A's tool then ran with B's narrowed args. Only that loop suspends — the provider call has already
  completed, and other loops continue.
- **No identity on the transition.** `ExecutableTransition` is only `{ nextStateId, input }`; there
  is no agent id, loop id, or producer id. The handler must close over the agent identity (or encode
  it in the `ModelContext`). A single handler instance shared by two loops cannot disambiguate from
  the transition alone.
- **No runtime safety net.** There is no timeout, lock, queue, or cancellation. A throw becomes an
  unhandled rejection and kills that loop silently; a never-resolving promise parks it indefinitely.
  Same-loop interceptions serialise; cross-loop interceptions overlap.
- **`pause`/`stop` are unreachable.** `InterceptionOutput` is not accepted by `handle`, not read by
  `AgentLoop.run`, not exported from the package root, and has no `interception` state or transition
  rule. A supported design must not use them without patching Mozaik.
- **Quiescence is event-only.** `runLoop` returns `void`; there is no `loop.completed`. The last
  success event is `model.answer` (carrying `producerId` and `loopId`); a throw or hang leaves
  `interception.started` as the last event. A listener must be attached before `runLoop` because the
  first events fire synchronously.

Experiment: `/tmp/opencode/c01/main.ts` (`cd /tmp/opencode/c01 && bun main.ts`), no key or network,
using a fake `InferenceRunner` injected through `initializeRuntime({ inferenceRunnerConfig })`.

This is a fact sheet, not a mechanism choice. *Live correlation mechanism* decides what the airlock
does with these facts.
