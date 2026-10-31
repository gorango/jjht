/**
 * `reconcile` stays a pure function. Everything stateful about the window lives
 * here, and every transition is visible as a bus event.
 */
import type { Finding, InvariantContext } from "../domain/invariants.js";
import type { Decision, Intent } from "../domain/types.js";
import { applyIntent, type InfraAdapter } from "../infra/adapter.js";
import type { Clock, Timer } from "../runtime/clock.js";
import { publish } from "../runtime/ingest.js";
import type { CustodyState } from "../runtime/state.js";
import { reconcile } from "./airlock.js";

export interface WindowReport {
  windowId: string;
  inflight: number;
  loopIds: string[];
  lateByMs: number;
}

export interface AirlockCoordinatorOptions {
  state: CustodyState;
  clock: Clock;
  windowMs: number;
  adapter: InfraAdapter;
  /** The invariant context is rebuilt at each deadline so locks and second keys are current. */
  context: () => InvariantContext;
  producerId?: string;
  retryDelayMs?: number;
  retryCap?: number;
  agentCap?: number;
  windowCap?: number;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

interface Entry {
  intent: Intent;
  loopId?: string;
  retry: boolean;
  handler: boolean;
  settled: boolean;
  abandoned: boolean;
  deferred: Deferred<Decision>;
}

interface Window {
  incidentId: string;
  windowId: string;
  deadline: number;
  timer: Timer;
  entries: Map<string, Entry>;
}

const defer = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export class AirlockCoordinator {
  readonly windows: WindowReport[] = [];

  readonly findings: Finding[] = [];

  inflightMax = 0;

  private readonly pending = new Map<string, Entry>();

  private readonly decided = new Map<string, Decision>();

  private readonly open = new Map<string, Window>();

  private readonly sequences = new Map<string, number>();

  private readonly attempts = new Map<string, number>();

  private readonly retryTimers = new Set<Timer>();

  private readonly idleWaiters: Array<() => void> = [];

  /**
   * Effects started by a window close are not tied to a loop, and the close is
   * a sync timer callback. Track them so `whenIdle`/`shutdown` cannot report a
   * run as finished before the adapter has applied the effect.
   */
  private readonly inflight = new Set<Promise<void>>();

  private readonly producerId: string;

  private readonly retryDelayMs: number;

  private readonly retryCap: number;

  private readonly agentCap: number;

  private readonly windowCap: number;

  private active = true;

  constructor(private readonly options: AirlockCoordinatorOptions) {
    this.producerId = options.producerId ?? "airlock";
    this.retryDelayMs = options.retryDelayMs ?? 2_000;
    this.retryCap = options.retryCap ?? 3;
    this.agentCap = options.agentCap ?? 8;
    this.windowCap = options.windowCap ?? 32;
  }

  /** Called by a suspended handler after it publishes `intent.proposed`. */
  decide(intent: Intent, loopId: string): Promise<Decision> {
    // First proposal wins. Serving a cached decision to a second handler would
    // execute the second proposal's body under the first proposal's verdict.
    const prior = this.decided.get(intent.id);
    const existing = prior ? undefined : this.pending.get(intent.id);
    if (prior || existing) {
      const firstAgent = prior?.agent ?? existing?.intent.agent ?? "another agent";
      publish("intent.duplicate", this.producerId, {
        intentId: intent.id,
        loopId,
        agent: intent.agent,
        firstAgent,
      });
      return Promise.resolve({
        intentId: intent.id,
        agent: intent.agent,
        action: intent.action,
        target: intent.target.id,
        kind: "reject",
        reason: `duplicate_intent: ${intent.id} was already proposed by ${firstAgent}`,
        votes: [{ voter: "airlock", verdict: "veto", reason: "duplicate intent id" }],
      });
    }

    this.options.state.propose(intent);
    const current = this.open.get(this.incidentId());
    const agentPending = [...this.pending.values()].filter(
      (entry) => !entry.settled && entry.intent.agent === intent.agent,
    ).length;

    if (agentPending >= this.agentCap || (current?.entries.size ?? 0) >= this.windowCap) {
      return Promise.resolve(this.overflow(intent, current?.windowId));
    }

    const entry: Entry = {
      intent,
      ...(loopId ? { loopId } : {}),
      retry: false,
      handler: true,
      settled: false,
      abandoned: false,
      deferred: defer<Decision>(),
    };

    this.add(entry);
    return entry.deferred.promise;
  }

  abandon(intentId: string): void {
    const entry = this.pending.get(intentId);
    if (!entry || entry.settled) return;
    entry.abandoned = true;
    entry.settled = true;
    this.checkIdle();
  }

  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  async shutdown(): Promise<void> {
    this.active = false;
    for (const window of this.open.values()) window.timer.cancel();
    this.open.clear();
    for (const timer of this.retryTimers) timer.cancel();
    this.retryTimers.clear();
    this.idleWaiters.splice(0).forEach((resolve) => resolve());
    await Promise.all([...this.inflight]);
  }

  private isIdle(): boolean {
    if (this.open.size > 0) return false;
    if (this.inflight.size > 0) return false;
    return ![...this.pending.values()].some((entry) => entry.handler && !entry.settled);
  }

  private checkIdle(): void {
    if (!this.isIdle()) return;
    this.idleWaiters.splice(0).forEach((resolve) => resolve());
  }

  private incidentId(): string {
    return [...this.options.state.incidents.values()].at(-1)?.id ?? "global";
  }

  private add(entry: Entry): void {
    const window = this.ensureWindow();
    this.pending.set(entry.intent.id, entry);
    window.entries.set(entry.intent.id, entry);
  }

  private ensureWindow(): Window {
    const incidentId = this.incidentId();
    return this.open.get(incidentId) ?? this.openWindow(incidentId);
  }

  private openWindow(incidentId: string): Window {
    const sequence = (this.sequences.get(incidentId) ?? 0) + 1;
    this.sequences.set(incidentId, sequence);

    const openedAt = this.options.clock.now();
    const deadline = openedAt + this.options.windowMs;
    const windowId = `${incidentId}#${sequence}`;

    let window: Window;
    const timer = this.options.clock.setTimer(this.options.windowMs, () => this.close(window));
    window = {
      incidentId,
      windowId,
      deadline,
      timer,
      entries: new Map(),
    };

    this.open.set(incidentId, window);
    publish("window.opened", this.producerId, {
      windowId,
      incidentId,
      deadline,
      windowMs: this.options.windowMs,
    });
    return window;
  }

  private close(window: Window): void {
    if (!this.active) return;
    if (this.open.get(window.incidentId) !== window) return;

    window.timer.cancel();
    this.open.delete(window.incidentId);

    const now = this.options.clock.now();
    const held = [...window.entries.values()].filter((entry) => entry.handler && !entry.settled);
    const loopIds = unique(
      held.map((entry) => entry.loopId).filter((id): id is string => typeof id === "string"),
    );
    const lateByMs = Math.max(0, Math.round(now - window.deadline));

    publish("window.closed", this.producerId, {
      windowId: window.windowId,
      inflight: held.length,
      loopIds,
      intentIds: [...window.entries.keys()],
      lateByMs,
    });

    const result = reconcile(
      [...window.entries.values()].map((entry) => entry.intent),
      this.options.context(),
    );
    this.findings.push(...result.findings);

    const report: WindowReport = {
      windowId: window.windowId,
      inflight: held.length,
      loopIds,
      lateByMs,
    };
    this.windows.push(report);
    this.inflightMax = Math.max(this.inflightMax, held.length);

    for (const decision of result.decisions) {
      this.decided.set(decision.intentId, decision);
      this.options.state.decide(decision);
      publish("decision.made", this.producerId, { decision, windowId: window.windowId });

      const entry = window.entries.get(decision.intentId);
      this.pending.delete(decision.intentId);
      if (!entry) continue;

      entry.settled = true;
      entry.deferred.resolve(decision);

      if (decision.kind === "defer") {
        this.scheduleRetry(entry, decision);
        continue;
      }
      // On a retry or after a timeout no handler is left to run the effect, so
      // the airlock executes the accepted intent through the shared port.
      if (entry.retry || entry.abandoned) this.track(this.execute(entry, decision));
    }

    this.checkIdle();
  }

  private overflow(intent: Intent, windowId: string | undefined): Decision {
    const decision: Decision = {
      intentId: intent.id,
      agent: intent.agent,
      action: intent.action,
      target: intent.target.id,
      kind: "reject",
      reason: "window_overflow: the pending cap for this agent or window was reached",
      votes: [{ voter: "airlock", verdict: "veto", reason: "pending intent cap" }],
    };
    this.decided.set(intent.id, decision);
    this.options.state.decide(decision);
    publish("decision.made", this.producerId, { decision, windowId: windowId ?? null });
    return decision;
  }

  private scheduleRetry(entry: Entry, decision: Decision): void {
    const intent = entry.intent;
    const attempt = (this.attempts.get(intent.id) ?? 0) + 1;
    this.attempts.set(intent.id, attempt);

    if (attempt > this.retryCap) {
      const exhausted: Decision = {
        intentId: intent.id,
        agent: intent.agent,
        action: intent.action,
        target: intent.target.id,
        kind: "reject",
        reason: `retry cap reached after ${this.retryCap} attempts: ${decision.reason}`,
        votes: decision.votes,
      };
      this.decided.set(intent.id, exhausted);
      this.options.state.decide(exhausted);
      publish("intent.exhausted", this.producerId, { intentId: intent.id, attempts: this.retryCap });
      publish("decision.made", this.producerId, { decision: exhausted, windowId: null });
      return;
    }

    const retryAt = this.options.clock.now() + this.retryDelayMs;
    publish("intent.deferred", this.producerId, {
      intentId: intent.id,
      reason: decision.reason,
      attempt,
      retryAt,
    });

    let timer: Timer;
    timer = this.options.clock.setTimer(
      Math.max(0, retryAt - this.options.clock.now()),
      () => {
        this.retryTimers.delete(timer);
        if (!this.active) return;
        publish("intent.retried", this.producerId, { intentId: intent.id, attempt });
        this.enqueueRetry(intent);
      },
      { unref: true },
    );
    this.retryTimers.add(timer);
  }

  private enqueueRetry(intent: Intent): void {
    const entry: Entry = {
      intent,
      retry: true,
      handler: false,
      settled: false,
      abandoned: false,
      deferred: defer<Decision>(),
    };

    const window = this.ensureWindow();
    window.entries.set(intent.id, entry);
    this.pending.set(intent.id, entry);
    this.checkIdle();
  }

  private async execute(entry: Entry, decision: Decision): Promise<void> {
    const intent = decision.kind === "rewrite" && decision.final ? decision.final : entry.intent;
    if (decision.kind === "accept" || decision.kind === "rewrite") {
      await applyIntent(this.options.adapter, intent, "airlock-retry", this.producerId);
    }
  }

  private track(promise: Promise<void>): void {
    this.inflight.add(promise);
    const settle = (): void => {
      this.inflight.delete(promise);
      this.checkIdle();
    };
    void promise.then(settle, settle);
  }
}
