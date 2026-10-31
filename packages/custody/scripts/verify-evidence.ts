#!/usr/bin/env bun
/**
 * Recompute the evidence chain: every file in hashes.txt, then the anchor.
 * Prints OK or the first mismatch. Exits non-zero on any failure.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const fail = (message: string): never => {
  console.error(`FAIL ${message}`);
  process.exit(1);
};

const sha256 = (data: Buffer): string => createHash("sha256").update(data).digest("hex");

const target = process.argv[2];
if (!target) {
  console.error("usage: bun scripts/verify-evidence.ts <bundle>");
  process.exit(2);
}

const bundle = resolve(target);
try {
  if (!statSync(bundle).isDirectory()) fail(`${bundle} is not a directory`);
} catch {
  fail(`${bundle} does not exist`);
}

const hashesPath = join(bundle, "hashes.txt");
const anchorPath = join(bundle, "anchor.sha256");

let hashesBody: Buffer;
let anchorBody: string;
try {
  hashesBody = readFileSync(hashesPath);
  anchorBody = readFileSync(anchorPath, "utf8").trim();
} catch (error) {
  fail(`missing manifest: ${error instanceof Error ? error.message : String(error)}`);
}

const lines = hashesBody
  .toString("utf8")
  .split("\n")
  .filter((line) => line.trim().length > 0);

if (lines.length === 0) fail("hashes.txt is empty");

for (const line of lines) {
  const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
  if (!match) fail(`malformed line: ${line}`);
  const expected = match[1] ?? "";
  const name = match[2] ?? "";
  if (name === "hashes.txt" || name === "anchor.sha256") {
    fail(`hashes.txt must not hash ${name}`);
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    fail(`unsafe path in hashes.txt: ${name}`);
  }
  let actual: string;
  try {
    actual = sha256(readFileSync(join(bundle, name)));
  } catch (error) {
    fail(`cannot read ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (actual !== expected) {
    console.error(`FAIL mismatch: ${name}`);
    console.error(`  expected ${expected}`);
    console.error(`  actual   ${actual}`);
    process.exit(1);
  }
}

const computed = sha256(hashesBody);
if (computed !== anchorBody) {
  console.error("FAIL anchor mismatch: anchor.sha256 does not hash hashes.txt");
  console.error(`  expected ${anchorBody}`);
  console.error(`  actual   ${computed}`);
  process.exit(1);
}

console.log(`OK ${bundle}`);
