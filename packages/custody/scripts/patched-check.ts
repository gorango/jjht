#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { PatchedResult } from "../src/eval/ablate.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(packageRoot, "eval/patched.json");
const COMMAND = "bun test test/checkout.test.ts";

interface Checkout {
  dir: string;
  label: string;
  cleanup?: () => void;
}

interface Reproduction {
  attackSucceeded: boolean;
  exitCode: number;
  output: string;
}

const argValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const checkoutFromRef = (ref: string, repo: string): Checkout | undefined => {
  const exists = spawnSync("git", ["-C", repo, "rev-parse", "--verify", `${ref}^{commit}`], {
    encoding: "utf8",
  });
  if (exists.status !== 0) return undefined;
  const dir = mkdtempSync(join(tmpdir(), "custody-patched-"));
  const added = spawnSync("git", ["-C", repo, "worktree", "add", "--detach", dir, ref], {
    encoding: "utf8",
  });
  if (added.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return undefined;
  }
  return { dir, label: ref, cleanup: () => spawnSync("git", ["-C", repo, "worktree", "remove", "--force", dir]) };
};

export const resolveCheckout = (
  value: string | undefined,
  repo = process.env.CUSTODY_SCRATCH_REPO ?? resolve(packageRoot, "../../modules/custody-scratch"),
): Checkout | undefined => {
  if (!value) return undefined;
  if (existsSync(value) && statSync(value).isDirectory()) {
    return { dir: resolve(value), label: value };
  }
  if (!existsSync(repo)) return undefined;
  return checkoutFromRef(value, repo);
};

export const runReproduction = (checkout: Checkout): Reproduction => {
  const testFile = join(checkout.dir, "test/checkout.test.ts");
  if (!existsSync(testFile)) throw new Error(`no reproduction at ${testFile}`);
  const run = spawnSync("bun", ["test", "test/checkout.test.ts"], {
    cwd: checkout.dir,
    encoding: "utf8",
  });
  if (run.error) throw run.error;
  if (run.status === null) throw new Error(`bun test produced no exit status in ${checkout.dir}`);
  return {
    attackSucceeded: run.status !== 0,
    exitCode: run.status,
    output: `${run.stdout}${run.stderr}`,
  };
};

export const buildPatched = (vulnerable: Checkout, patched: Checkout): PatchedResult => {
  const before = runReproduction(vulnerable);
  const after = runReproduction(patched);
  return {
    status: "run",
    scenario: "dependency-vuln",
    before: { attackSucceeded: before.attackSucceeded },
    after: { attackSucceeded: after.attackSucceeded },
    command: COMMAND,
    vulnerableRef: vulnerable.label,
    patchedRef: patched.label,
  };
};

const write = (result: PatchedResult): void => {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`wrote ${out}`);
  console.log(JSON.stringify(result, null, 2));
};

const main = (): void => {
  const vulnerable = resolveCheckout(argValue("--vulnerable"));
  const patched = resolveCheckout(argValue("--patched"));
  if (!vulnerable || !patched) {
    const missing = !patched ? "--patched" : "--vulnerable";
    const result: PatchedResult = {
      status: "not run",
      reason: `no patched checkout: ${missing} did not resolve to a directory or ref`,
    };
    write(result);
    console.log("patched reproduction not run");
    return;
  }
  try {
    const result = buildPatched(vulnerable, patched);
    write(result);
    if (result.status === "run" && !(result.before.attackSucceeded && !result.after.attackSucceeded)) {
      console.error("reproduction did not fail before the patch and pass after it");
      process.exitCode = 1;
    }
  } finally {
    vulnerable.cleanup?.();
    patched.cleanup?.();
  }
};

if (import.meta.main) main();
