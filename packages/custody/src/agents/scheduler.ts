/**
 * Nothing here replays decisions; every decision is produced by the airlock's
 * window after the handlers have suspended.
 */
import {
  Agent,
  DeveloperMessageItem,
  Human,
  ModelContext,
  SituationSpecification,
  createAgent,
  type SituationContext,
  type Tool,
} from "@mozaik-ai/core";

import type { Finding, InvariantContext } from "../domain/invariants.js";
import { ACTIONS } from "../domain/registry.js";
import type { Decision, Intent } from "../domain/types.js";
import {
  applyIntent,
  SimAdapter,
  type AdapterKind,
  type EvidenceAnchor,
  type FailedAction,
  type InfraAdapter,
} from "../infra/adapter.js";
import { DockerAdapter, type DockerAdapterOptions } from "../infra/docker.js";
import { MockInferenceRunner } from "../inference/mock-runner.js";
import { scriptsFor } from "../inference/scripts.js";
import { realClock, type Clock } from "../runtime/clock.js";
import { ingest, publish } from "../runtime/ingest.js";
import {
  initializeRuntime,
  join,
  runLoop,
} from "../runtime/session.js";
import { CustodyState, type ExecutedAction, type Incident } from "../runtime/state.js";
import { Trace } from "../runtime/trace.js";
import type { Scenario } from "../scenarios/types.js";
import { AirlockCoordinator, type WindowReport } from "./airlock-coordinator.js";
import { createLoopAirlockHandler, intentFromArgs } from "./airlock-handler.js";
import { ROLE_PROMPTS, type Role } from "./roles.js";

export interface RunScenarioOptions {
  scenario: Scenario;
  windowMs: number;
  tracePath: string;
  verbose: boolean;
  clock?: Clock;
  adapter?: AdapterKind;
  evidenceRoot?: string;
  docker?: Omit<DockerAdapterOptions, "evidenceRoot">;
}

export interface ScenarioReport {
  scenario: Scenario;
  decisions: Decision[];
  windows: WindowReport[];
  inflightMax: number;
  loopIds: string[];
  executed: ExecutedAction[];
  expectedMatches: number;
  expectedTotal: number;
  tracePath: string;
  traceEvents: number;
  closed: boolean;
  noActionOutcome?: string;
  runner: "mock";
  costUsd: 0;
  findings: Finding[];
  adapter: AdapterKind;
  failed: FailedAction[];
  evidence: EvidenceAnchor[];
}

class BusEvent extends SituationSpecification {
  constructor(private readonly type: string) {
    super();
  }

  override isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === this.type;
  }
}

const ROLE_PATTERNS: Array<[RegExp, Role]> = [
  [/^watch/, "watch"],
  [/^triage/, "triage"],
  [/^contain/, "contain"],
  [/^preserve/, "preserve"],
  [/^availability/, "availability"],
  [/^scribe/, "scribe"],
];

const roleFor = (agentId: string): Role | undefined =>
  ROLE_PATTERNS.find(([pattern]) => pattern.test(agentId))?.[1];

const instructionFor = (agentId: string): string => {
  const role = roleFor(agentId);
  if (role) return ROLE_PROMPTS[role];
  return (
    `[[role:${agentId}]] You are ${agentId}. Propose actions only from the closed schema ` +
    `(block_egress, unblock_egress, isolate, release, snapshot, drain_node, revoke_token, scale). ` +
    `Every proposal needs a telemetry event id. The airlock decides; you do not act.`
  );
};

// The offline runner is the only runner. Naming a provider model here would put
// a call that never happened into every inference span in the trace.
const modelFor = (_agentId: string): string => "mock";

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const makeHuman = (
  id: string,
  name: string,
  handlers: Array<{
    specification: SituationSpecification;
    processor: { apply: (context: SituationContext) => void | Promise<void> };
  }>,
): Human => new Human({ id, name, role: "human", capabilities: [] }, handlers);

const makeAgent = (
  id: string,
  capabilities: readonly string[],
  tools: Tool[],
): Agent => {
  const instruction = instructionFor(id);
  // `createAgent` generates its own id; the run needs stable participant ids so
  // the trace table, capabilities and `sendEvent` all agree on one identity.
  const seed = createAgent({ name: id, capabilities, instruction, tools, handlers: [] });
  return new Agent(
    { id, name: id, role: "agent", capabilities },
    instruction,
    tools,
    seed.getMemory(),
    [],
  );
};

const refuseActionTool = (): Tool => ({
  type: "function",
  name: "refuse_action",
  description: "Record that an action was refused. It has no side effects.",
  parameters: {
    type: "object",
    properties: {
      reason: { type: "string" },
      kind: { type: "string" },
      intentId: { type: "string" },
    },
  },
  strict: false,
  async invoke(raw) {
    const args = (raw ?? {}) as Record<string, unknown>;
    return {
      refused: true,
      reason: text(args.reason) ?? "denied by the airlock",
      intentId: text(args.intentId) ?? "",
    };
  },
});

const actTool = (agentId: string, state: CustodyState, clock: Clock, adapter: InfraAdapter): Tool => ({
  type: "function",
  name: "act",
  description:
    "Propose one typed action. The call is intercepted and decided by the airlock before it runs.",
  parameters: {
    type: "object",
    properties: {
      intentId: { type: "string" },
      action: { type: "string", enum: Object.keys(ACTIONS) },
      target: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["service", "host", "edge", "secret", "artifact"] },
          id: { type: "string" },
        },
        required: ["kind", "id"],
      },
      params: { type: "object" },
      ttlMs: { type: "number" },
      rationale: {
        type: "object",
        properties: {
          eventId: { type: "string" },
          citedFields: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
      },
    },
    required: ["action", "target"],
  },
  strict: false,
  async invoke(raw) {
    const parsed = intentFromArgs(agentId, raw, state, clock);
    if (!parsed.ok) {
      return { executed: false, refused: true, reason: parsed.reason, intentId: parsed.intentId };
    }
    const outcome = await applyIntent(adapter, parsed.intent, "loop", agentId);
    if (!outcome.executed) {
      return {
        executed: false,
        failed: true,
        intentId: parsed.intent.id,
        reason: outcome.failed?.reason ?? "adapter failed",
        path: "loop",
      };
    }
    const executed = outcome.executed;
    return {
      executed: true,
      intentId: executed.intentId,
      action: executed.action,
      target: executed.target.id,
      path: executed.path,
    };
  },
});

const reportIncidentTool = (agentId: string, state: CustodyState, clock: Clock): Tool => ({
  type: "function",
  name: "report_incident",
  description: "Open an incident from one telemetry event. Watch has no authority to act.",
  parameters: {
    type: "object",
    properties: {
      telemetryId: { type: "string" },
      severity: { type: "string", enum: ["low", "medium", "high"] },
      summary: { type: "string" },
    },
    required: ["telemetryId", "summary"],
  },
  strict: false,
  async invoke(raw) {
    const args = (raw ?? {}) as Record<string, unknown>;
    const telemetryId = text(args.telemetryId) ?? "";
    const incidentId = `inc-${state.incidents.size + 1}`;
    const incident: Incident = {
      id: incidentId,
      openedAt: clock.now(),
      phase: "watch",
      telemetryIds: telemetryId ? [telemetryId] : [],
      intentIds: [],
      decisionIds: [],
    };
    state.incidents.set(incidentId, incident);
    publish("incident.opened", agentId, {
      incidentId,
      telemetryId,
      severity: text(args.severity) ?? "high",
      summary: text(args.summary) ?? "",
    });
    return { incidentId, telemetryId };
  },
});

const lockEvidenceTool = (agentId: string, state: CustodyState, adapter: InfraAdapter): Tool => ({
  type: "function",
  name: "lock_evidence",
  description: "Hold a target while evidence is captured. Destructive actions must wait.",
  parameters: {
    type: "object",
    properties: {
      targetId: { type: "string" },
      targetKind: { type: "string" },
      reason: { type: "string" },
      ttlMs: { type: "number" },
    },
    required: ["targetId"],
  },
  strict: false,
  async invoke(raw) {
    const args = (raw ?? {}) as Record<string, unknown>;
    if (!(state.capabilities[agentId] ?? []).includes("snapshot")) {
      return { locked: false, reason: `capability: ${agentId} does not hold snapshot` };
    }
    const lock = adapter.lockEvidence({
      targetId: text(args.targetId) ?? "",
      holder: agentId,
      reason: text(args.reason) ?? "evidence capture in flight",
      ttlMs: number(args.ttlMs) ?? 10_000,
    });
    return { locked: true, targetId: lock.targetId, holder: lock.holder, until: lock.until };
  },
});

const countDecisions = (state: CustodyState): string => {
  const counts = { accept: 0, rewrite: 0, defer: 0, reject: 0 };
  for (const decision of state.decisions.values()) counts[decision.kind] += 1;
  return (
    `${counts.accept} accepted, ${counts.rewrite} rewritten, ` +
    `${counts.defer} deferred, ${counts.reject} rejected`
  );
};

export const runScenario = async (options: RunScenarioOptions): Promise<ScenarioReport> => {
  const clock = options.clock ?? realClock;
  const scenario = options.scenario;

  const state = new CustodyState();
  state.config = { ...state.config, windowMs: options.windowMs, mock: true };
  state.topology = scenario.topology;
  state.capabilities = { ...scenario.capabilities };
  for (const intentId of scenario.secondKeyIntentIds) state.secondKey.add(intentId);

  const runner = new MockInferenceRunner(scriptsFor(scenario), clock);
  initializeRuntime({ state, inferenceRunnerConfig: { runner } });

  const trace = new Trace(options.tracePath);
  trace.observe();

  const captureTargets = new Set(scenario.locks.map((lock) => lock.targetId));
  const adapterKind = options.adapter ?? "sim";
  const adapter: InfraAdapter =
    adapterKind === "docker"
      ? new DockerAdapter(state, clock, {
          ...options.docker,
          evidenceRoot: options.evidenceRoot ?? "evidence",
        })
      : new SimAdapter(state, clock, captureTargets);
  const context = (): InvariantContext => ({
    topology: state.topology ?? scenario.topology,
    locks: [...state.locks.values()],
    blastBudget: scenario.blastBudget,
    knownEventIds: new Set(state.telemetry.keys()),
    capabilities: state.capabilities,
    secondKey: new Set(state.secondKey),
    executable: scenario.executable ?? true,
    now: clock.now(),
  });

  const coordinator = new AirlockCoordinator({
    state,
    clock,
    windowMs: options.windowMs,
    adapter,
    context,
  });

  join(makeHuman("airlock", "Airlock", []));
  join(makeHuman("human-1", "Human", []));
  publish("run.started", "airlock", {
    scenario: scenario.id,
    runner: "mock",
    costUsd: 0,
    mock: true,
    windowMs: options.windowMs,
  });

  const toolsByAgent = new Map<string, Tool[]>();
  const proposerIds = [...new Set(scenario.intents.map((intent) => intent.agent))];
  const needsLock = new Set(
    scenario.intents.filter((intent) => intent.action === "snapshot").map((intent) => intent.agent),
  );

  for (const agentId of proposerIds) {
    const tools: Tool[] = [actTool(agentId, state, clock, adapter), refuseActionTool()];
    if (needsLock.has(agentId) || roleFor(agentId) === "preserve") {
      tools.push(lockEvidenceTool(agentId, state, adapter));
    }
    toolsByAgent.set(agentId, tools);
    join(makeAgent(agentId, scenario.capabilities[agentId] ?? [], tools));
  }

  const watchTools: Tool[] = [
    actTool("watch", state, clock, adapter),
    refuseActionTool(),
    reportIncidentTool("watch", state, clock),
  ];
  toolsByAgent.set("watch", watchTools);
  join(makeAgent("watch", scenario.capabilities.watch ?? [], watchTools));

  let loopCounter = 0;
  let closedOutcome: string | undefined;

  const launch = (intent: Intent): string => {
    const agentId = intent.agent;
    const loopId = `loop-${(loopCounter += 1)}`;
    const stepId = `step-${intent.id}`;
    const loopContext = ModelContext.create();
    loopContext.addContextItem(DeveloperMessageItem.create(instructionFor(agentId)));
    const handler = createLoopAirlockHandler({
      state,
      coordinator,
      clock,
      agentId,
      loopId,
      timeoutMs: options.windowMs + 1_000,
    });

    runLoop(
      agentId,
      JSON.stringify({ stepId, agentId }),
      {
        model: modelFor(agentId),
        context: loopContext,
        tools: toolsByAgent.get(agentId) ?? [],
        maxOutputTokens: 256,
      },
      handler,
    );
    return loopId;
  };

  const triage = makeHuman("triage", "Triage", [
    {
      specification: new BusEvent("incident.opened"),
      processor: {
        apply({ event }) {
          const payload = event.payload as { incidentId?: unknown };
          const incidentId = text(payload.incidentId);
          if (!incidentId) return;
          const incident = state.incidents.get(incidentId);

          if (scenario.intents.length === 0) {
            if (incident) incident.phase = "triage";
            publish("incident.triaged", "triage", {
              incidentId,
              noActionReason:
                scenario.noActionReason ?? "the evidence does not support an action",
            });
            return;
          }

          if (incident) incident.phase = "act";
          publish("incident.triaged", "triage", { incidentId });
          for (const intent of scenario.intents) launch(intent);
        },
      },
    },
  ]);
  join(triage);

  const scribe = makeHuman("scribe-1", "Scribe", [
    {
      specification: new BusEvent("incident.triaged"),
      processor: {
        apply({ event }) {
          const payload = event.payload as { incidentId?: unknown; noActionReason?: unknown };
          const reason = text(payload.noActionReason);
          if (!reason) return;
          const incidentId = text(payload.incidentId) ?? "inc-1";
          const incident = state.incidents.get(incidentId);
          if (incident) incident.phase = "closed";
          closedOutcome = `no action: ${reason}`;
          publish("incident.closed", "scribe-1", {
            incidentId,
            outcome: closedOutcome,
          });
        },
      },
    },
  ]);
  join(scribe);

  ingest(state, "watch", scenario.telemetry);

  const watchLoopId = `loop-${(loopCounter += 1)}`;
  const watchContext = ModelContext.create();
  watchContext.addContextItem(DeveloperMessageItem.create(instructionFor("watch")));
  const watchHandler = createLoopAirlockHandler({
    state,
    coordinator,
    clock,
    agentId: "watch",
    loopId: watchLoopId,
    timeoutMs: options.windowMs + 1_000,
  });
  runLoop(
    "watch",
    JSON.stringify({ stepId: "watch", agentId: "watch" }),
    {
      model: modelFor("watch"),
      context: watchContext,
      tools: watchTools,
      maxOutputTokens: 256,
    },
    watchHandler,
  );

  await runner.waitFor("watch");

  if (scenario.intents.length > 0) {
    await Promise.all(scenario.intents.map((intent) => runner.waitFor(`step-${intent.id}`)));
    await coordinator.whenIdle();

    const incident = [...state.incidents.values()].at(-1);
    if (incident) {
      incident.phase = "closed";
      closedOutcome = `resolved: ${countDecisions(state)}`;
      publish("incident.closed", "scribe-1", {
        incidentId: incident.id,
        outcome: closedOutcome,
      });
    }
  } else {
    await coordinator.whenIdle();
  }

  await coordinator.shutdown();

  const expected = Object.entries(scenario.expected);
  const expectedMatches = expected.filter(
    ([intentId, kind]) => state.firstDecisions.get(intentId)?.kind === kind,
  ).length;

  const loopIds = [
    ...new Set(coordinator.windows.flatMap((window) => window.loopIds)),
  ];

  return {
    scenario,
    decisions: [...state.firstDecisions.values()],
    windows: coordinator.windows,
    inflightMax: coordinator.inflightMax,
    loopIds,
    executed: [...state.executed],
    expectedMatches,
    expectedTotal: expected.length,
    tracePath: trace.file,
    traceEvents: trace.rows.length,
    closed: closedOutcome !== undefined,
    ...(scenario.intents.length === 0 && closedOutcome
      ? { noActionOutcome: closedOutcome }
      : {}),
    runner: "mock",
    costUsd: 0,
    findings: coordinator.findings,
    adapter: adapterKind,
    failed: trace.rows
      .filter((row) => row.type === "action.failed")
      .map((row) => row.payload as FailedAction),
    evidence: trace.rows
      .filter((row) => row.type === "evidence.anchored")
      .map((row) => row.payload as EvidenceAnchor),
  };
};
