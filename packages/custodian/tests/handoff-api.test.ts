import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const runsDir = join(root, "runs");
const handoffsDir = join(runsDir, "handoffs");
const decoder = new TextDecoder();

const preexistingRuns = new Set(existsSync(runsDir) ? readdirSync(runsDir) : []);
const preexistingHandoffs = new Set(existsSync(handoffsDir) ? readdirSync(handoffsDir) : []);

let server: ReturnType<typeof Bun.spawn> | undefined;
let base = "";
let stubDir = "";

const urlFrom = async (proc: ReturnType<typeof Bun.spawn>, timeoutMs = 10_000): Promise<string> => {
  const reader = proc.stdout.getReader();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const match = /http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/.exec(buffer);
    if (match) {
      reader.releaseLock();
      return `http://127.0.0.1:${match[1]}`;
    }
  }
  throw new Error(`server did not print a URL: ${buffer}`);
};

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${base}${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
};

const postJson = (path: string, body: unknown): Promise<Response> =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const finishRun = async (scenario: string): Promise<string> => {
  const started = await postJson("/api/runs", { scenario });
  expect(started.status).toBe(200);
  const { runId } = (await started.json()) as { runId: string };
  const deadline = Date.now() + 20_000;
  for (;;) {
    const body = (await getJson<{ running: boolean }>(`/api/runs/${runId}/events?offset=0`)) as {
      running: boolean;
    };
    if (!body.running) return runId;
    if (Date.now() > deadline) throw new Error(`${scenario} did not finish`);
    await Bun.sleep(100);
  }
};

beforeAll(async () => {
  stubDir = mkdtempSync(join(tmpdir(), "custodian-baro-stub-"));
  const stub = join(stubDir, "stub-baro.ts");
  writeFileSync(
    stub,
    `console.log("stub baro start");\nawait Bun.sleep(900);\nconsole.log("https://github.com/gorango/jjhts/pull/99");\nprocess.exit(0);\n`,
  );
  server = Bun.spawn({
    cmd: ["bun", "src/server.ts", "--port", "0"],
    cwd: root,
    env: {
      ...process.env,
      CUSTODIAN_WINDOW_MS: "120",
      CUSTODIAN_BARO_WRAPPER: stub,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  base = await urlFrom(server);
});

afterAll(() => {
  server?.kill();
  if (stubDir) rmSync(stubDir, { recursive: true, force: true });
  if (existsSync(runsDir)) {
    for (const id of readdirSync(runsDir)) {
      if (!preexistingRuns.has(id) && id !== "handoffs") {
        rmSync(join(runsDir, id), { recursive: true, force: true });
      }
    }
  }
  if (existsSync(handoffsDir)) {
    for (const id of readdirSync(handoffsDir)) {
      if (!preexistingHandoffs.has(id)) {
        rmSync(join(handoffsDir, id), { recursive: true, force: true });
      }
    }
  }
});

describe("the dashboard handoff", () => {
  test("a money run can be pushed to baro, with one job at a time", async () => {
    const runId = await finishRun("money");

    const start = await postJson("/api/handoffs", { runId, push: true });
    expect(start.status).toBe(200);
    const job = (await start.json()) as { id: string; goalPath: string; push: boolean };
    expect(job.push).toBe(true);

    const goal = readFileSync(job.goalPath, "utf8");
    expect(goal).toContain("leave delivery to baro's finalizer");
    expect(goal).not.toContain("open a pull request");
    expect(goal).not.toContain("leave the fix as a local commit");

    const second = await postJson("/api/handoffs", { runId, push: true });
    expect(second.status).toBe(409);

    let status: any = null;
    const deadline = Date.now() + 10_000;
    for (;;) {
      status = await getJson<any>(`/api/handoffs/${job.id}`);
      if (status.status !== "running") break;
      if (Date.now() > deadline) throw new Error("handoff did not finish");
      await Bun.sleep(100);
    }
    expect(status.status).toBe("done");
    expect(status.exitCode).toBe(0);
    expect(status.prUrl).toBe("https://github.com/gorango/jjhts/pull/99");

    const log = await getJson<{ text: string; next: number; running: boolean }>(
      `/api/handoffs/${job.id}/log?offset=0`,
    );
    expect(log.running).toBe(false);
    expect(log.text).toContain("stub baro start");
    expect(log.text).toContain("pull/99");

    const tail = await getJson<{ text: string; next: number }>(
      `/api/handoffs/${job.id}/log?offset=${log.next}`,
    );
    expect(tail.text).toBe("");
  }, 30_000);

  test("a non-money run is refused", async () => {
    const runId = await finishRun("benign-export");
    const response = await postJson("/api/handoffs", { runId, push: true });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain("money scenario");
  }, 20_000);
});
