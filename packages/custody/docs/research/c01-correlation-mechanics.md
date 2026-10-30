# C01 — Correlation mechanics in Mozaik v4.1.0

Research findings for ticket **C01**. This file records what the public
`@mozaik-ai/core@4.1.0` API permits. It deliberately does **not** choose a
correlation mechanism, a window length, or defer semantics.

Primary sources:

- Vendored source at `modules/mozaik/src` (git `349db80`, `package.json` version `4.1.0`).
- Installed declarations at `modules/mozaik/dist/index.d.ts`.
- Runnable experiment at `/tmp/opencode/c01/main.ts` (not committed).

---

## Verdict table

| # | Question | Verdict |
| --- | --- | --- |
| 1 | Does the handler see loop/agent identity on `ExecutableTransition`? | **Supported with caveat** — only `nextStateId` and `input`; identity must be closed over. |
| 2 | Can `handle()` await a promise resolved by a different loop's handler? | **Supported** — proven by experiment; A held while B ran. |
| 3 | Is holding a `function_call` transition ~1.5 s safe? | **Supported with caveat** — the loop suspends at `await`; provider call is already complete; no timeout or cancellation exists. |
| 4 | Does `FunctionCallItem.rehydrate` preserve callId/name and replace args? Can a peer rewrite a held transition? | **Supported with caveat** — rehydrate replaces exactly the three fields it is given; peer rewrite works only through an application-shared reference. |
| 5 | Are `pause` / `stop` reachable through `runLoop`? | **Not supported** — `AgentLoop.run` ignores `InterceptionOutput`; no state or transition rule targets `interception`. |
| 6 | Timeout / throw / second interception / queue / lock? | **Supported with caveat** — no timeout, lock, or queue; throw becomes an unhandled rejection and kills that loop silently. |
| 7 | How does a caller know a fire-and-forget `runLoop` finished? | **Supported with caveat** — only via events; no `loop.completed`; `model.answer` is the last success event. |

---

## 1. What is on `ExecutableTransition`?

`ExecutableTransition` is exactly:

```ts
type ExecutableTransition = LoopTransition<ExecutableLoopStateId>;
type LoopTransition<TStateId> = {
  nextStateId: TStateId;
  input: LoopStateContract[TStateId]["input"];
}[TStateId];
```

`modules/mozaik/dist/index.d.ts:249,257-262`;
`modules/mozaik/src/domain/agentic-environment/loop/loop-state.ts:70-71,95-100`.

For a `function_call` transition the input is:

```ts
interface FunctionCallParams {
  call: FunctionCallItem;
  inferenceInput: InferenceInput;
}
```

`modules/mozaik/dist/index.d.ts:184-187`;
`modules/mozaik/src/application/states/function-call.ts:12-15`.

`InferenceInput` carries `model`, optional generation settings, `tools`,
`context` (`ModelContext`), and optional `structuredOutput`
(`modules/mozaik/dist/index.d.ts:281-289`;
`modules/mozaik/src/application/states/inference.ts:13-21`).

**No agent id, loop id, or producer id is present.** The experiment printed:

```
A handle: transition keys = ["nextStateId","input"]
         input keys = ["call","inferenceInput"]
         inferenceInput keys = ["model","context","tools"]
         has agentId/loopId/producerId? {"agentId":false,"loopId":false,"producerId":false}
```

The loop id exists, but inside `AgentLoop` as a private field generated with
`crypto.randomUUID()` (`agent-loop.ts:8-13,35-37,39-45`). `runLoop` passes
`agentId` only to `EventPublisherLoopVisitor`, not to `AgentLoop.create`
(`modules/mozaik/src/application/use-cases/run-loop.ts:49-51`). The handler
therefore:

- must close over the agent identity (or encode it in the `ModelContext`, e.g.
  a developer-message marker), and
- cannot learn its own `loopId` from the transition.

The event bus does carry both `producerId` (= agent id) and `loopId` in every
payload (`event-publisher-visitor.ts:62-68`), but the interception handler never
sees events.

**Caveat:** reusing one handler object for two loops makes the closed-over
identity ambiguous unless the handler inspects the context per call; the
transition itself provides no disambiguator.

---

## 2. Can `handle()` await a promise resolved by a different loop's handler?

**Yes.** `handle` is typed `Promise<ExecutableTransition>` and is `await`ed
directly by the loop (`agent-loop.ts:24-28`;
`dist/index.d.ts:189-192`). Nothing in `AgentLoop` imposes a timeout, lock, or
serialization across loops.

The experiment (`/tmp/opencode/c01/main.ts`) starts two `runLoop` calls
back-to-back with two different handlers that share a module-scope `held` map:

1. A's handler stores its transition in `held.A` and awaits a gate.
2. B's handler stores its transition in `held.B`, waits until `held.A` exists,
   holds for 1.5 s, replaces A's transition object in the box with a
   rehydrated call, then resolves A's gate.
3. A wakes and returns whatever object is in `held.A.transition`.

Observed interleaving:

```
[6.7ms]   runLoop returned undefined undefined — caller is not blocked
[7.3ms]   inference.run(A) -> function_call #1
[7.5ms]   inference.run(B) -> function_call #1
[8.1ms]   A handle: HOLD entered
[8.6ms]   B handle: entered
[1511.1ms] B handle: REPLACED A's held transition args ...
[1511.1ms] B handle: released A, returning own transition
[1511.1ms] A handle: released; returning transition now in box ...
[1512.0ms] TOOL act invoked by B with {"agent":"B","seq":1,"target":"api"}
[1512.1ms] TOOL act invoked by A with {"agent":"A","seq":1,"target":"prod-db","narrowed":true}
```

Event timeline for the same run:

```
7.8ms   A interception.started   loop=d4c26b22...
8.4ms   B interception.started   loop=4a35dae2...
1511.3ms B interception.finished
1512.0ms A interception.finished
1512.1ms A function_call.started
```

A was suspended for ~1.5 s while B's entire handler ran. Both loops progressed
after release. The shared map is application code; Mozaik provides no peer
registry, pub/sub, or scheduler for handlers.

---

## 3. Is holding a `function_call` transition ~1.5 s safe?

**Supported with caveat.** The experiment actually held A for 1503 ms
(8.1 ms → 1511.1 ms) and the loop completed normally.

What *is* suspended:

- The single `AgentLoop.run` async chain, at `await this.interceptionHandler.handle(transition)`
  (`agent-loop.ts:24-28`).
- `FunctionCallState` has not run, so the tool has not been invoked
  (`function-call.ts:22-39`).
- The call is **not yet added to the model context**; that happens later in
  `FunctionCallToInferenceRule` (`transition-rule.ts:98-100`).
- No further events for that loop are emitted between `interception.started`
  and `interception.finished` (`event-publisher-visitor.ts:54-60`).

What is *not* suspended:

- The provider call. `InferenceState.run` awaits the full `inferenceRunner.run`
  before returning (`inference.ts:41-52`). The streaming variant consumes the
  entire `for await` stream, captures `inference.output`, and returns only then
  (`inference-streaming.ts:12-35`). The `function_call` transition is created
  afterwards from that completed output (`transition-rule.ts:35-58`).
- Other loops, the runtime event bus, and all participants. Each `runLoop`
  builds its own resolver/executor/`AgentLoop` (`run-loop.ts:32-49`), and
  `RuntimeService.publish` fans out synchronously (`runtime.ts:30-34`).

In the experiment, `inference.completed` fired at 7.5 ms and
`interception.started` at 7.8 ms — the provider-side work was already done.

**Caveat:** there is no timeout, abort signal, heartbeat, or watchdog anywhere
in the loop path (`grep` for `timeout|AbortSignal|setTimeout|Promise.race` under
`src/domain/agentic-environment/loop` and `run-loop.ts` returns nothing). A hold
lasts exactly as long as the handler's promise. During a hold the runtime has no
record that the loop is alive beyond the open `interception.started` event, and
there is no recovery path if the process stops. A 1.5 s hold is mechanically
safe; whether the added latency is acceptable is a decision for the mechanism
ticket.

---

## 4. `FunctionCallItem.rehydrate` and peer rewrite

`FunctionCallItem` has exactly four fields: the fixed `type = "function_call"`,
`callId`, `name`, and `args` (`dist/index.d.ts:6-17`;
`src/domain/model-context/context-item/model-item/function-call.ts:3-18`).
Its constructor is private; `rehydrate({ callId, name, args })` is the only
public way to build one, and it constructs a **new instance** with exactly the
values supplied. It:

- preserves `callId`, `name`, `args` if you pass them through;
- replaces `args` wholesale (it is an opaque JSON **string**, not an object);
- drops object identity (new instance) and any extra properties a caller might
  have attached;
- does not parse, merge, or validate `args`.

A peer can rewrite a held transition **only if the transition object is shared
through application code**. The experiment did exactly that: B replaced
`held.A.transition` with `{...transition, input: {...input, call: rehydrate(...)}}`
and A returned the replaced object. The rewritten args reached the tool:

```
A tool call: {"agent":"A","seq":1,"target":"prod-db","narrowed":true}
```

The rewrite wins for both execution and conversation history:
`FunctionCallState` executes `transition.input.call` (`function-call.ts:25-39`),
then `FunctionCallToInferenceRule` adds that same rewritten `execution.input.call`
to the context (`transition-rule.ts:98-100`).

**Caveat:** renaming the call to a tool that is not in `inferenceInput.tools`
does not throw. `FunctionCallState` returns a normal
`FunctionCallOutputItem` with `Error: unknown tool "<name>"` and the loop
continues to inference (`function-call.ts:27-37`). A deny-by-renaming design
therefore needs the replacement tool registered. `DefaultFunctionCallRunner`
also wraps `JSON.parse(input.args)` and tool invocation in a try/catch, turning
parse/tool failures into an error-string output rather than a loop failure
(`services/function-call.ts:6-18`).

There is no runtime API that exposes another loop's transition. Sharing the
object is entirely the application's doing.

---

## 5. Are `pause` / `stop` reachable through `runLoop`?

**Not supported.**

The union exists in the source:

```ts
type InterceptionOutput =
  | { type: "continue"; transition: LoopTransition }
  | { type: "pause"; pendingTransition: LoopTransition }
  | { type: "stop"; reason?: string };
```

`src/domain/agentic-environment/loop/interception.ts:8-20`;
`dist/index.d.ts:193-202`.

But:

1. `InterceptionHandler.handle` is declared to return `Promise<ExecutableTransition>`,
   not `Promise<InterceptionOutput>` (`interception.ts:3-6`;
   `dist/index.d.ts:189-192`).
2. `AgentLoop.run` assigns the return value straight to `transition` and never
   inspects a `.type` or `.pendingTransition`
   (`agent-loop.ts:24-28`). It never mentions `InterceptionOutput` at all.
3. `runLoop` accepts only `InterceptionHandler`; its return type is `void`
   (`run-loop.ts:21-27,53-60`; `dist/index.d.ts:500-510`).
4. `LoopStateId` does **not** include `"interception"`
   (`loop-state.ts:8-14`), so `ExecutableTransition` cannot target it even in
   the type system. The `interception` entry in `LoopStateContract`
   (`loop-state.ts:59-62`) is unreachable.
5. `LoopStateExecutor.execute` has no `interception` case
   (`state-executor.ts:41-56`), and the transition rule list built by `runLoop`
   contains no rule that produces an `interception` transition
   (`run-loop.ts:32-39`; all rules in `transition-rule.ts:18-124`).
6. `InterceptionOutput` is not exported from the package root: `src/index.ts`
   imports and exports only `InterceptionHandler` (`src/index.ts:38,84`), and the
   declaration export list likewise omits `InterceptionOutput`
   (`dist/index.d.ts:637`).

Returning `{ type: "pause", ... }` through a cast would be treated as a state
transition, fall through `LoopStateExecutor`'s switch (returning `undefined`),
and then throw in `TransitionResolver.resolve` when it reads
`execution.stateId` (`transition-resolver.ts:7-15`). It is not a supported
control path. The same applies to `stop`.

---

## 6. Timeout, throw, second interception, queue, lock

**No timeout.** Nothing in `AgentLoop`, `runLoop`, or the states races the
handler against a timer. Experiment E returned a never-resolving promise; after
400 ms the loop's event list was still:

```
["participant.joined","message_received.started","message_received.completed",
 "inference.started","inference.completed","interception.started"]
```

No `interception.finished`, no `function_call.started`. The loop is parked
indefinitely.

**Throw.** `AgentLoop.run` does not catch. `runLoop` calls `agentLoop.run(...)`
without `await` or `.catch` (`run-loop.ts:53-59`), so the rejection escapes as an
unhandled rejection. Experiment D produced:

```
D handle: throwing
process unhandledRejection: handler exploded
D events: ["participant.joined","message_received.started",
 "message_received.completed","inference.started","inference.completed",
 "interception.started"]
D unhandled rejections: 1
```

The loop dies at `interception.started`. No error event is published, no
`interception.finished`/`function_call.started` is emitted, and the caller has
no promise to observe. Without a process-level `unhandledRejection` listener,
the host runtime's default behavior applies.

**Second interception while the first is held.**

- *Same loop:* cannot overlap. `AgentLoop.run` awaits `handle` before executing
  the state, then advances to the next state (`agent-loop.ts:21-32`), so a
  second function call in the same loop is intercepted only after the first
  handler returns. Experiment C (two `act` calls in one loop) shows strict
  serialization:

  ```
  C handle ENTER seq=1 -> C handle EXIT seq=1 -> TOOL act seq=1
  C handle ENTER seq=2 -> C handle EXIT seq=2 -> TOOL act seq=2
  ```

- *Different loops:* fully concurrent, no global lock or queue. Each `runLoop`
  constructs its own `TransitionResolver`, `LoopStateExecutor`, and `AgentLoop`
  (`run-loop.ts:32-49`). Experiment A/B held two `function_call` transitions at
  the same time. If the same handler instance is passed to two `runLoop` calls,
  its `handle` can be entered concurrently; any shared mutable state needs its
  own synchronization.

There is no queue of pending transitions, no per-handler mutex, and no
backpressure. Everything is ordinary JavaScript async control flow plus
application-shared closures.

---

## 7. How does a caller know a fire-and-forget `runLoop` finished?

`runLoop` returns `undefined` (`run-loop.ts:53-60`;
`dist/index.d.ts:510`). The experiment captured the return values and logged
`undefined undefined` immediately, while both loops were still running. There is
no promise, handle, loop id, or completion callback.

The observable surface is the event bus. `EventPublisherLoopVisitor` publishes
exactly these types (`event-publisher-visitor.ts:22-60`):

| Event | Emitted at |
| --- | --- |
| `message_received.started` | `MessageReceivedState.run` entry (`message-received.ts:9-10`) |
| `message_received.completed` | before returning the prepared `InferenceInput` (`message-received.ts:19-24`) |
| `inference.started` | `InferenceState.run` entry (`inference.ts:41-42`); also `InferenceStreamingState` (`inference-streaming.ts:12-13`) |
| `inference.stream` | each streamed `SemanticEvent` (`inference-streaming.ts:17-18`; publisher `34-36`) |
| `inference.completed` | after the runner returns (`inference.ts:44-46`; streaming `29`) |
| `function_call.started` | `FunctionCallState.run` entry (`function-call.ts:22-23`) |
| `function_call.completed` | after the tool runner returns (`function-call.ts:39-41`) |
| `model.answer` | `ModelMessageState.run` (`model-message.ts:7-8`) |
| `interception.started` | before `handle` (`agent-loop.ts:25`) |
| `interception.finished` | after `handle` (`agent-loop.ts:27`) |

Every payload gets `loopId` appended and `producerId` set to the agent id
(`event-publisher-visitor.ts:62-68`). Observed:

```
A model.answer loop=d4c26b22-bfbc-4561-90a6-b4886902f08b
B model.answer loop=4a35dae2-7706-4353-9fe1-dd4425396e6b
```

**There is no `loop.completed`, `loop.idle`, or equivalent event.**
`ModelMessageToIdleRule` moves to `idle` with no visitor call
(`transition-rule.ts:111-124`), and `AgentLoop.run` exits its `while` when
`nextStateId === "idle"` (`agent-loop.ts:21`). The experiment's full event-type
set contained no loop-level event:

```
["participant.joined","message_received.started","message_received.completed",
 "inference.started","inference.completed","interception.started",
 "interception.finished","function_call.started","function_call.completed",
 "model.answer"]
```

Therefore:

- A successful loop's last event is `model.answer`.
- A thrown or hung handler produces **no terminal event at all**; the last event
  is `interception.started`.
- `model.answer` carries the `loopId`, so a global listener can use it as a
  per-loop success signal, but it must have been registered **before**
  `runLoop` was called.
- If the handler does not intercept `message_received`, its `started` and
  `completed` events are published synchronously inside `runLoop` before it
  returns: `AgentLoop.run` is called without `await`, and
  `MessageReceivedState.run` has no `await` before publishing
  (`run-loop.ts:53-59`; `message-received.ts:9-24`). In the experiment A's
  `message_received.started` fired at 6.0 ms and `runLoop` returned at 6.7 ms.
  Even if a handler intercepts every transition, `interception.started` is
  published before `handle` is awaited (`agent-loop.ts:25-26`), so at least one
  event fires synchronously. A caller cannot discover the `loopId` by calling
  `runLoop` and subscribing afterwards; `runLoop` returns no id and the earliest
  events are already gone.

---

## Experiment

**Path:** `/tmp/opencode/c01/main.ts`
**Log:** `/tmp/opencode/c01/run.log`
**Dependency:** `/tmp/opencode/c01/node_modules/@mozaik-ai/core` symlinked to
`/home/g/m/jigjoy/modules/mozaik` (the workspace build, version 4.1.0).

**Run:**

```sh
cd /tmp/opencode/c01 && bun main.ts
```

No API key and no network. A fake `InferenceRunner` is injected through
`initializeRuntime({ state, inferenceRunnerConfig: { runner } })`, the public
config path (`define-runtime.ts:17-20,26-46`; `dist/index.d.ts:495-503`). The
fake returns an `act` function call until the requested number of calls has
been made, then a model message. A listener `Human` with a catch-all
`SituationSpecification` records every event. Note: Mozaik invokes a situation
processor as `processor.apply({ event, participant })`, so the context arrives
as `this`, not as a function argument
(`src/domain/agentic-environment/semantic-event/event-processor.ts:5-12`); the
experiment's listener uses a non-arrow function for that reason.

**What it exercises:**

| Scenario | Purpose |
| --- | --- |
| A + B, one `act` call each | Prove cross-loop await and peer rewrite; hold A for ~1.5 s |
| C, two `act` calls in one loop | Prove same-loop interceptions are serialized |
| D, handler throws | Observe rejection and missing terminal events |
| E, handler never resolves | Observe absence of timeout |
| Listener | Enumerate actual event types and confirm no `loop.completed` |

**Key observed output (abridged):**

```
runLoop returned undefined undefined — caller is not blocked
A handle: HOLD entered; args = {"agent":"A","seq":1,"target":"prod-db"}
B handle: entered; args = {"agent":"B","seq":1,"target":"api"}
[1511.1ms] B handle: REPLACED A's held transition args with
           {"agent":"A","seq":1,"target":"prod-db","narrowed":true}
[1511.1ms] A handle: released; returning transition now in box ...
[1512.1ms] TOOL act invoked by A with {"agent":"A","seq":1,... "narrowed":true}

7.8ms   A interception.started
8.4ms   B interception.started
1511.3ms B interception.finished
1512.0ms A interception.finished
...
1523.8ms A model.answer

C handle ENTER seq=1 -> EXIT seq=1 -> TOOL act seq=1
C handle ENTER seq=2 -> EXIT seq=2 -> TOOL act seq=2

D events: [..., "inference.completed", "interception.started"]
D unhandled rejections: 1

E events after 400ms: [..., "inference.completed", "interception.started"]
any 'loop.completed' style event? false
```

---

## What this means for the airlock

Facts only:

- A handler sees only its own transition. It has `call` and `inferenceInput`,
  but no agent id, loop id, or producer id, so identity must come from a closure
  or from data the application put in the `ModelContext`.
- A handler can genuinely suspend its loop on a promise resolved by a peer
  handler. The loop is the only thing suspended: the provider call has already
  completed and other loops continue. There is no runtime timeout, queue, lock,
  or cancellation, so the hold lasts as long as the application keeps it.
- Two loops can hold `function_call` transitions simultaneously; two calls in
  one loop are intercepted strictly one after another.
- A peer can change a held transition only if the application shares the
  transition object. Returning a rehydrated call changes both the executed tool
  arguments and the call recorded in model context. An unregistered replacement
  name produces an error output, not an exception.
- `pause` and `stop` are type-level artifacts. They are not exported from the
  package root, not accepted by `handle`, not consumed by `AgentLoop.run`, and
  there is no `interception` state or transition rule to reach them. A supported
  design cannot use them without patching Mozaik.
- `runLoop` is fire-and-forget and returns nothing. Progress is observable only
  through events keyed by `producerId` and `loopId`. There is no completion
  event; `model.answer` is the last event of a successful loop, and a throw or a
  hung handler leaves no terminal event. The first events fire synchronously
  before `runLoop` returns, so a listener must already be attached.

---

## What was not executed

- **No real model or provider.** The `InferenceRunner` was a local fake
  returning canned `FunctionCallItem` / `ModelMessageItem` values. Real provider
  latency, streaming timing, and provider-side cancellation were not measured.
- **The streaming path was not run.** The experiment used `streaming: false`
  (the default `inference` state). The claim that a stream is fully consumed
  before interception is from `InferenceStreamingState` source
  (`inference-streaming.ts:12-35`), not from a runtime experiment.
- **`pause` / `stop` were not exercised at runtime.** The conclusion rests on
  the type signature, the absence of any read of `InterceptionOutput` in
  `AgentLoop.run`, the missing state case, the missing transition rule, and the
  missing root export.
- **No test of `stream()` on the fake runner through `runLoop`.** The fake
  implements it, but no loop was started with `streaming: true`.
- **No multi-handler-instance concurrency test.** The A/B experiment used two
  separate handler objects. The claim that one shared handler instance can be
  entered concurrently for two loops follows from source (no lock), not from a
  dedicated run.
- **No process-level restart, crash, or memory test.** Dropping a held loop by
  killing the process was not measured; only the in-process throw and hang were.
- **No 1.5 s hold with a real tool side effect.** The tool was a local async
  function logging its args, not an external system.

Nothing in Mozaik was patched, and no source, ticket, map, or git state was
modified. The only files created are this document and `/tmp/opencode/c01`.
