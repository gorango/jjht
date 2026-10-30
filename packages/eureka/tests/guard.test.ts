import assert from "node:assert/strict";
import { test } from "node:test";

import { realPeopleGuard } from "../src/domain/realPeople.js";
import { priceOf } from "../src/inference/pricing.js";

test("an ORCID string is refused before inference", () => {
  assert.match(realPeopleGuard({ researcher: { bio: "see 0000-0002-1825-0097" } }) ?? "", /real-person/);
});

test("an OpenAlex author id and an orcid field are refused", () => {
  assert.match(realPeopleGuard({ profile: { openalex: "A5023888391" } }) ?? "", /real-person/);
  assert.match(realPeopleGuard({ researcher: { orcid_id: "x" } }) ?? "", /real-person/);
});

test("synthetic dataset payloads pass the guard", () => {
  assert.equal(realPeopleGuard({ researcher: { id: "R1008", name: "A Person" }, challenge: { id: "C001-CH1" } }), undefined);
});

test("an unknown model warns and keeps the documented fallback", () => {
  const original = process.env.EUREKA_PRICE_STRICT;
  delete process.env.EUREKA_PRICE_STRICT;
  assert.deepEqual(priceOf("model-that-does-not-exist"), { in: 1, out: 3 });
  if (original !== undefined) process.env.EUREKA_PRICE_STRICT = original;
});

test("strict pricing throws on an unknown model", () => {
  const original = process.env.EUREKA_PRICE_STRICT;
  process.env.EUREKA_PRICE_STRICT = "1";
  assert.throws(() => priceOf("model-that-does-not-exist"), /no price/);
  if (original === undefined) delete process.env.EUREKA_PRICE_STRICT;
  else process.env.EUREKA_PRICE_STRICT = original;
});
