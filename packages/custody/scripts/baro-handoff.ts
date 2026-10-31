#!/usr/bin/env bun
/**
 * Run the baro handoff from packages/custody against the pinned fixture.
 *
 * Default backend: the native OpenAI runner pointed at OpenCode Go. The Go
 * gateway requires an `x-opencode-session` header, so a local proxy injects it.
 * `--opencode-cli` runs baro's OpenCode harness instead, which sends the header
 * itself and needs no key in this file.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startOpencodeGoProxy } from "./opencode-go-proxy.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");

export interface Models {
  story: string;
  architect: string;
  surgeon: string;
  planner: string;
  critic: string;
  dialogue: string;
}

export interface BaroOptions {
  backend: "openai" | "opencode";
  scratch: string;
  goal: string;
  localOnly: boolean;
  detach: boolean;
  effort: string;
  timeout: number;
  models: Models;
  extra: string[];
}

export const parseEnv = (text: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const split = trimmed.indexOf("=");
    if (split < 1) continue;
    const key = trimmed.slice(0, split).trim();
    let value = trimmed.slice(split + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

export const modelsFrom = (env: Record<string, string | undefined>): Models => ({
  story: env.BARO_STORY_MODEL ?? "deepseek-v4-pro",
  architect: env.BARO_ARCHITECT_MODEL ?? "deepseek-v4-pro",
  surgeon: env.BARO_SURGEON_MODEL ?? "deepseek-v4-pro",
  planner: env.BARO_PLANNER_MODEL ?? "deepseek-v4.1-flash",
  critic: env.BARO_CRITIC_MODEL ?? "deepseek-v4.1-flash",
  dialogue: env.BARO_DIALOGUE_MODEL ?? "deepseek-v4.1-flash",
});

export const buildBaroArgs = (options: BaroOptions): string[] => {
  const prefix = options.backend === "opencode" ? "opencode-go/" : "";
  const args = [
    "--llm",
    options.backend,
    "--headless",
    "--cwd",
    options.scratch,
    "--goal-file",
    options.goal,
    "--effort",
    options.effort,
    "--timeout",
    String(options.timeout),
    "--story-model",
    `${prefix}${options.models.story}`,
    "--architect-model",
    `${prefix}${options.models.architect}`,
    "--surgeon-model",
    `${prefix}${options.models.surgeon}`,
    "--planner-model",
    `${prefix}${options.models.planner}`,
    "--critic-model",
    `${prefix}${options.models.critic}`,
    "--dialogue-model",
    `${prefix}${options.models.dialogue}`,
  ];
  if (options.localOnly) args.push("--local-only");
  if (options.detach) args.push("--detach");
  return [...args, ...options.extra];
};

export const redactedCommand = (binary: string, args: string[]): string => {
  const out = [binary];
  let redactNext = false;
  for (const arg of args) {
    if (redactNext) {
      out.push("<redacted>");
      redactNext = false;
      continue;
    }
    out.push(arg);
    if (/^--[^=]*(key|token|secret)/i.test(arg)) redactNext = true;
  }
  return out.join(" ");
};

const usage = (): void => {
  console.log(`baro handoff from packages/custody

  bun scripts/baro-handoff.ts                 run against modules/custody-scratch
  bun scripts/baro-handoff.ts --dry-run       print the resolved command
  bun scripts/baro-handoff.ts --opencode-cli  use baro's OpenCode harness (no proxy)
  bun scripts/baro-handoff.ts --detach        detach (OpenCode CLI backend only)
  bun scripts/baro-handoff.ts --push          allow baro-owned pushes and PRs
  bun scripts/baro-handoff.ts --scratch <d>   target checkout (default modules/custody-scratch)
  bun scripts/baro-handoff.ts --goal <file>   goal file (default outbox/inc-1/goal.txt)
  bun scripts/baro-handoff.ts --effort <e>    low, medium, high, xhigh, max (default high)
  bun scripts/baro-handoff.ts --timeout <s>   per-story timeout (default 900)
  bun scripts/baro-handoff.ts -- <args>       pass the rest to baro

  .env: OPENCODE_GO_BASE_URL, OPENCODE_GO_API_KEY, BARO_*_MODEL, BARO_*_EFFORT.
`);
};

const valueOf = (argv: string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
};

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    return;
  }

  const envFile = resolve(PACKAGE_ROOT, ".env");
  const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  const env: Record<string, string | undefined> = { ...fileEnv, ...process.env };

  const backend: "openai" | "opencode" = argv.includes("--opencode-cli") ? "opencode" : "openai";
  const dryRun = argv.includes("--dry-run");
  const detach = argv.includes("--detach");
  const localOnly = !argv.includes("--push");

  const scratch = resolve(
    PACKAGE_ROOT,
    valueOf(argv, "--scratch") ?? env.BARO_SCRATCH_REPO ?? resolve(REPO_ROOT, "modules/custody-scratch"),
  );
  const goal = resolve(
    PACKAGE_ROOT,
    valueOf(argv, "--goal") ?? env.BARO_GOAL_FILE ?? resolve(PACKAGE_ROOT, "outbox/inc-1/goal.txt"),
  );
  const effort = valueOf(argv, "--effort") ?? env.BARO_EFFORT ?? "high";
  const timeout = Number(valueOf(argv, "--timeout") ?? env.BARO_TIMEOUT ?? "900");
  const separator = argv.indexOf("--");
  const extra = separator === -1 ? [] : argv.slice(separator + 1);

  if (!Number.isFinite(timeout) || timeout <= 0) {
    console.error("baro-handoff: --timeout must be a positive number of seconds");
    process.exit(2);
  }
  if (!existsSync(scratch)) {
    console.error(`baro-handoff: no checkout at ${scratch}`);
    console.error("  git submodule update --init modules/custody-scratch");
    process.exit(2);
  }
  if (!existsSync(goal)) {
    console.error(`baro-handoff: no goal file at ${goal}`);
    process.exit(2);
  }
  if (detach && backend === "openai") {
    console.error("baro-handoff: --detach needs --opencode-cli; the Go proxy must outlive the run");
    process.exit(2);
  }

  const options: BaroOptions = {
    backend,
    scratch,
    goal,
    localOnly,
    detach,
    effort,
    timeout,
    models: modelsFrom(env),
    extra,
  };
  const binary = env.BARO_BIN && env.BARO_BIN.trim() ? env.BARO_BIN : "baro";
  const args = buildBaroArgs(options);

  console.log(`baro-handoff: ${redactedCommand(binary, args)}`);
  console.log(`  backend  ${backend === "openai" ? "OpenCode Go via local proxy" : "OpenCode CLI (opencode-go)"}`);
  console.log(`  models   story ${options.models.story} · critic ${options.models.critic} · planner ${options.models.planner}`);
  console.log(`  target   ${scratch}`);
  console.log(`  goal     ${goal}`);
  if (dryRun) return;

  if (backend === "opencode") {
    const child = Bun.spawn({ cmd: [binary, ...args], cwd: PACKAGE_ROOT, stdio: ["inherit", "inherit", "inherit"] });
    process.exit(await child.exited);
  }

  const apiKey = (env.OPENCODE_GO_API_KEY ?? "").trim();
  if (!apiKey) {
    console.error("baro-handoff: OPENCODE_GO_API_KEY is empty in packages/custody/.env");
    console.error("  fill it from `opencode auth export`, or run with --opencode-cli");
    process.exit(2);
  }
  const proxy = startOpencodeGoProxy({
    apiKey,
    baseUrl: env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/inference/go/openai/v1",
  });
  console.log(`  proxy    ${proxy.url}`);
  try {
    const child = Bun.spawn({
      cmd: [binary, ...args],
      cwd: PACKAGE_ROOT,
      env: { ...process.env, OPENAI_BASE_URL: proxy.url, OPENAI_API_KEY: apiKey },
      stdio: ["inherit", "inherit", "inherit"],
    });
    process.exit(await child.exited);
  } finally {
    proxy.stop();
  }
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(`baro-handoff: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
