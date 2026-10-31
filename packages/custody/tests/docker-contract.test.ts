import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Human, SituationSpecification, type SemanticEvent } from "@mozaik-ai/core";

import { AirlockCoordinator } from "../src/agents/airlock-coordinator.js";
import type { InvariantContext } from "../src/domain/invariants.js";
import { demoTopology } from "../src/domain/topology.js";
import type { Intent } from "../src/domain/types.js";
import {
  applyIntent,
  SimAdapter,
  type InfraAdapter,
  type LockInput,
} from "../src/infra/adapter.js";
import { canonicalJson, DockerAdapter } from "../src/infra/docker.js";
import { realClock, type Clock, type Timer, type TimerOptions } from "../src/runtime/clock.js";
import { initializeRuntime, join as joinParticipant } from "../src/runtime/session.js";
import { CustodyState, type ExecutedAction } from "../src/runtime/state.js";

const root = resolve(import.meta.dir, "..");
const dockerEnabled = process.env.CUSTODY_DOCKER === "1";

if (!dockerEnabled) {
  console.warn(
    "docker contract: skipped; set CUSTODY_DOCKER=1 to start the Compose stack and verify the real ingress 403",
  );
}

let runtimeBooted = false;
const bootRuntime = (): void => {
  if (runtimeBooted) return;
  try {
    initializeRuntime({ state: new CustodyState() });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Runtime already initialized") throw error;
  }
  runtimeBooted = true;
};

let observerSeq = 0;
class Everything extends SituationSpecification {
  override isSatisfiedBy(): boolean {
    return true;
  }
}

const observe = (): SemanticEvent[] => {
  bootRuntime();
  const events: SemanticEvent[] = [];
  const id = `contract-observer-${(observerSeq += 1)}`;
  joinParticipant(
    new Human({ id, name: id, role: "human", capabilities: ["observe"] }, [
      {
        specification: new Everything(),
        processor: { apply: ({ event }) => { events.push(event); } },
      },
    ]),
  );
  return events;
};

const joined = new Set<string>();
const joinProducer = (id: string): void => {
  bootRuntime();
  if (joined.has(id)) return;
  joinParticipant(new Human({ id, name: id, role: "human", capabilities: [] }, []));
  joined.add(id);
};

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

const intent = (
  id: string,
  agent: string,
  action: Intent["action"],
  target: Intent["target"],
  params: Record<string, string | number> = {},
): Intent => ({
  id,
  agent,
  action,
  target,
  params,
  ttlMs: 60_000,
  rationale: { eventId: "evt-1", citedFields: [], tainted: false },
  requestedAt: 1,
});

const executedAction = (intentValue: Intent, path: ExecutedAction["path"]): ExecutedAction => ({
  intentId: intentValue.id,
  sourceIntentId: intentValue.id.split("#")[0] ?? intentValue.id,
  agent: intentValue.agent,
  action: intentValue.action,
  target: { ...intentValue.target },
  params: { ...intentValue.params },
  path,
});

const bootCoordinator = (clock: FakeClock, adapter: InfraAdapter) => {
  const state = new CustodyState();
  state.topology = demoTopology;
  state.capabilities = { "preserve-1": ["snapshot"], "contain-1": ["isolate"] };
  state.lockEvidence({
    targetId: "host-empty",
    holder: "preserve-1",
    reason: "capture in flight",
    until: 1_015,
  });

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
    adapter,
    context,
    retryDelayMs: 5,
    retryCap: 3,
    producerId: "airlock-contract",
  });
  return { state, coordinator };
};

const gatedAdapter = () => {
  let release!: () => void;
  const gate = new Promise<void>((settle) => { release = settle; });
  const applied: string[] = [];
  const adapter: InfraAdapter = {
    async apply(intentValue, path) {
      await gate;
      applied.push(intentValue.id);
      return executedAction(intentValue, path);
    },
    lockEvidence(input: LockInput) {
      return { ...input, until: 9_999 };
    },
  };
  return { adapter, applied, release };
};

const armRetry = (clock: FakeClock, coordinator: AirlockCoordinator): Promise<unknown> => {
  const first = coordinator.decide(
    intent("i-wait", "contain-1", "isolate", { kind: "host", id: "host-empty" }),
    "loop-a",
  );
  clock.advance(10);
  clock.advance(5);
  clock.advance(10);
  return first;
};

describe("the adapter seam", () => {
  test("whenIdle waits for an apply the airlock started", async () => {
    joinProducer("airlock-contract");
    joinProducer("contain-1");
    const clock = new FakeClock();
    const { adapter, applied, release } = gatedAdapter();
    const { coordinator } = bootCoordinator(clock, adapter);

    const first = armRetry(clock, coordinator);
    expect((await first as { kind: string }).kind).toBe("defer");

    let settled = false;
    const idle = coordinator.whenIdle().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(applied).toEqual([]);

    release();
    await idle;
    expect(applied).toEqual(["i-wait"]);
    await coordinator.shutdown();
  });

  test("shutdown waits for an in-flight apply", async () => {
    joinProducer("airlock-contract");
    joinProducer("contain-1");
    const clock = new FakeClock();
    const { adapter, applied, release } = gatedAdapter();
    const { coordinator } = bootCoordinator(clock, adapter);

    const first = armRetry(clock, coordinator);
    expect((await first as { kind: string }).kind).toBe("defer");

    let done = false;
    const shutdown = coordinator.shutdown().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);

    release();
    await shutdown;
    expect(applied).toEqual(["i-wait"]);
  });

  test("an adapter rejection publishes action.failed and is not executed", async () => {
    joinProducer("airlock-contract");
    joinProducer("contain-1");
    const events = observe();
    const state = new CustodyState();
    const adapter: InfraAdapter = {
      async apply() {
        throw new Error("not_supported: drain_node has no Docker mapping in this slice");
      },
      lockEvidence(input: LockInput) {
        return { ...input, until: 9_999 };
      },
    };

    const outcome = await applyIntent(
      adapter,
      intent("i-drain", "contain-1", "drain_node", { kind: "host", id: "host-7" }),
      "loop",
      "airlock-contract",
    );

    expect(outcome.executed).toBeUndefined();
    expect(outcome.failed?.reason).toContain("not_supported");
    expect(state.executed).toHaveLength(0);
    const failed = events.find((event) => event.type === "action.failed");
    expect(failed?.payload).toEqual({
      intentId: "i-drain",
      path: "loop",
      reason: "not_supported: drain_node has no Docker mapping in this slice",
    });
  });
});

const project = "custody-contract";
const edgePort = "18080";
const subnet = "203.0.114.0/24";
const probeIp = "203.0.114.9";
const probeImage = "curlimages/curl:8.10.0";
const composeFile = resolve(root, "docker/compose.yaml");
const includeFile = resolve(root, "docker/edge/include/deny.conf");
const evidenceRoot = dockerEnabled ? mkdtempSync(join(tmpdir(), "custody-contract-evidence-")) : "";
let initialInclude = "";

const compose = (args: string[]) =>
  Bun.spawnSync({
    cmd: ["docker", "compose", "-p", project, "-f", composeFile, ...args],
    cwd: root,
    env: { ...process.env, CUSTODY_EDGE_PORT: edgePort, CUSTODY_DOCKER_SUBNET: subnet },
    stdout: "pipe",
    stderr: "pipe",
  });

const probe = (from: string) =>
  Bun.spawnSync({
    cmd: [
      "docker", "run", "--rm", "--network", `${project}_custody`, "--ip", from, probeImage,
      "-sS", "-o", "/dev/null", "-w", "%{http_code}", "http://edge/checkout",
    ],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });

const contractState = (): CustodyState => {
  const state = new CustodyState();
  state.topology = demoTopology;
  state.incidents.set("inc-1", {
    id: "inc-1",
    openedAt: 1_000,
    phase: "act",
    telemetryIds: [],
    intentIds: [],
    decisionIds: [],
  });
  return state;
};

const docker = (state: CustodyState): DockerAdapter =>
  new DockerAdapter(state, realClock, {
    evidenceRoot,
    composeFile,
    project,
    probeFrom: probeIp,
    probeImage,
  });

const block = intent("i-block", "contain-1", "block_egress", { kind: "edge", id: "edge" }, {
  cidr: `${probeIp}/32`,
  suspect: probeIp,
});
const snapshot = intent("i-snapshot", "preserve-1", "snapshot", { kind: "host", id: "host-7" });
const scale = intent("i-scale", "availability-1", "scale", { kind: "service", id: "checkout" }, {
  replicas: 2,
  from: 1,
});
const unblock = intent("i-unblock", "contain-1", "unblock_egress", { kind: "edge", id: "edge" }, {
  cidr: `${probeIp}/32`,
});

const applySequence = async (
  adapter: InfraAdapter,
  afterBlock?: () => void,
): Promise<void> => {
  await adapter.lockEvidence({
    targetId: "host-7",
    holder: "preserve-1",
    reason: "contract capture",
    ttlMs: 60_000,
  });
  await adapter.apply(block, "loop");
  afterBlock?.();
  await adapter.apply(snapshot, "loop");
  await adapter.apply(scale, "loop");
  await adapter.apply(unblock, "loop");
};

describe.skipIf(!dockerEnabled)(
  "the Docker adapter contract (set CUSTODY_DOCKER=1 to run)",
  () => {
    beforeAll(async () => {
      process.env.CUSTODY_EDGE_PORT = edgePort;
      process.env.CUSTODY_DOCKER_SUBNET = subnet;
      initialInclude = readFileSync(includeFile, "utf8");

      const up = compose(["up", "-d"]);
      if (up.exitCode !== 0) {
        throw new Error(`docker compose up failed: ${up.stderr.toString()}`);
      }

      let status = 0;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
          status = (await fetch(`http://127.0.0.1:${edgePort}/checkout`)).status;
        } catch {
          status = 0;
        }
        if (status === 200) return;
        await Bun.sleep(250);
      }
      throw new Error(`edge did not return 200 before any block (last ${status})`);
    }, 180_000);

    afterAll(() => {
      writeFileSync(includeFile, initialInclude);
      const down = compose(["down", "-v"]);
      if (down.exitCode !== 0) {
        console.warn(`docker contract: compose down failed: ${down.stderr.toString()}`);
      }
      if (evidenceRoot) rmSync(evidenceRoot, { recursive: true, force: true });
    }, 120_000);

    test("the same sequence executes on Sim and Docker and the bundle verifies", async () => {
      joinProducer("airlock-contract");
      joinProducer("contain-1");
      joinProducer("preserve-1");
      joinProducer("availability-1");

      const simState = contractState();
      const dockerState = contractState();
      const sim = new SimAdapter(simState, realClock);
      const dockerAdapter = docker(dockerState);

      await applySequence(sim);
      await applySequence(dockerAdapter, () => {
        const blocked = probe(probeIp);
        expect(blocked.stdout.toString().trim(), blocked.stderr.toString()).toBe("403");
      });

      expect(simState.executed.map((effect) => effect.action)).toEqual([
        "block_egress",
        "snapshot",
        "scale",
        "unblock_egress",
      ]);
      expect(dockerState.executed.map((effect) => effect.action)).toEqual(
        simState.executed.map((effect) => effect.action),
      );

      const afterUnblock = probe(probeIp);
      expect(afterUnblock.stdout.toString().trim(), afterUnblock.stderr.toString()).toBe("200");
      expect(readFileSync(includeFile, "utf8")).toBe(initialInclude);

      const appContainers = compose(["ps", "-q", "app"]).stdout
        .toString()
        .split("\n")
        .filter((line) => line.trim().length > 0);
      expect(appContainers).toHaveLength(2);

      const hostDir = join(evidenceRoot, "inc-1", "host-7");
      const stamps = readdirSync(hostDir);
      expect(stamps).toHaveLength(1);
      const bundle = join(hostDir, stamps[0] ?? "");
      const metaText = readFileSync(join(bundle, "meta.json"), "utf8");
      const meta = JSON.parse(metaText) as Record<string, unknown>;
      expect(metaText).toBe(canonicalJson(meta));
      expect(meta.adapter).toBe("docker");
      expect(meta.lockHolder).toBe("preserve-1");
      expect(Object.keys(meta.artifacts as Record<string, string>).sort()).toEqual([
        "connections.txt",
        "inspect.redacted.json",
        "logs.txt",
        "processes.txt",
      ]);

      const hashes = readFileSync(join(bundle, "hashes.txt"), "utf8");
      expect(hashes).not.toContain("hashes.txt");
      expect(hashes).not.toContain("anchor.sha256");

      const verified = Bun.spawnSync({
        cmd: ["bun", "scripts/verify-evidence.ts", bundle],
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(verified.exitCode, verified.stderr.toString()).toBe(0);
      expect(verified.stdout.toString()).toContain("OK ");
    }, 240_000);

    test("drain_node and revoke_token fail closed without an executed effect", async () => {
      const state = contractState();
      const adapter = docker(state);

      await expect(
        adapter.apply(intent("i-drain", "contain-1", "drain_node", { kind: "host", id: "host-7" }), "loop"),
      ).rejects.toThrow("not_supported");
      await expect(
        adapter.apply(intent("i-revoke", "contain-1", "revoke_token", { kind: "service", id: "checkout" }), "loop"),
      ).rejects.toThrow("not_supported");
      expect(state.executed).toHaveLength(0);
    }, 30_000);

    test("block_egress refuses a protected range before touching the edge", async () => {
      const state = contractState();
      const adapter = docker(state);
      const before = readFileSync(includeFile, "utf8");

      await expect(
        adapter.apply(
          intent("i-protected", "contain-1", "block_egress", { kind: "edge", id: "edge" }, {
            cidr: "10.0.0.0/8",
          }),
          "loop",
        ),
      ).rejects.toThrow("protected_cidr");
      expect(readFileSync(includeFile, "utf8")).toBe(before);
      expect(state.executed).toHaveLength(0);
    }, 30_000);
  },
);
