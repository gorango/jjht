import { describe, expect, test } from "bun:test";

import { checkIntent, failures, hasFailure, type InvariantContext } from "../src/domain/invariants.js";
import { demoTopology } from "../src/domain/topology.js";
import type { Intent } from "../src/domain/types.js";

const base = (overrides: Partial<Intent> = {}): Intent => ({
  id: "i-1",
  agent: "contain-1",
  action: "block_egress",
  target: { kind: "edge", id: "edge" },
  params: { cidr: "203.0.113.9/32" },
  ttlMs: 60_000,
  rationale: { eventId: "evt-1", tainted: false },
  requestedAt: 1,
  ...overrides,
});

const context = (overrides: Partial<InvariantContext> = {}): InvariantContext => ({
  topology: demoTopology,
  locks: [],
  blastBudget: 0.08,
  knownEventIds: new Set(["evt-1"]),
  capabilities: { "contain-1": ["block_egress", "isolate"], "edge-bot": ["block_egress"], "human-1": ["*"] },
  secondKey: new Set(),
  now: 2_000,
  ...overrides,
});

describe("invariants", () => {
  test("a /32 block is within budget, a /24 is not", () => {
    const narrow = checkIntent(base(), context());
    expect(hasFailure(narrow, "blast")).toBe(false);

    const wide = checkIntent(base({ params: { cidr: "203.0.113.0/24" } }), context());
    expect(hasFailure(wide, "blast")).toBe(true);
  });

  test("a destructive action on a locked host is refused", () => {
    const isolate = base({
      action: "isolate",
      target: { kind: "host", id: "host-7" },
      params: {},
    });
    const ctx = context({
      locks: [{ targetId: "host-7", holder: "preserve-1", reason: "capture in flight", until: 9_999 }],
    });

    expect(hasFailure(checkIntent(isolate, ctx), "evidence")).toBe(true);
  });

  test("an action justified only by tainted text needs a second key", () => {
    const injected = base({
      agent: "edge-bot",
      params: { cidr: "203.0.113.9/32" },
      rationale: { eventId: "evt-2", tainted: true },
    });
    const ctx = context({ knownEventIds: new Set(["evt-1", "evt-2"]) });

    expect(hasFailure(checkIntent(injected, ctx), "taint")).toBe(true);
    expect(hasFailure(checkIntent(injected, { ...ctx, secondKey: new Set(["i-1"]) }), "taint")).toBe(false);
  });

  test("an action with no undo needs a second key even when untainted", () => {
    const revoke = base({
      action: "revoke_token",
      target: { kind: "service", id: "payments-api" },
      params: {},
    });

    expect(hasFailure(checkIntent(revoke, context()), "compensation")).toBe(true);
    expect(hasFailure(checkIntent(revoke, context({ secondKey: new Set(["i-1"]) })), "compensation")).toBe(false);
  });

  test("blocking an internal range is a self-inflicted outage", () => {
    const internal = base({ params: { cidr: "10.0.0.0/8" } });
    const findings = checkIntent(internal, context());
    expect(hasFailure(findings, "protected_cidr")).toBe(true);
    expect(hasFailure(findings, "blast")).toBe(true);
  });

  test("a rationale that cites an unknown event has no provenance", () => {
    const ghost = base({ rationale: { eventId: "evt-does-not-exist", tainted: false } });
    expect(hasFailure(checkIntent(ghost, context()), "provenance")).toBe(true);
  });

  test("capabilities are enforced in code", () => {
    const unauthorised = base({ agent: "preserve-1" });
    const ctx = context({ capabilities: { "preserve-1": ["snapshot"] } });
    expect(hasFailure(checkIntent(unauthorised, ctx), "capability")).toBe(true);
  });

  test("failures are reported, holds are not", () => {
    const findings = checkIntent(base(), context());
    expect(failures(findings).length).toBe(0);
  });
});
