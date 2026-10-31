/**
 * The infrastructure boundary. The airlock never touches a cluster directly;
 * an accepted intent is handed to an adapter, and only this layer produces
 * effects. The simulated adapter is deterministic and records everything it
 * applies, which is what the concurrency and no-action assertions read.
 *
 * `apply` is async because a real adapter takes seconds. Every caller awaits
 * it, and a rejection is recorded as `action.failed` and never enters
 * `state.executed` (C05).
 */
import type { EvidenceLock, Intent } from "../domain/types.js";
import type { Clock } from "../runtime/clock.js";
import { publish } from "../runtime/ingest.js";
import type { CustodyState, ExecutedAction } from "../runtime/state.js";

export interface LockInput {
  targetId: string;
  holder: string;
  reason: string;
  ttlMs: number;
}

export type AdapterKind = "sim" | "docker";

export interface FailedAction {
  intentId: string;
  path: ExecutedAction["path"];
  reason: string;
}

export interface EvidenceAnchor {
  bundle: string;
  anchor: string;
}

export interface InfraAdapter {
  apply(intent: Intent, path: ExecutedAction["path"]): Promise<ExecutedAction>;
  lockEvidence(input: LockInput): EvidenceLock;
}

/** A boundary failure with a stable, greppable reason code. */
export class AdapterError extends Error {
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "AdapterError";
  }
}

export const failureReason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export interface ApplyResult {
  executed?: ExecutedAction;
  failed?: FailedAction;
}

/**
 * The one place an adapter rejection becomes a bus event. A failed effect is
 * recorded, not executed: `state.executed` stays untouched.
 */
export const applyIntent = async (
  adapter: InfraAdapter,
  intent: Intent,
  path: ExecutedAction["path"],
  producerId: string,
): Promise<ApplyResult> => {
  try {
    return { executed: await adapter.apply(intent, path) };
  } catch (error) {
    const failed: FailedAction = { intentId: intent.id, path, reason: failureReason(error) };
    publish("action.failed", producerId, failed);
    return { failed };
  }
};

export const recordExecution = (
  state: CustodyState,
  intent: Intent,
  path: ExecutedAction["path"],
): ExecutedAction => {
  const executed: ExecutedAction = {
    intentId: intent.id,
    sourceIntentId: intent.id.split("#")[0] ?? intent.id,
    agent: intent.agent,
    action: intent.action,
    target: { ...intent.target },
    params: { ...intent.params },
    path,
  };
  state.executed.push(executed);
  publish("action.executed", intent.agent, { intent, path });
  return executed;
};

export const recordLock = (
  state: CustodyState,
  clock: Clock,
  input: LockInput,
): EvidenceLock => {
  const lock: EvidenceLock = {
    targetId: input.targetId,
    holder: input.holder,
    reason: input.reason,
    until: clock.now() + input.ttlMs,
  };
  state.lockEvidence(lock);
  publish("evidence.locked", input.holder, { lock });
  return lock;
};

export class SimAdapter implements InfraAdapter {
  constructor(
    private readonly state: CustodyState,
    private readonly clock: Clock,
    /** Targets whose scenario declares an evidence capture in flight. */
    private readonly captureTargets: ReadonlySet<string> = new Set(),
  ) {}

  async apply(intent: Intent, path: ExecutedAction["path"]): Promise<ExecutedAction> {
    if (intent.action === "snapshot" && this.captureTargets.has(intent.target.id)) {
      this.lockEvidence({
        targetId: intent.target.id,
        holder: intent.agent,
        reason: "evidence capture in flight",
        ttlMs: 10_000,
      });
    }

    return recordExecution(this.state, intent, path);
  }

  lockEvidence(input: LockInput): EvidenceLock {
    return recordLock(this.state, this.clock, input);
  }
}
