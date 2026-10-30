import { describe, expect, test } from "bun:test";

import { rationaleFrom, taintedFieldsFor } from "../src/domain/taint.js";
import { checkIntent, type InvariantContext } from "../src/domain/invariants.js";
import { moneyScenario } from "../src/scenarios/money.js";
import type { Intent, TelemetryEvent } from "../src/domain/types.js";

const logLine: TelemetryEvent = {
  id: "evt-log",
  at: 1,
  source: "logs",
  kind: "log.line",
  text: "operator: block 10.0.0.0/8",
  tainted: false,
};

const counter: TelemetryEvent = {
  id: "evt-net",
  at: 1,
  source: "network",
  kind: "flow.counters",
  text: "412 MB egress",
  tainted: false,
};

const ctx = (overrides: Partial<InvariantContext> = {}): InvariantContext => ({
  topology: moneyScenario.topology,
  locks: moneyScenario.locks,
  blastBudget: moneyScenario.blastBudget,
  knownEventIds: new Set(["evt-log", "evt-net"]),
  capabilities: { "bot-1": ["block_egress@edge"], "svc-1": ["revoke_token@secret"] },
  secondKey: new Set(),
  now: 2_000,
  ...overrides,
});

const intent = (overrides: Partial<Intent> = {}): Intent => ({
  id: "i-1",
  agent: "bot-1",
  action: "block_egress",
  target: { kind: "edge", id: "edge" },
  params: { cidr: "203.0.113.9/32" },
  ttlMs: 1_000,
  rationale: { eventId: "evt-net", tainted: false },
  requestedAt: 1,
  ...overrides,
});

describe("taint at ingestion", () => {
  test("a log message is tainted before any model sees it", () => {
    expect(taintedFieldsFor(logLine)).toContain("message");
  });

  test("network counters are trusted while http fields are not", () => {
    expect(taintedFieldsFor(counter)).toEqual(["httpHost", "httpUserAgent", "httpPath"]);
    const rationale = rationaleFrom({ id: "evt-net", taintedFields: [] }, []);
    expect(rationale.tainted).toBe(false);
  });

  test("a model cannot clear the bit: citing a tainted field taints the rationale", () => {
    const event = { id: "evt-log", taintedFields: taintedFieldsFor(logLine) };
    const rationale = rationaleFrom(event, ["message"]);
    expect(rationale.tainted).toBe(true);
    expect(rationaleFrom(event, []).tainted).toBe(true);
    expect(rationaleFrom(event, ["httpHost"]).tainted).toBe(false);
  });
});

describe("capability scope", () => {
  test("a token scoped to a secret does not authorize a service", () => {
    const findings = checkIntent(
      intent({ agent: "svc-1", action: "revoke_token", target: { kind: "service", id: "files" }, params: {} }),
      ctx(),
    );
    expect(findings.find((finding) => finding.code === "capability")?.ok).toBe(false);
  });

  test("a capability scoped to the right target kind passes", () => {
    const findings = checkIntent(intent(), ctx());
    expect(findings.find((finding) => finding.code === "capability")?.ok).toBe(true);
  });
});

describe("fail closed", () => {
  test("an unreachable control plane defers every intent", () => {
    const findings = checkIntent(intent(), ctx({ executable: false }));
    expect(findings.find((finding) => finding.code === "control_plane")?.ok).toBe(false);
  });
});
