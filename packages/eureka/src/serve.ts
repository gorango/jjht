/**
 * A minimal service seam for the EINSTEIN network.
 *
 *   MOCK=1 bun src/index.ts serve --port=4300
 *
 *   curl -X POST localhost:4300/challenges -d '{"challengeId":"C001-CH1"}'
 *   curl -N localhost:4300/events
 *   curl localhost:4300/portfolio/<runId>
 *
 * The service is the same runtime as the CLI: one state, five pools, the lease
 * market and the Critic. A host posts a challenge and reads semantic events; it
 * does not import our agents. Deliberately dependency-free (node:http only).
 */
import { createServer, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createHuman, SituationSpecification } from "@mozaik-ai/core";

import { createPools } from "./agents/pool.js";
import { createScheduler, portfolioMarkdown } from "./agents/scheduler.js";
import { ARCHITECTURE } from "./architecture.js";
import { buildConfig } from "./config.js";
import { loadDataset, ResearcherIndex } from "./domain/dataset.js";
import type { Challenge } from "./domain/types.js";
import { MockRunner } from "./inference/mock.js";
import { hasOpenRouter, openRouterModels } from "./inference/openrouter.js";
import { emit } from "./runtime/events.js";
import { initializeRuntime, join } from "./runtime/session.js";
import { EurekaState } from "./runtime/state.js";
import { joinTrace } from "./runtime/trace.js";

class Everything extends SituationSpecification {
  override isSatisfiedBy(): boolean {
    return true;
  }
}

const readBody = async (request: import("node:http").IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
};

export interface ServeContext {
  state: EurekaState;
  postChallenge(body: unknown): { challengeId: string } | { error: string; status: number };
}

export const startServe = async (port: number): Promise<ServeContext> => {
  const config = buildConfig();
  const state = new EurekaState();
  state.config = config;
  state.dataset = loadDataset();
  state.index = new ResearcherIndex(state.dataset.researchers);

  for (const researcher of state.dataset.researchers) state.sourceIds.add(researcher.id);
  for (const id of state.dataset.publications.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.projects.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.patents.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.byChallengeId.keys()) state.sourceIds.add(id);
  for (const id of state.dataset.byCompanyId.keys()) state.sourceIds.add(id);

  initializeRuntime({
    state,
    inferenceRunnerConfig: config.mock
      ? { runner: new MockRunner(config.mockLatencyMs) }
      : hasOpenRouter()
        ? { supportedModels: openRouterModels([config.strongModel, config.fastModel]) }
        : undefined,
  });

  const trace = joinTrace(state);
  for (const pool of createPools(state)) {
    for (const agent of pool.agents) join(agent);
  }
  const scheduler = createScheduler(state);
  join(scheduler);
  state.schedulerId = scheduler.getId();

  const clients = new Set<ServerResponse>();
  const fanout = createHuman({
    name: "EventStream",
    capabilities: ["observe"],
    handlers: [
      {
        specification: new Everything(),
        processor: {
          apply({ event }) {
            if (event.type === "run.completed") {
              const summary = (event.payload as { summary: import("./runtime/events.js").RunSummary }).summary;
              trace.finish(summary, portfolioMarkdown(state, state.portfolio), ARCHITECTURE);
            }
            const line = JSON.stringify({ type: event.type, producer: event.producerId, payload: event.payload });
            for (const client of clients) client.write(`data: ${line}\n\n`);
          },
        },
      },
    ],
  });
  join(fanout);

  let external = 0;
  const postChallenge = (body: any): { challengeId: string } | { error: string; status: number } => {
    if (state.finalized) return { error: "this run is finished; restart the server", status: 409 };
    if (!body || typeof body !== "object") return { error: "body must be a JSON object", status: 400 };

    let challengeId = typeof body.challengeId === "string" ? body.challengeId : undefined;
    if (challengeId && !state.dataset.byChallengeId.has(challengeId)) {
      return { error: `unknown challenge id: ${challengeId}`, status: 404 };
    }

    if (!challengeId) {
      if (typeof body.text !== "string" || body.text.trim().length === 0) {
        return { error: "provide challengeId or a non-empty text", status: 400 };
      }
      const company =
        (typeof body.companyId === "string" ? state.dataset.byCompanyId.get(body.companyId) : undefined) ??
        state.dataset.companies[0];
      if (!company) return { error: "dataset has no companies", status: 500 };
      external += 1;
      challengeId = `EXT-${external}`;
      const challenge: Challenge = { id: challengeId, text: body.text.trim(), detail: String(body.detail ?? "") };
      company.challenges.push(challenge);
      state.dataset.byChallengeId.set(challengeId, { company, challenge });
      // The posted text is itself the source for claims about this challenge.
      state.sourceIds.add(challengeId);
    }

    state.totals.challenges += 1;
    state.enqueue("analyst", challengeId);
    state.note("serve", "host", `received challenge ${challengeId}`);
    emit("work.available", state.schedulerId!, { role: "analyst" });
    return { challengeId };
  };

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/") {
      json(response, 200, {
        runId: state.runId,
        finalized: state.finalized,
        endpoints: {
          "POST /challenges": "{\"challengeId\":\"C001-CH1\"} or {\"text\":\"...\",\"companyId\":\"C001\"}",
          "GET /events": "server-sent events of semantic events",
          "GET /portfolio/:runId": "markdown portfolio for a finished run",
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write(`: connected to ${state.runId}\n\n`);
      clients.add(response);
      const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15_000);
      request.on("close", () => {
        clearInterval(heartbeat);
        clients.delete(response);
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/challenges") {
      void readBody(request)
        .then((raw) => {
          let body: unknown;
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            json(response, 400, { error: "invalid JSON" });
            return;
          }
          const result = postChallenge(body);
          if ("error" in result) json(response, result.status, { error: result.error });
          else json(response, 202, { runId: state.runId, challengeId: result.challengeId, status: "queued" });
        })
        .catch((error) => json(response, 500, { error: String(error) }));
      return;
    }

    const portfolio = /^\/portfolio\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && portfolio) {
      const runId = portfolio[1]!;
      const file = resolve(process.cwd(), "runs", runId, "portfolio.md");
      if (!existsSync(file)) {
        json(response, 404, { error: `no portfolio for ${runId}` });
        return;
      }
      response.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
      response.end(readFileSync(file));
      return;
    }

    json(response, 404, { error: "not found" });
  });

  await new Promise<void>((done) => server.listen(port, done));
  console.log(
    [
      "",
      `  EUREKA service  http://localhost:${port}`,
      `  run             ${state.runId}`,
      `  model           ${config.mock ? "mock (offline)" : config.strongModel}`,
      "",
      `  curl -X POST localhost:${port}/challenges -H 'content-type: application/json' -d '{"challengeId":"C001-CH1"}'`,
      `  curl -N localhost:${port}/events`,
      `  curl localhost:${port}/portfolio/${state.runId}`,
      "",
      "  trace is written to runs/<runId>/ as usual.",
      "",
    ].join("\n"),
  );
  void trace;
  return { state, postChallenge };
};
