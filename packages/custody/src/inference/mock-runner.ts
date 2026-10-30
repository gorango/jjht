/**
 * The offline inference runner. The model is the only canned part of the live
 * run: real Mozaik loops, bus events and interception happen around it.
 *
 * The runLoop message carries `{stepId, agentId}` as JSON. `agentId` is used as
 * the event producer because `sendEvent` rejects participants that were never
 * joined, and the runner must never crash a loop over a trace concern.
 */
import {
  FunctionCallItem,
  ModelMessageItem,
  type InferenceInput,
  type InferenceOutput,
  type InferenceRunner,
  type SemanticEvent,
} from "@mozaik-ai/core";

import type { Clock } from "../runtime/clock.js";
import { publish } from "../runtime/ingest.js";

export interface ScriptedCall {
  name: string;
  args: Record<string, unknown>;
}

export interface StepScript {
  stepId: string;
  agentId: string;
  latencyMs: number;
  calls: ScriptedCall[];
}

interface Envelope {
  stepId: string;
  agentId?: string;
}

interface Waiter {
  promise: Promise<void>;
  resolve: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readEnvelope = (request: InferenceInput): Envelope | undefined => {
  const items = request.context.getItems();
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || item.type !== "message") continue;
    if ((item as { role?: string }).role !== "user") continue;
    const text = (item as { content?: { text?: unknown } }).content?.text;
    if (typeof text !== "string") continue;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isRecord(parsed) || typeof parsed.stepId !== "string") return undefined;
      return {
        stepId: parsed.stepId,
        ...(typeof parsed.agentId === "string" ? { agentId: parsed.agentId } : {}),
      };
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const completedCalls = (request: InferenceInput): number =>
  request.context.getItems().filter((item) => item.type === "function_call_output").length;

const done = (): ModelMessageItem => ModelMessageItem.rehydrate({ text: "done" });

export class MockInferenceRunner implements InferenceRunner {
  private readonly scripts: Map<string, StepScript>;

  private readonly waits = new Map<string, Waiter>();

  private readonly finished = new Set<string>();

  private warned = false;

  constructor(
    scripts: readonly StepScript[],
    private readonly clock: Clock,
  ) {
    this.scripts = new Map(scripts.map((script) => [script.stepId, script]));
  }

  /** Resolves when the step has made its terminal (message) inference. */
  waitFor(stepId: string): Promise<void> {
    if (this.finished.has(stepId)) return Promise.resolve();
    const existing = this.waits.get(stepId);
    if (existing) return existing.promise;
    let resolve = (): void => {};
    const promise = new Promise<void>((settle) => {
      resolve = settle;
    });
    this.waits.set(stepId, { promise, resolve });
    return promise;
  }

  private finish(stepId: string): void {
    if (this.finished.has(stepId)) return;
    this.finished.add(stepId);
    this.waits.get(stepId)?.resolve();
  }

  private trace(agentId: string, type: string, payload: unknown): void {
    try {
      publish(type, agentId, payload);
    } catch (error) {
      if (this.warned) return;
      this.warned = true;
      console.error(`custody: inference event rejected (${type} from ${agentId}): ${String(error)}`);
    }
  }

  async run(request: InferenceInput): Promise<InferenceOutput> {
    const envelope = readEnvelope(request);
    if (!envelope) return { items: [done()], tokenUsage: undefined, rowResponse: undefined };

    const script = this.scripts.get(envelope.stepId);
    if (!script) return { items: [done()], tokenUsage: undefined, rowResponse: undefined };

    const agentId = envelope.agentId ?? script.agentId;
    const index = completedCalls(request);
    const startedAt = this.clock.now();
    const base = { stepId: script.stepId, agentId, runner: "mock", costUsd: 0 };

    this.trace(agentId, "inference.started", { ...base, callIndex: index });

    await this.clock.sleep(script.latencyMs);

    const call = script.calls[index];
    const durationMs = this.clock.now() - startedAt;

    if (!call) {
      this.trace(agentId, "inference.completed", { ...base, durationMs, callIndex: index, terminal: true });
      this.finish(script.stepId);
      return { items: [done()], tokenUsage: undefined, rowResponse: undefined };
    }

    const item = FunctionCallItem.rehydrate({
      callId: `${script.stepId}-${index + 1}`,
      name: call.name,
      args: JSON.stringify(call.args),
    });

    this.trace(agentId, "inference.completed", {
      ...base,
      durationMs,
      callIndex: index,
      terminal: false,
      tool: call.name,
    });

    return { items: [item], tokenUsage: undefined, rowResponse: undefined };
  }

  async *stream(_request: InferenceInput): AsyncGenerator<SemanticEvent> {
    throw new Error("mock inference is not streamed");
  }
}
