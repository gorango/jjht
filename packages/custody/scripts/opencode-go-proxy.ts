#!/usr/bin/env bun
/**
 * OpenCode Go requires an `x-opencode-session` header on every inference request.
 * baro's native OpenAI runner cannot add one, so this proxy forwards to the Go
 * endpoint and injects the header plus the bearer key.
 *
 * Exported for scripts/baro-handoff.ts. Also runs standalone on stdin port 0.
 */
export interface ProxyOptions {
  apiKey: string;
  baseUrl?: string;
  session?: string;
}

export interface ProxyHandle {
  url: string;
  port: number;
  stop: () => void;
}

const DEFAULT_BASE = "https://opencode.ai/inference/go/openai";

export const startOpencodeGoProxy = (options: ProxyOptions): ProxyHandle => {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("an OpenCode Go API key is required");
  const upstream = (options.baseUrl ?? DEFAULT_BASE).replace(/\/v1\/?$/, "");
  const session = options.session ?? `custody-baro-${process.pid}`;

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    // Planner and architect calls can run past Bun's 10 second default.
    idleTimeout: 255,
    async fetch(request) {
      const incoming = new URL(request.url);
      const target = `${upstream}${incoming.pathname}${incoming.search}`;
      const headers = new Headers(request.headers);
      headers.set("authorization", `Bearer ${apiKey}`);
      headers.set("x-opencode-session", session);
      headers.delete("host");
      headers.delete("content-length");

      const body =
        request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
      try {
        const response = await fetch(target, {
          method: request.method,
          headers,
          body,
          duplex: "half",
        } as RequestInit);
        const out = new Headers(response.headers);
        out.delete("content-encoding");
        out.delete("content-length");
        return new Response(response.body, { status: response.status, headers: out });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ error: { message: `opencode-go proxy: ${message}` } }, { status: 502 });
      }
    },
  });

  const port = server.port ?? 0;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    port,
    stop: () => server.stop(true),
  };
};

if (import.meta.main) {
  const apiKey = process.env.OPENCODE_GO_API_KEY ?? process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    console.error("opencode-go-proxy: set OPENCODE_GO_API_KEY");
    process.exit(2);
  }
  const proxy = startOpencodeGoProxy({
    apiKey,
    ...(process.env.OPENCODE_GO_BASE_URL ? { baseUrl: process.env.OPENCODE_GO_BASE_URL } : {}),
  });
  console.log(proxy.url);
  process.on("SIGINT", () => {
    proxy.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    proxy.stop();
    process.exit(0);
  });
}
