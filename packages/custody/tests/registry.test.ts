import { describe, expect, test } from "bun:test";

import { ACTIONS } from "../src/domain/registry.js";
import type { ActionName } from "../src/domain/types.js";

const names = Object.keys(ACTIONS) as ActionName[];

describe("the closed action schema", () => {
  test("every action has a definition with a capability", () => {
    for (const name of names) {
      const definition = ACTIONS[name];
      expect(definition.name).toBe(name);
      expect(definition.capability.length).toBeGreaterThan(0);
    }
  });

  test("every destructive action is compensable or explicitly two-key", () => {
    for (const name of names) {
      const definition = ACTIONS[name];
      if (!definition.destructive) continue;
      const compensable = typeof definition.compensation === "function";
      // revoke_token is the deliberate exception: a revoked secret cannot be un-revoked.
      expect(compensable || name === "revoke_token").toBe(true);
    }
  });

  test("destructive actions carry their undo", () => {
    const isolate = ACTIONS.isolate;
    const undo = isolate.compensation?.({
      id: "i-1",
      agent: "contain-1",
      action: "isolate",
      target: { kind: "host", id: "host-7" },
      params: {},
      ttlMs: 1,
      rationale: { eventId: "evt-1", tainted: false },
      requestedAt: 0,
    });
    expect(undo?.action).toBe("release");
    expect(undo?.target.id).toBe("host-7");
  });

  test("a wide block can be narrowed to the suspect", () => {
    const narrowed = ACTIONS.block_egress.narrow?.({
      id: "i-1",
      agent: "contain-1",
      action: "block_egress",
      target: { kind: "edge", id: "edge" },
      params: { cidr: "203.0.113.0/24", suspect: "203.0.113.9" },
      ttlMs: 1,
      rationale: { eventId: "evt-1", tainted: false },
      requestedAt: 0,
    });
    expect(String(narrowed?.params.cidr)).toBe("203.0.113.9/32");
  });
});
