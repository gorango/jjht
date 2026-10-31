/**
 * The bus boundary. External telemetry enters here (taint is computed before
 * any participant sees the text), and internal events whose payload is wider
 * than the typed catalogue are published here.
 *
 * `sendEvent` rejects a producer that was never joined, so every caller passes
 * a participant id from `scheduler.ts`.
 */
import { SemanticEvent } from "@mozaik-ai/core";

import { ingestTelemetry as withTaint } from "../domain/taint.js";
import type { TelemetryEvent } from "../domain/types.js";
import { emit } from "./events.js";
import { sendEvent } from "./session.js";
import type { CustodianState } from "./state.js";

export const publish = (type: string, producerId: string, payload: unknown): void => {
  sendEvent(SemanticEvent.create(type, producerId, payload), producerId);
};

export const ingest = (
  state: CustodianState,
  producerId: string,
  events: readonly TelemetryEvent[],
): void => {
  for (const event of events) {
    const ingested = withTaint(event);
    state.ingest(ingested);
    emit("telemetry.received", producerId, { event: ingested });
  }
};
