/**
 * One reactive worker, reused by every role.
 *
 * A worker is an `Agent` participant that reacts to `work.available`. It takes
 * one item off its role's queue, leases it, runs one model turn, and publishes the
 * result. It never blocks: `runLoop` is fire-and-forget, and the result arrives as
 * a `model.answer` event that the same participant reacts to.
 *
 * One task in flight per worker is deliberate. It keeps `model.answer` → task
 * correlation unambiguous, and it makes the concurrency honest: parallelism comes
 * from the pool, not from a hidden queue inside one agent.
 */
import {
  Agent,
  DeveloperMessageItem,
  ModelContext,
  SituationSpecification,
  createAgent,
  type InferenceInput,
  type SemanticEvent,
  type SituationContext,
} from "@mozaik-ai/core";

import type { Claim } from "../domain/types.js";
import { estimateCost } from "../inference/pricing.js";
import { emit, wake } from "../runtime/events.js";
import { resolveRuntime, runLoop } from "../runtime/session.js";
import type { EurekaState, Role } from "../runtime/state.js";

export interface WorkerContext {
  worker: string;
  item: string;
  attempt: number;
  generation: number;
}

export interface WorkerSpec {
  role: Role;
  instruction: string;
  model: string;
  /** Per-role output ceiling. Proposals are one page; 5k tokens is waste and latency. */
  maxOutputTokens: number;
  /** Build the JSON payload the model sees. Throwing is a task failure. */
  buildInput(state: EurekaState, item: string, attempt: number): Record<string, unknown>;
  /** Turn the model's JSON into domain effects. The worker does not interpret it. */
  apply(state: EurekaState, item: string, result: any, context: WorkerContext): void;
}

const MAX_ATTEMPTS = 2;

/** A fresh context per turn: agent memory is not task state. */
export const turn = (instruction: string, payload: unknown): ModelContext => {
  const context = ModelContext.create();
  context.addContextItem(DeveloperMessageItem.create(instruction));
  return context;
};

/** Strip markdown fences and grab the outermost JSON object a model may have wrapped. */
export const parseJson = <T>(text: string): T => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`no JSON object in answer: ${text.slice(0, 120)}`);
  return JSON.parse(body.slice(start, end + 1)) as T;
};

class WorkAvailable<N extends Role> extends SituationSpecification {
  constructor(private readonly role: N) {
    super();
  }

  override isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "work.available" && (event.payload as { role?: string }).role === this.role;
  }
}

class OwnAnswer extends SituationSpecification {
  constructor(private readonly selfId: () => string) {
    super();
  }

  override isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "model.answer" && event.producerId === this.selfId();
  }
}

class OwnInference extends SituationSpecification {
  constructor(private readonly selfId: () => string) {
    super();
  }

  override isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "inference.completed" && event.producerId === this.selfId();
  }
}

export const createWorker = (state: EurekaState, spec: WorkerSpec, index: number): Agent => {
  const name = `${spec.role}-${index}`;
  let current: { item: string; attempt: number; generation: number; startedAt: number } | undefined;
  let lastUsage: { input: number; output: number } | undefined;

  const worker = createAgent({
    name,
    capabilities: ["inference", spec.role],
    instruction: spec.instruction,
    tools: [],
    handlers: [
      {
        specification: new WorkAvailable(spec.role),
        processor: {
          apply() {
            const self = worker.getId();
            // One turn at a time per worker: the correlation rule, not a bottleneck.
            if (current) return;

            let item = state.dequeue(spec.role);
            while (item !== undefined) {
              const attempt = state.attempts.get(item) ?? 0;
              if (attempt >= MAX_ATTEMPTS) {
                emit("task.failed", self, { role: spec.role, item, worker: self, reason: "attempts exhausted" });
                item = state.dequeue(spec.role);
                continue;
              }

              const claim = state.market.claim(`${spec.role}:${item}`, self, state.config.leaseTtlMs);
              if (!claim) {
                // Someone else holds it; leave it for them and try the next one.
                state.enqueue(spec.role, item);
                item = state.dequeue(spec.role);
                continue;
              }

              current = { item, attempt, generation: claim.generation, startedAt: Date.now() };
              emit("task.claimed", self, {
                role: spec.role,
                item,
                worker: self,
                generation: claim.generation,
              });

              let envelope: Record<string, unknown>;
              try {
                envelope = {
                  role: spec.role,
                  item,
                  attempt,
                  input: spec.buildInput(state, item, attempt),
                };
              } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                state.market.release(`${spec.role}:${item}`, claim.generation);
                state.attempts.set(item, attempt + 1);
                emit("task.failed", self, { role: spec.role, item, worker: self, reason });
                item = state.dequeue(spec.role);
                continue;
              }

              const input: InferenceInput = {
                model: spec.model,
                maxOutputTokens: spec.maxOutputTokens,
                context: turn(spec.instruction, envelope),
                tools: [],
              };
              runLoop(self, JSON.stringify(envelope), input);
              return;
            }
          },
        },
      },
      {
        specification: new OwnInference(() => worker.getId()),
        processor: {
          apply({ event }) {
            const usage = (event.payload as { tokenUsage?: { inputTokens: number; outputTokens: number } }).tokenUsage;
            if (usage) lastUsage = { input: usage.inputTokens, output: usage.outputTokens };
          },
        },
      },
      {
        specification: new OwnAnswer(() => worker.getId()),
        processor: {
          apply({ event }) {
            const self = worker.getId();
            const active = current;
            if (!active) return;

            const answer = (event.payload as { answer: { content: { text: string } } }).answer;
            const text = answer?.content?.text ?? "";
            const durationMs = Date.now() - active.startedAt;
            const usage = lastUsage ?? { input: Math.ceil(text.length / 8), output: Math.ceil(text.length / 4) };
            lastUsage = undefined;

            // A mock run costs nothing; reporting a price for it would be a lie in the trace.
            const costUsd = state.config.mock ? 0 : estimateCost(spec.model, usage.input, usage.output);
            state.counters.modelCalls += 1;
            state.counters.inputTokens += usage.input;
            state.counters.outputTokens += usage.output;
            state.counters.costUsd += costUsd;

            emit("task.measured", self, {
              role: spec.role,
              item: active.item,
              worker: self,
              model: spec.model,
              inputTokens: usage.input,
              outputTokens: usage.output,
              costUsd,
              durationMs,
            });

            current = undefined;

            try {
              const result = parseJson<unknown>(text);
              if (!state.market.isCurrent(`${spec.role}:${active.item}`, active.generation)) {
                throw new Error("stale lease: result discarded");
              }
              // Release before publishing the result. `apply` is synchronous, so no
              // other worker can interleave, and the completion check that runs on
              // the resulting event sees a market with no lease of ours left in it.
              state.market.release(`${spec.role}:${active.item}`, active.generation);
              spec.apply(state, active.item, result, {
                worker: self,
                item: active.item,
                attempt: active.attempt,
                generation: active.generation,
              });
            } catch (error) {
              const reason = error instanceof Error ? error.message : String(error);
              state.attempts.set(active.item, active.attempt + 1);
              state.market.release(`${spec.role}:${active.item}`, active.generation);
              emit("task.failed", self, { role: spec.role, item: active.item, worker: self, reason });
              if (active.attempt + 1 < MAX_ATTEMPTS) state.enqueue(spec.role, active.item);
            } finally {
              // Keep draining this role's queue.
              wake(state.queues[spec.role].length, spec.role, self);
            }
          },
        },
      },
    ],
  });

  return worker;
};

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

export const claimsOf = (value: unknown): Claim[] => (Array.isArray(value) ? (value as Claim[]) : []);

export const runtimeState = (): EurekaState => resolveRuntime().state;

export type { SemanticEvent };
