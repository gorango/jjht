# 09 — Mozaik v4.1.0 notes (verified)

Verified against `modules/mozaik/dist/index.d.ts` (the workspace build produced by `bun install`).
Line numbers are from that file, so they can be re-checked when the submodule moves.

## Runtime

```ts
defineRuntime<TRuntimeState extends RuntimeState>(): {
  initializeRuntime(config: { state; inferenceRunnerConfig? }): RuntimeService;
  resolveRuntime(): RuntimeService;
  resolveParticipant(id): Participant;
  join(participant): void;
  leave(participant): void;
  sendMessage(message, senderId): void;
  sendEvent(event, senderId): void;
  runLoop(agentId, message, inferenceInput, interceptionHandler?): void;
}                                                        // line 499
```

The returned functions are **not** top-level exports. Keep them in module scope and re-export, as
`src/runtime/session.ts` does. Call `initializeRuntime` exactly once; calling it twice throws.

## The interception hook

```ts
interface InterceptionHandler {                          // line 189
  isSatisfiedBy(transition: ExecutableTransition): boolean;
  handle(transition: ExecutableTransition): Promise<ExecutableTransition>;
}
```

Facts that matter for the airlock:

- `handle` is async and is **awaited by the loop**, so it can hold a pending tool call while other
  agents propose. This is the only interval in which peer intent exists.
- The `function_call` transition's `input` is `FunctionCallParams { call, inferenceInput }`.
- `FunctionCallItem.rehydrate({ callId, name, args })` (line 6) builds a substitute call.
- Returning the transition unchanged continues; returning a spread with a new `input` rewrites it.
- There is an `InterceptionOutput` union with `pause` / `stop` in the types (line 193), but it is not
  exposed through `runLoop`'s public signature. Do not build the design on `pause` unless the
  submodule is patched — and if it is patched, say so in the README, because judges may run upstream.

## Agent loop

```
message_received → inference → (function_call → inference)* → model_message → idle
```

`runLoop` is fire-and-forget. Never `await` it inside a situation processor. Each call gets a unique
`loopId`, so two loops on one agent do not share a cursor.

## Participants and handlers

```ts
createAgent({ name, capabilities, instruction, tools, handlers })
createHuman({ name, capabilities, handlers })
```

A handler is `{ specification, processor }`. `SituationSpecification.isSatisfiedBy({ event, participant })`
composes with `.and()`, `.or()`, `.not()`. Processors are not awaited by the runtime: a thrown error
in an async processor does not reach the bus, so log it yourself.

## Per-turn context

```ts
const context = ModelContext.create();
context.addContextItem(DeveloperMessageItem.create(instruction));
runLoop(agentId, message, { model, context, tools, maxOutputTokens });
```

Do not share one `ModelContext` across concurrent turns; `addContextItems` mutates in place and two
live turns on one context can hard-fail the provider. EUREKA learned this the same way.

## Models

Bundled names include `gpt-5.5`, `gpt-5.4-mini`, `claude-sonnet-4-6`, `claude-haiku-4-5`,
`gemini-3.1-pro-preview`, `gemini-3.5-flash`, `deepseek-v4-flash`, `deepseek-v4-pro`. An unknown
model string is rejected **before** a network call, so declare custom ids in
`inferenceRunnerConfig.supportedModels`.

`deepseek-*` sets `supportsStructuredOutput: false`. If the schema parse is load-bearing, do not use
DeepSeek for that role, or parse defensively (EUREKA's `parseJson` strips fences and grabs the
outermost object).

## Tools

Function tools are ordinary definitions; MCP servers are discovered into the same registry. The
airlock should intercept the single `act` tool, not every tool — otherwise it will try to justify a
`read_file`.

## Pitfalls that cost time in EUREKA

| Pitfall | Consequence | Fix |
| --- | --- | --- |
| `await runLoop(...)` | the processor blocks; concurrency disappears | fire and forget |
| shared `ModelContext` | provider 400s under concurrent turns | fresh context per turn |
| lease TTL shorter than a slow model call | duplicate work, double cost, silent | no renewal today; emit `lease.expired` |
| unknown model id | runtime rejects before the call | declare custom models explicitly |
| mock cost reported as real | trace lies | set `$0` in mock, label the runner |
| `structuredOutput` on DeepSeek | validation failure | use a provider that supports it, or parse |

## Testing without a model

The airlock is a pure function and the invariants are pure functions. `bun test` needs no key and no
network. Keep it that way: the judge must be runnable by a stranger in one second, and the model is
the least reliable part of the demo.
