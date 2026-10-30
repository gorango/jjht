/**
 * The Mozaik adapter for the airlock.
 *
 * Verified against the workspace's `@mozaik-ai/core` (v4.1.0):
 *   - `runLoop(agentId, message, input, interceptionHandler?)`
 *   - `InterceptionHandler.handle(transition)` is awaited inside the loop, so it
 *     can hold a pending `act` call while peer intents arrive.
 *   - the `function_call` transition carries `input.call`, and
 *     `FunctionCallItem.rehydrate` substitutes the arguments.
 */
import {
  FunctionCallItem,
  type ExecutableTransition,
  type InterceptionHandler,
} from "@mozaik-ai/core";

import { ACTIONS } from "../domain/registry.js";
import { rationaleFrom } from "../domain/taint.js";
import type { ActionName, Decision, Intent, Rationale, Target, TargetKind } from "../domain/types.js";
import type { Clock, Timer } from "../runtime/clock.js";
import { publish } from "../runtime/ingest.js";
import { currentLoop } from "../runtime/loops.js";
import type { CustodyState } from "../runtime/state.js";
import type { AirlockCoordinator } from "./airlock-coordinator.js";

type FunctionCallTransition = Extract<ExecutableTransition, { nextStateId: "function_call" }>;

export interface LoopHandlerOptions {
  state: CustodyState;
  coordinator: AirlockCoordinator;
  clock: Clock;
  agentId: string;
  loopId: string;
  /** The handler's own fail-closed deadline; must exceed the decision window. */
  timeoutMs: number;
  toolName?: string;
}

export type ParsedIntent =
  | { ok: true; intent: Intent }
  | { ok: false; reason: string; intentId: string };

const TARGET_KINDS = new Set<TargetKind>(["service", "host", "edge", "secret", "artifact"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const params = (value: unknown): Record<string, string | number> => {
  if (!isRecord(value)) return {};
  const clean: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" || typeof raw === "number") clean[key] = raw;
  }
  return clean;
};

const citedFields = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((field): field is string => typeof field === "string") : [];

/**
 * The only place a tool argument becomes an Intent. The model can name a
 * telemetry id and fields; it cannot set `tainted`, which is recomputed from
 * the ingested event.
 */
export const intentFromArgs = (
  agentId: string,
  raw: unknown,
  state: CustodyState,
  clock: Clock,
  callId?: string,
): ParsedIntent => {
  const args = typeof raw === "string" ? safeJson(raw) : raw;
  if (!isRecord(args)) return { ok: false, reason: "invalid_intent", intentId: `${agentId}-unparsed` };

  const intentId = text(args.intentId) ?? `${agentId}-${callId ?? "call"}`;
  const action = text(args.action);
  if (!action || !(action in ACTIONS)) {
    return { ok: false, reason: "unknown_action", intentId };
  }

  if (!isRecord(args.target)) return { ok: false, reason: "invalid_intent", intentId };
  const kind = text(args.target.kind);
  const id = text(args.target.id);
  if (!kind || !TARGET_KINDS.has(kind as TargetKind) || !id) {
    return { ok: false, reason: "invalid_intent", intentId };
  }
  const target: Target = { kind: kind as TargetKind, id };

  const cited = isRecord(args.rationale) ? args.rationale : {};
  const eventId = text(cited.eventId) ?? "";
  const fields = citedFields(cited.citedFields);
  const note = text(cited.note);
  const event = state.telemetry.get(eventId);

  const rationale: Rationale = event
    ? rationaleFrom(event, fields, note)
    : { eventId, citedFields: fields, tainted: true, ...(note ? { note } : {}) };

  return {
    ok: true,
    intent: {
      id: intentId,
      agent: agentId,
      action: action as ActionName,
      target,
      params: params(args.params),
      ttlMs: number(args.ttlMs) ?? 60_000,
      rationale,
      requestedAt: clock.now(),
    },
  };
};

const safeJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export const serializeIntent = (intent: Intent): string =>
  JSON.stringify({
    intentId: intent.id,
    action: intent.action,
    target: intent.target,
    params: intent.params,
    ttlMs: intent.ttlMs,
    rationale: {
      eventId: intent.rationale.eventId,
      citedFields: intent.rationale.citedFields ?? [],
      ...(intent.rationale.note ? { note: intent.rationale.note } : {}),
    },
  });

const rewriteCall = (
  transition: FunctionCallTransition,
  name: string,
  args: string,
): ExecutableTransition => ({
  ...transition,
  input: {
    ...transition.input,
    call: FunctionCallItem.rehydrate({ callId: transition.input.call.callId, name, args }),
  },
});

const refuse = (
  transition: FunctionCallTransition,
  reason: string,
  kind: string,
  intentId: string,
): ExecutableTransition =>
  rewriteCall(
    transition,
    "refuse_action",
    JSON.stringify({ refused: true, reason, kind, intentId }),
  );

const timeoutDecision = (intent: Intent): Decision => ({
  intentId: intent.id,
  agent: intent.agent,
  action: intent.action,
  target: intent.target.id,
  kind: "reject",
  reason: "airlock_timeout",
  votes: [{ voter: "airlock", verdict: "veto", reason: "the decision window did not close" }],
});

const errorDecision = (intent: Intent): Decision => ({
  intentId: intent.id,
  agent: intent.agent,
  action: intent.action,
  target: intent.target.id,
  kind: "reject",
  reason: "airlock_error",
  votes: [{ voter: "airlock", verdict: "veto", reason: "the airlock failed closed" }],
});

export const createLoopAirlockHandler = (options: LoopHandlerOptions): InterceptionHandler => {
  const toolName = options.toolName ?? "act";

  const awaitDecision = async (intent: Intent, loopId: string): Promise<Decision> => {
    let timer: Timer | undefined;
    const timedOut = new Promise<Decision>((resolve) => {
      timer = options.clock.setTimer(options.timeoutMs, () => {
        options.coordinator.abandon(intent.id);
        publish("airlock.timeout", options.agentId, {
          agentId: options.agentId,
          loopId,
          intentId: intent.id,
        });
        resolve(timeoutDecision(intent));
      });
    });

    try {
      return await Promise.race([
        options.coordinator.decide(intent, loopId),
        timedOut,
      ]);
    } catch (error) {
      console.error(`custody: airlock failed for ${intent.id}: ${String(error)}`);
      return errorDecision(intent);
    } finally {
      timer?.cancel();
    }
  };

  return {
    isSatisfiedBy(transition) {
      return (
        transition.nextStateId === "function_call" && transition.input.call.name === toolName
      );
    },

    async handle(transition) {
      if (transition.nextStateId !== "function_call") return transition;
      const functionCall = transition as FunctionCallTransition;
      const call = functionCall.input.call;
      const loopId = currentLoop() ?? options.loopId;

      const parsed = intentFromArgs(
        options.agentId,
        call.args,
        options.state,
        options.clock,
        call.callId,
      );
      if (!parsed.ok) {
        return refuse(functionCall, parsed.reason, "reject", parsed.intentId);
      }

      const intent = parsed.intent;
      publish("intent.proposed", options.agentId, { intent, loopId });

      const decision = await awaitDecision(intent, loopId);

      if (decision.kind === "accept") return transition;

      if (decision.kind === "rewrite" && decision.final) {
        return rewriteCall(functionCall, call.name, serializeIntent(decision.final));
      }

      return refuse(functionCall, decision.reason, decision.kind, intent.id);
    },
  };
};
