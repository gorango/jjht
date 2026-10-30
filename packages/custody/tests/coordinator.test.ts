import { describe, expect, test } from "bun:test";
import {
  Human,
  ModelMessageItem,
  type InferenceInput,
  type InferenceOutput,
  type InferenceRunner,
  type SemanticEvent,
} from "@mozaik-ai/core";

import { AirlockCoordinator } from "../src/agents/airlock-coordinator.js";
import type { InvariantContext } from "../src/domain/invariants.js";
import { demoTopology } from "../src/domain/topology.js";
import type { Intent } from "../src/domain/types.js";
import type { SimAdapter } from "../src/infra/adapter.js";
import type { Clock, Timer, TimerOptions } from "../src/runtime/clock.js";
import { initializeRuntime, join } from "../src/runtime/session.js";
import { CustodyState } from "../src/runtime/state.js";

class FakeClock implements Clock {
  private time = 1_000;

  private readonly timers: Array<{ at: number; run: () => void }> = [];

  now(): number {
    return this.time;
  }

  async sleep(): Promise<void> {}

  setTimer(ms: number, run: () => void, _options?: TimerOptions): Timer {
    const timer = { at: this.time + ms, run };
    this.timers.push(timer);
    return { cancel: () => this.timers.splice(this.timers.indexOf(timer), 1) };
  }

  advance(ms: number): void {
    this.time += ms;
    for (;;) {
      const due = this.timers.filter((timer) => timer.at <= this.time);
      if (due.length === 0) return;
      for (const timer of due) {
        this.timers.splice(this.timers.indexOf(timer), 1);
        timer.run();
      }
    }
  }
}

const runner: InferenceRunner = {
  async run(): Promise<InferenceOutput> {
    return { items: [ModelMessageItem.rehydrate({ text: "unused" })], tokenUsage: undefined, rowResponse: undefined };
  },
  async *stream(): AsyncGenerator<SemanticEvent> {
    throw new Error("unused");
  },
};

const adapter = (executed: string[]): SimAdapter =>
  ({
    apply(intent: Intent) {
      executed.push(intent.action);
      return {
        intentId: intent.id,
        sourceIntentId: intent.id.split("#")[0] ?? intent.id,
        agent: intent.agent,
        action: intent.action,
        target: intent.target,
        params: intent.params,
        path: "loop" as const,
      };
    },
    lockEvidence(input: { targetId: string; holder: string; reason: string; ttlMs: number }) {
      return { ...input, until: 9_999 };
    },
  }) as SimAdapter;

const intent = (id: string, agent: string, action: Intent["action"]): Intent => ({
  id,
  agent,
  action,
  target: { kind: action === "snapshot" ? "host" : "host", id: "host-7" },
  params: {},
  ttlMs: 60_000,
  rationale: { eventId: "evt-1", citedFields: [], tainted: false },
  requestedAt: 1,
});

const boot = (clock: FakeClock, executed: string[], retries = 2) => {
  const state = new CustodyState();
  state.topology = demoTopology;
  state.capabilities = { "preserve-1": ["snapshot"], "contain-1": ["isolate"] };
  state.lockEvidence({
    targetId: "host-7",
    holder: "preserve-1",
    reason: "capture in flight",
    until: 90_000,
  });
  initializeRuntime({ state, inferenceRunnerConfig: { runner } });
  join(new Human({ id: "airlock", name: "Airlock", role: "human", capabilities: [] }, []));

  const context = (): InvariantContext => ({
    topology: demoTopology,
    locks: [...state.locks.values()],
    blastBudget: 0.08,
    knownEventIds: new Set(["evt-1"]),
    capabilities: state.capabilities,
    secondKey: new Set(),
    now: clock.now(),
  });

  const coordinator = new AirlockCoordinator({
    state,
    clock,
    windowMs: 10,
    adapter: adapter(executed),
    context,
    retryDelayMs: 5,
    retryCap: retries,
  });
  return { state, coordinator };
};

describe("the decision window", () => {
  test("duplicates are rejected, stale verdicts are not replayed, and defers retry to the cap", async () => {
    const clock = new FakeClock();
    const executed: string[] = [];
    const { state, coordinator } = boot(clock, executed, 2);

    const first = coordinator.decide(intent("i-dup", "preserve-1", "snapshot"), "loop-a");
    const second = coordinator.decide(intent("i-dup", "contain-1", "isolate"), "loop-b");
    clock.advance(10);

    expect((await first).kind).toBe("accept");
    expect((await second).kind).toBe("reject");
    expect((await second).reason).toContain("duplicate_intent");
    expect(executed).toEqual([]);
    expect(state.intents.get("i-dup")?.agent).toBe("preserve-1");

    const late = await coordinator.decide(intent("i-dup", "contain-1", "isolate"), "loop-c");
    expect(late.kind).toBe("reject");
    expect(executed).toEqual([]);

    const waiting = coordinator.decide(intent("i-wait", "contain-1", "isolate"), "loop-d");
    clock.advance(10);
    expect((await waiting).kind).toBe("defer");
    expect(executed).toEqual([]);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      clock.advance(5);
      clock.advance(10);
    }
    clock.advance(5);
    clock.advance(10);

    expect(state.firstDecisions.get("i-wait")?.kind).toBe("defer");
    expect(state.decisions.get("i-wait")?.kind).toBe("reject");
    expect(state.decisions.get("i-wait")?.reason).toContain("retry cap");
    expect(executed).toEqual([]);
  });
});
