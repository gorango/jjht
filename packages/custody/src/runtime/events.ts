/**
 * Domain events. Everything interesting on the bus is one of these; the trace
 * observer records all of them, and the viewer replays them.
 */
import { SemanticEvent } from "@mozaik-ai/core";

import type { Decision, EvidenceLock, Intent, TelemetryEvent } from "../domain/types.js";
import { sendEvent } from "./session.js";

export interface EventMap {
  "telemetry.received": { event: TelemetryEvent };

  "intent.proposed": { intent: Intent };
  "intent.deferred": { intentId: string; reason: string };
  "decision.made": { decision: Decision };

  "evidence.locked": { lock: EvidenceLock };
  "evidence.released": { targetId: string; holder: string };

  "incident.opened": { incidentId: string; telemetryId: string };
  "incident.closed": { incidentId: string; outcome: string };

  "repo.issue.filed": { issue: string; repo: string; url?: string };
  "repo.pr.requested": { goal: string; issue: string };

  "run.completed": { accepted: number; rewritten: number; deferred: number; rejected: number };
}

export const emit = <K extends keyof EventMap>(
  type: K,
  producerId: string,
  payload: EventMap[K],
): void => {
  sendEvent(SemanticEvent.create(type, producerId, payload), producerId);
};
