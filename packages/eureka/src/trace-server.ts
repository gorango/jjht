/**
 * A zero-dependency static server for the trace viewer.
 *
 * `bun run trace` serves public/ plus runs/<id>/ on localhost, so the viewer can
 * `fetch` the JSONL without a bundler, a build step, or a CORS workaround.
 */
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = process.cwd();
const PUBLIC = resolve(ROOT, "public");
const RUNS = resolve(ROOT, "runs");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/x-ndjson; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mmd": "text/plain; charset=utf-8",
};

const safeJoin = (base: string, target: string): string | undefined => {
  const full = resolve(base, normalize(target).replace(/^([/\\])+/, ""));
  return full === base || full.startsWith(base + sep) ? full : undefined;
};

export const serveRuns = (port: number, runId: string): void => {
  if (!existsSync(join(RUNS, runId, "trace.jsonl"))) {
    console.error(`no trace at runs/${runId}/trace.jsonl`);
    process.exit(1);
  }

  const runs = readdirSync(RUNS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (url.pathname === "/") {
      response.writeHead(302, { Location: `/viewer.html?run=${encodeURIComponent(runId)}` });
      response.end();
      return;
    }

    if (url.pathname === "/runs.json") {
      response.writeHead(200, { "Content-Type": TYPES[".json"]! });
      response.end(JSON.stringify(runs));
      return;
    }

    const file =
      url.pathname.startsWith("/run/")
        ? safeJoin(RUNS, url.pathname.slice("/run/".length))
        : safeJoin(PUBLIC, url.pathname);

    if (!file || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(file).pipe(response);
  });

  server.listen(port, () => {
    console.log(`\n  trace viewer  http://localhost:${port}/?run=${runId}\n`);
    console.log(`  runs: ${runs.slice(0, 8).join(", ")}${runs.length > 8 ? ", …" : ""}\n`);
  });
};
