import { describe, expect, test } from "bun:test";

import { ablate, formatPatched, type PatchedResult } from "../src/eval/ablate.js";
import { SCENARIOS } from "../src/scenarios/index.js";
import { buildPatched, resolveCheckout } from "../scripts/patched-check.js";

const run: PatchedResult = {
  status: "run",
  scenario: "dependency-vuln",
  before: { attackSucceeded: true },
  after: { attackSucceeded: false },
  command: "bun test test/checkout.test.ts",
  vulnerableRef: "main",
  patchedRef: "custody/inc-1",
};

describe("the patched block", () => {
  test("defaults to not run with a reason when no patched build is supplied", () => {
    const result = ablate(SCENARIOS);
    expect(result.patched.status).toBe("not run");
    if (result.patched.status === "not run") expect(result.patched.reason).toBeTruthy();
  });

  test("carries the measured before and after when supplied", () => {
    const result = ablate(SCENARIOS, { patched: run });
    expect(result.patched).toEqual(run);
    expect(formatPatched(result.patched)).toContain("before attackSucceeded true");
    expect(formatPatched(result.patched)).toContain("after false");
  });

  test("a missing checkout resolves to nothing instead of a fake run", () => {
    expect(resolveCheckout(undefined)).toBeUndefined();
    expect(resolveCheckout("/nonexistent/custody-checkout")).toBeUndefined();
  });
});

const vulnerable = process.env.CUSTODY_VULNERABLE;
const patched = process.env.CUSTODY_PATCHED;

const live = vulnerable && patched ? test : test.skip;

live("fails the reproduction before the patch and passes after it", () => {
  const before = resolveCheckout(vulnerable);
  const after = resolveCheckout(patched);
  if (!before || !after) throw new Error("env supplied but checkout did not resolve");
  const result = buildPatched(before, after);
  if (result.status !== "run") throw new Error("expected a measured patched block");
  expect(result.before.attackSucceeded).toBe(true);
  expect(result.after.attackSucceeded).toBe(false);
});
