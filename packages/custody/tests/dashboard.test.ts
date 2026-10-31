import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

interface Row {
  at: string;
  producerId: string;
  type: string;
  loopId?: string;
  payload: any;
}

interface ScenarioItem {
  id: string;
  title: string;
  expected: number;
  noAction: boolean;
}

interface DecisionItem {
  intentId: string;
  kind: string;
  reason: string;
}

interface Summary {
  runId: string;
  scenario: string;
  exitCode: number | null;
  expectedMatches: number;
  expectedTotal: number;
  executedCount: number;
  harmfulCount: number;
  inflightMax: number;
  windowLoopIds: string[];
  decisions: DecisionItem[];
  noAction: { reason: string | null; outcome: string | null } | null;
  pass: boolean;
}

interface EventsBody {
  rows: Row[];
  next: number;
  running: boolean;
  exitCode: number | null;
}

const root = resolve(import.meta.dir, "..");
const runsDir = join(root, "runs");
const decoder = new TextDecoder();

const preexisting = new Set(existsSync(runsDir) ? readdirSync(runsDir) : []);

let server: ReturnType<typeof Bun.spawn> | undefined;
let base = "";
let stderr = "";

const urlFrom = async (proc: ReturnType<typeof Bun.spawn>, timeoutMs = 10_000): Promise<string> => {
  const reader = proc.stdout.getReader();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const match = /http:\/\/localhost:(\d+)/.exec(buffer);
    if (match) {
      reader.releaseLock();
      return `http://localhost:${match[1]}`;
    }
  }
  throw new Error(`server did not print a URL: ${buffer}${stderr}`);
};

const drain = (stream: ReadableStream<Uint8Array>) => {
  void (async () => {
    const reader = stream.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      stderr += decoder.decode(value, { stream: true });
    }
  })();
};

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${base}${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
};

const postRun = (body: unknown): Promise<Response> =>
  fetch(`${base}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const collect = async (
  runId: string,
  timeoutMs = 20_000,
): Promise<{ rows: Row[]; exitCode: number | null }> => {
  const rows: Row[] = [];
  let offset = 0;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await fetch(`${base}/api/runs/${runId}/events?offset=${offset}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as EventsBody;
    expect(body.next).toBe(offset + body.rows.length);
    rows.push(...body.rows);
    offset = body.next;
    if (!body.running) return { rows, exitCode: body.exitCode };
    if (Date.now() > deadline) throw new Error(`${runId} did not finish within ${timeoutMs}ms`);
    await Bun.sleep(100);
  }
};

beforeAll(async () => {
  server = Bun.spawn({
    cmd: ["bun", "src/server.ts", "--port", "0"],
    cwd: root,
    env: { ...process.env, CUSTODY_WINDOW_MS: "120" },
    stdout: "pipe",
    stderr: "pipe",
  });
  drain(server.stderr);
  base = await urlFrom(server);
});

afterAll(() => {
  server?.kill();
  if (!existsSync(runsDir)) return;
  for (const id of readdirSync(runsDir)) {
    if (!preexisting.has(id)) rmSync(join(runsDir, id), { recursive: true, force: true });
  }
});

describe("the dashboard server", () => {
  test("serves the page and the scenario catalogue", async () => {
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("CUSTODY");

    const scenarios = await getJson<ScenarioItem[]>("/api/scenarios");
    expect(scenarios).toHaveLength(10);
    expect(scenarios[0]?.id).toBe("money");
    expect(scenarios[1]?.id).toBe("benign-export");
    expect(scenarios[0]?.expected).toBe(5);
    expect(scenarios[1]?.expected).toBe(0);
    expect(scenarios[1]?.noAction).toBe(true);

    const status = await getJson<{ docker: boolean; replay: string | null; active: unknown }>(
      "/api/status",
    );
    expect(typeof status.docker).toBe("boolean");
    expect(status.active).toBeNull();
  });

  test(
    "money: five proposals in one window, 409 while active, the CLI decisions",
    async () => {
      const started = await postRun({ scenario: "money" });
      expect(started.status).toBe(200);
      const { runId, tracePath } = (await started.json()) as { runId: string; tracePath: string };
      expect(tracePath).toStartWith(runsDir);

      const second = await postRun({ scenario: "benign-export" });
      expect(second.status).toBe(409);
      expect(((await second.json()) as { error: string }).error).toContain("already active");

      const { rows, exitCode } = await collect(runId);
      expect(exitCode).toBe(0);

      const closeIndex = rows.findIndex((row) => row.type === "window.closed");
      expect(closeIndex).toBeGreaterThan(0);
      expect(rows.slice(0, closeIndex).filter((row) => row.type === "intent.proposed")).toHaveLength(5);

      const closed = rows
        .filter((row) => row.type === "window.closed")
        .map((row) => row.payload as { inflight: number; loopIds: string[] });
      expect(closed[0]?.inflight).toBe(5);
      expect(new Set(closed[0]?.loopIds).size).toBe(5);

      const decisions = rows
        .filter((row) => row.type === "decision.made")
        .map((row) => row.payload.decision as DecisionItem);
      expect(decisions).toHaveLength(5);

      const summary = await getJson<Summary>(`/api/runs/${runId}/summary`);
      expect(summary.exitCode).toBe(0);
      expect(summary.expectedMatches).toBe(5);
      expect(summary.expectedTotal).toBe(5);
      expect(summary.executedCount).toBe(3);
      expect(summary.harmfulCount).toBe(0);
      expect(summary.inflightMax).toBe(5);
      expect(new Set(summary.windowLoopIds).size).toBe(5);
      expect(summary.pass).toBe(true);

      const kinds = new Map(summary.decisions.map((decision) => [decision.intentId, decision]));
      expect(kinds.get("i-snapshot")?.kind).toBe("accept");
      expect(kinds.get("i-block")?.kind).toBe("rewrite");
      expect(kinds.get("i-block")?.reason).toContain("203.0.113.9/32");
      expect(kinds.get("i-isolate")?.kind).toBe("defer");
      expect(kinds.get("i-isolate")?.reason).toContain("evidence lock");
      expect(kinds.get("i-injected")?.kind).toBe("reject");
      expect(kinds.get("i-injected")?.reason).toContain("taint");
      expect(kinds.get("i-scale")?.kind).toBe("accept");

      const raw = await fetch(`${base}/runs/${runId}/trace.jsonl`);
      expect(raw.status).toBe(200);
      const lines = (await raw.text()).trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(rows.length);
    },
    30_000,
  );

  test(
    "benign: NO ACTION and zero executed effects",
    async () => {
      const started = await postRun({ scenario: "benign-export" });
      expect(started.status).toBe(200);
      const { runId } = (await started.json()) as { runId: string };

      const { rows, exitCode } = await collect(runId);
      expect(exitCode).toBe(0);
      expect(rows.filter((row) => row.type === "decision.made")).toHaveLength(0);
      expect(rows.filter((row) => row.type === "window.closed")).toHaveLength(0);
      expect(rows.filter((row) => row.type === "action.executed")).toHaveLength(0);

      const closedRow = rows.find((row) => row.type === "incident.closed");
      expect(closedRow?.payload.outcome).toStartWith("no action:");

      const summary = await getJson<Summary>(`/api/runs/${runId}/summary`);
      expect(summary.exitCode).toBe(0);
      expect(summary.expectedMatches).toBe(0);
      expect(summary.expectedTotal).toBe(0);
      expect(summary.executedCount).toBe(0);
      expect(summary.harmfulCount).toBe(0);
      expect(summary.decisions).toHaveLength(0);
      expect(summary.noAction?.reason).toContain("scheduled weekly run");
      expect(summary.pass).toBe(true);
    },
    15_000,
  );

  test("replay reads a finished trace without starting a process", async () => {
    const runs = await getJson<Array<{ runId: string; scenario: string; pass: boolean | null; state: string }>>(
      "/api/runs",
    );
    const money = runs.find((run) => run.scenario === "money");
    expect(money?.pass).toBe(true);
    expect(money?.state).toBe("done");

    const before = readdirSync(runsDir).length;
    const status = await getJson<{ active: unknown }>("/api/status");
    expect(status.active).toBeNull();

    const events = await getJson<EventsBody>(`/api/runs/${money?.runId}/events?offset=0`);
    expect(events.running).toBe(false);
    expect(events.rows.length).toBeGreaterThan(20);
    expect(events.rows.some((row) => row.type === "window.closed")).toBe(true);

    const traceFile = join(runsDir, money?.runId ?? "", "trace.jsonl");
    const onDisk = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
    expect(events.rows).toHaveLength(onDisk.length);

    const after = readdirSync(runsDir).length;
    expect(after).toBe(before);
    const settled = await getJson<{ active: unknown }>("/api/status");
    expect(settled.active).toBeNull();
  });

  test("starts with --replay and serves the loaded trace", async () => {
    const runs = await getJson<Array<{ runId: string; scenario: string }>>("/api/runs");
    const money = runs.find((run) => run.scenario === "money");
    const tracePath = join(runsDir, money?.runId ?? "", "trace.jsonl");
    const before = readdirSync(runsDir).length;

    const replayServer = Bun.spawn({
      cmd: ["bun", "src/server.ts", "--port", "0", "--replay", tracePath],
      cwd: root,
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    try {
      const replayBase = await urlFrom(replayServer);
      const status = (await (await fetch(`${replayBase}/api/status`)).json()) as {
        replay: string | null;
        active: unknown;
      };
      expect(status.replay).toBe(tracePath);
      expect(status.active).toBeNull();

      const replay = (await (await fetch(`${replayBase}/api/replay`)).json()) as {
        tracePath: string;
        rows: Row[];
      };
      expect(replay.tracePath).toBe(tracePath);
      expect(replay.rows).toHaveLength(
        readFileSync(tracePath, "utf8").trim().split("\n").filter(Boolean).length,
      );

      expect(readdirSync(runsDir).length).toBe(before);
    } finally {
      replayServer.kill();
    }
  });
});
