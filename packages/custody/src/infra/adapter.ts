/**
 * The infrastructure boundary. The airlock never touches a cluster directly;
 * an accepted intent is handed to an adapter, and only this layer produces
 * effects. The simulated adapter is deterministic and records everything it
 * applies, which is what the concurrency and no-action assertions read.
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

export interface InfraAdapter {
  apply(intent: Intent, path: ExecutedAction["path"]): ExecutedAction;
  lockEvidence(input: LockInput): EvidenceLock;
}

export class SimAdapter implements InfraAdapter {
  constructor(
    private readonly state: CustodyState,
    private readonly clock: Clock,
    /** Targets whose scenario declares an evidence capture in flight. */
    private readonly captureTargets: ReadonlySet<string> = new Set(),
  ) {}

  apply(intent: Intent, path: ExecutedAction["path"]): ExecutedAction {
    if (intent.action === "snapshot" && this.captureTargets.has(intent.target.id)) {
      this.lockEvidence({
        targetId: intent.target.id,
        holder: intent.agent,
        reason: "evidence capture in flight",
        ttlMs: 10_000,
      });
    }

    const executed: ExecutedAction = {
      intentId: intent.id,
      agent: intent.agent,
      action: intent.action,
      target: { ...intent.target },
      params: { ...intent.params },
      path,
    };
    this.state.executed.push(executed);
    publish("action.executed", intent.agent, { intent, path });
    return executed;
  }

  lockEvidence(input: LockInput): EvidenceLock {
    const lock: EvidenceLock = {
      targetId: input.targetId,
      holder: input.holder,
      reason: input.reason,
      until: this.clock.now() + input.ttlMs,
    };
    this.state.lockEvidence(lock);
    publish("evidence.locked", input.holder, { lock });
    return lock;
  }
}
