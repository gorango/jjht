import type { Rationale, TelemetryEvent } from "./types.js";

/**
 * Taint is decided at ingestion, before any model sees the text (C10).
 *
 * A field is named, not a whole event: a network counter is trusted while the
 * HTTP host on the same event is not. Unknown sources are tainted by default.
 */
const TAINT_POLICY: Record<TelemetryEvent["source"], { tainted: string[]; trusted: string[] }> = {
  logs: { tainted: ["message", "body", "userAgent", "path", "query", "filename"], trusted: [] },
  auth: { tainted: ["username", "userAgent", "raw"], trusted: ["srcIp"] },
  runtime: { tainted: ["errorText", "stack"], trusted: ["health", "restartCount", "deploy", "latency"] },
  network: { tainted: ["httpHost", "httpUserAgent", "httpPath"], trusted: ["bytes", "packets", "connections"] },
  deploy: { tainted: [], trusted: ["*"] },
};

const TRUSTED_RUNTIME_KINDS = new Set(["health.check", "deploy.event", "restart.count", "latency.spike"]);

export const taintedFieldsFor = (event: Pick<TelemetryEvent, "source" | "kind">): string[] => {
  if (event.source === "runtime" && TRUSTED_RUNTIME_KINDS.has(event.kind)) return [];
  return [...(TAINT_POLICY[event.source]?.tainted ?? ["message"])];
};

export const ingestTelemetry = (event: TelemetryEvent): TelemetryEvent => {
  const taintedFields = event.taintedFields ?? taintedFieldsFor(event);
  return { ...event, taintedFields, tainted: taintedFields.length > 0 };
};

/** A cited field on a tainted event taints the rationale, whatever the model said. */
export const rationaleFrom = (
  event: Pick<TelemetryEvent, "id" | "taintedFields">,
  citedFields: readonly string[] = [],
  note?: string,
): Rationale => {
  const tainted =
    citedFields.length === 0
      ? (event.taintedFields?.length ?? 0) > 0
      : citedFields.some((field) => (event.taintedFields ?? []).includes(field));
  return { eventId: event.id, citedFields: [...citedFields], tainted, ...(note ? { note } : {}) };
};
