# Platform — Mozaik

Sources: <https://docs.jigjoy.ai>, <https://github.com/jigjoy-ai/mozaik>,
<https://github.com/jigjoy-ai/mozaik-examples>, <https://github.com/jigjoy-ai/cli-agent-starter>,
<https://github.com/jigjoy-ai/baro>, <https://learn.jigjoy.ai> (accessed 2026-10-30).

## What it is

`@mozaik-ai/core` — a **TypeScript runtime for interoperable AI agents**, MIT licensed.
Humans, agents, and observers are all `Participant`s of the same runtime. They share typed
`RuntimeState`, publish `SemanticEvent`s, and react through situation handlers. **There is no
central scheduler.**

Three attributes the docs name: **concurrency** (agents work independently, `runLoop` is
fire-and-forget), **awareness** (agents see other participants, events, shared state), **adaptivity**
(situation handlers and interception change behaviour from runtime state).

The 30-point criterion in every relevant track is essentially a test of these three.

## Install and credentials

```bash
npm install @mozaik-ai/core       # current: v4 API
```

`.env` at the project root (never commit it):

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
# DeepSeek uses the OpenAI-compatible endpoint:
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
```

`tsconfig` needs a modern `moduleResolution` (`bundler`, `node16`, `nodenext`).
Node 18+.

## The API in one screen

```ts
import { defineRuntime, RuntimeState, createAgent, createHuman,
         SituationSpecification, Agent } from '@mozaik-ai/core'

class AppState extends RuntimeState {}          // your shared typed state
const { initializeRuntime, resolveRuntime, resolveParticipant, join, leave,
        sendMessage, sendEvent, runLoop } = defineRuntime<AppState>()

initializeRuntime({ state: new AppState() })    // once; second call throws
```

| Function | Role |
| --- | --- |
| `initializeRuntime({ state, inferenceRunnerConfig? })` | Create the runtime. |
| `resolveRuntime()` / `resolveParticipant(id)` | Look up the runtime or a joined participant. |
| `join(p)` / `leave(p)` | Membership; publishes `participant.joined/left`. |
| `sendMessage(message, senderId)` | Publishes `message.sent`. |
| `sendEvent(event, senderId)` | Publishes any custom `SpaceEvent` type. |
| `runLoop(agentId, message, request, interceptionHandler?)` | One agent turn; **fire-and-forget**. |

### Participants

- `createHuman({ name, capabilities, handlers })`
- `createAgent({ name, capabilities, instruction, tools, handlers })`
- An **observer** is either factory with handlers that only react.

Identity is the manifest (`id`, `name`, `role`, `capabilities`); behaviour is the handlers.

### State

`RuntimeState` already holds the participant registry. Subclass it for anything shared — work queue,
active goal, transcript. **There is no second hidden store.**

### Events

`SpaceEvent = { type, producerId, occurredAt, payload }`.

Built-ins: `participant.joined/left`, `message.sent`, and the loop lifecycle
`message_received.started/completed`, `inference.started/stream/completed`,
`function_call.started/completed`, `model.answer`, `interception.started/finished`.
Custom events via `sendEvent` with any type string. Every event is delivered to **every** joined
participant; there is no internal/external split. Filter on `event.type` and `event.producerId`.

### Situation handlers

```ts
{ specification: SituationSpecification, processor: { apply(context) } }
```

`isSatisfiedBy({ event, participant })`, composable with `.and() / .or() / .not()`.
**The runtime does not await `processor.apply`** — a slow listener never blocks producers or peers.
Self-vs-others is a `producerId` filter, not a separate API.

### The agent loop

`runLoop` walks: `message_received → inference → (function_call → inference)* → model_message → idle`.
Each call gets its own `loopId`; two loops on one agent do not share a cursor. Tool execution and
follow-up inference live inside the loop — there is no separate function-call runner. Streaming is
`streaming: true`, publishing `inference.stream`.

### Interception

`InterceptionHandler` inspects or rewrites a transition **before** it runs:

```ts
interface InterceptionHandler {
  isSatisfiedBy(transition: ExecutableTransition): boolean
  handle(transition: ExecutableTransition): Promise<ExecutableTransition>
}
```

`handle` is **awaited** inside the loop, so it suspends that agent alone, mid-turn. This is the
sanctioned mechanism for human-in-the-loop, mid-turn critique, or rewriting a peer's half-formed
decision. Last edition's winner (Separation) was built almost entirely on this.

## Models

Selected by the `model` string on `InferenceInput`. The runtime validates the string against
`supportedModels` **before** any network call.

| Provider | Model strings | Endpoint |
| --- | --- | --- |
| OpenAI | `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano` | `OpenAIResponses` |
| Anthropic | `claude-opus-4-8`, `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` | `AnthropicMessages` |
| Gemini | `gemini-3.1-pro-preview`, `gemini-3.5-flash` | `GeminiGenerateContent` |
| DeepSeek | `deepseek-v4-pro`, `deepseek-v4-flash` | `OpenAIChatCompletions` |

DeepSeek sets `supportsStructuredOutput: false`. Requesting an unsupported feature fails validation
first. A custom `supportedModels` list or a custom `InferenceRunner`
(`{ run(request), stream(request) }`) can be passed via `inferenceRunnerConfig` — this is how any
OpenAI-compatible endpoint (OpenRouter, vLLM, Ollama) is used.

## Resources

| Resource | Link | Why |
| --- | --- | --- |
| Docs | <https://docs.jigjoy.ai> | Quickstart, runtime, situation handlers, agent loop, interception, models |
| Mini-course | <https://learn.jigjoy.ai> | 7 lessons, ~25 min: why Mozaik → LLM context → first runtime → participants & state → loop & events → tools & interception → next steps |
| Primer (PDF) | `learn.jigjoy.ai/context-structure-of-llms.pdf` | Context fundamentals |
| Examples | <https://github.com/jigjoy-ai/mozaik-examples> | 12 small projects: terminal-agent, inference-interception, human-in-the-loop, history-simulation, shared-state, streaming, structured-output, tool-calling, mcp, custom-inference-runner, reasoning-effort, wrong-asnwer |
| Starter | <https://github.com/jigjoy-ai/cli-agent-starter> | Ink CLI + runtime + agent + UI observer; `npx degit jigjoy-ai/cli-agent-starter my-agent` |
| baro | <https://github.com/jigjoy-ai/baro> | Software factory: goal → contract → DAG of stories → parallel agents in worktrees → evidence critic, write-surface ownership, merge gates. Explicitly allowed as a base for Track 01. |
| Source | <https://github.com/jigjoy-ai/mozaik> | Issues, releases |

## baro, in more detail (Track 01 relevant)

`npm i -g baro-ai`; needs Node 20+, git, and a backend (`claude` CLI, `codex`, or any
OpenAI-compatible endpoint). `baro --doctor` checks the setup.

Design ideas worth stealing even outside Track 01:

- **Contract first** — the architect turns the goal into machine-checkable invariants before code.
- **A market, not an assignment** — the board offers work, workers bid, a broker grants a **lease**
  carrying a **generation**, so events from a dead attempt cannot haunt its replacement.
- **Gates, not vibes** — declared tests, build-before-commit, an evidence critic that judges captured
  command output, write-surface ownership; fail-closed.
- **Every gate announces itself** — whatever a boundary enforces, it must also tell the judged party.
- **Nobody grades their own homework** — the worker reports; the system certifies.
- **The plan is a living graph** — replanning is on the same bus as execution.
