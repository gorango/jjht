import assert from "node:assert/strict";
import { test } from "node:test";

import { checkCitations } from "../src/agents/roles.js";
import { MemoryMarket } from "../src/domain/market.js";

const SOURCES = new Set(["R1008", "C001-CH1", "SYN-PUB-10472"]);

test("a citation that resolves is accepted", () => {
  const { valid, unknown } = checkCitations(["R1008", "SYN-PUB-10472"], SOURCES);
  assert.deepEqual(valid, ["R1008", "SYN-PUB-10472"]);
  assert.deepEqual(unknown, []);
});

test("a fabricated publication is rejected even when it looks plausible", () => {
  const { unknown } = checkCitations(["R1008", "SYN-PUB-99999"], SOURCES);
  assert.deepEqual(unknown, ["SYN-PUB-99999"]);
});

test("duplicate citations are collapsed, not double-counted", () => {
  const { valid } = checkCitations(["C001-CH1", "C001-CH1"], SOURCES);
  assert.deepEqual(valid, ["C001-CH1"]);
});

test("a lease blocks a second worker and a stale generation cannot write", async () => {
  const market = new MemoryMarket();

  const first = market.claim("critic:P1", "critic-1", 10);
  assert.ok(first);
  assert.equal(market.claim("critic:P1", "critic-2", 10_000), undefined);
  assert.equal(market.isCurrent("critic:P1", first.generation), true);

  // A worker that lost the lease cannot release it.
  assert.equal(market.release("critic:P1", first.generation + 999), false);

  // Let the TTL lapse; another worker reclaims it.
  await new Promise((done) => setTimeout(done, 25));
  const second = market.claim("critic:P1", "critic-2", 10_000);
  assert.ok(second);

  // The original worker's write must now be discarded.
  assert.equal(market.isCurrent("critic:P1", first.generation), false);
  assert.equal(market.isCurrent("critic:P1", second.generation), true);
});
