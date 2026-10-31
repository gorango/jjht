#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ablate, formatAblation, type PatchedResult } from "../src/eval/ablate.js";
import { SCENARIOS } from "../src/scenarios/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "eval/results.json");
const patchedFile = resolve(root, "eval/patched.json");

const readPatched = (): PatchedResult | undefined => {
  if (!existsSync(patchedFile)) return undefined;
  const parsed = JSON.parse(readFileSync(patchedFile, "utf8")) as PatchedResult;
  if (parsed.status !== "run" && parsed.status !== "not run") {
    throw new Error(`${patchedFile} has no valid status`);
  }
  return parsed;
};

const result = ablate(SCENARIOS, { patched: readPatched() });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);

console.log(`\nCUSTODY ablation`);
console.log(`${SCENARIOS.length} scenarios, runner ${result.runner}, costUsd ${result.costUsd}\n`);
console.log(formatAblation(result));
console.log(`\nwrote ${out}`);
process.exitCode = result.pass ? 0 : 1;
