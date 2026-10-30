#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ablate, formatAblation } from "../src/eval/ablate.js";
import { SCENARIOS } from "../src/scenarios/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "eval/results.json");

const result = ablate(SCENARIOS, { patched: Boolean(process.env.CUSTODY_PATCHED_REF) });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);

console.log(`\nCUSTODY ablation`);
console.log(`${SCENARIOS.length} scenarios, runner ${result.runner}, costUsd ${result.costUsd}\n`);
console.log(formatAblation(result));
console.log(`\nwrote ${out}`);
process.exitCode = result.pass ? 0 : 1;
