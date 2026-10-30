import assert from "node:assert/strict";
import { test } from "node:test";

import { checkCitations, structuralRejects } from "../src/agents/roles.js";
import { loadDataset } from "../src/domain/dataset.js";
import { MemoryMarket } from "../src/domain/market.js";
import type { Proposal } from "../src/domain/types.js";

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

/* -------------------------------------------------------------------------- */
/* Structural gates                                                           */
/* -------------------------------------------------------------------------- */

const dataset = loadDataset();
const researcher = dataset.byResearcherId.get("R0001")!;
const publicationTitle = dataset.publications.get(researcher.publications[0]!)!.title;

const validProposal = (): Proposal => ({
  id: "P-C001-CH1-R0001",
  companyId: "C001",
  challengeId: "C001-CH1",
  researcherId: "R0001",
  title: "A proposal",
  markdown: [
    "# A proposal",
    "## The problem",
    "The company needs a verifiable compiler pass.",
    "## Research questions",
    "1. Can the pass be proved correct?",
    "## Plan",
    "| Year | Work | Result |",
    "| 1 | Build a baseline on 2,000 samples | A working baseline |",
    "## What each side brings",
    "- **Company:** data.",
    "## Why this pair",
    `The paper "${publicationTitle}" is the closest work.`,
    "## Agreed up front",
    "- Results may be published after a 60-day review.",
    "## Risks",
    "The pair fails if the company cannot share its data.",
    "## Unverified evidence",
    "- Budget is not confirmed.",
    "## Supervisors and candidate",
    "- **Academic supervisor:** the researcher.",
  ].join("\n"),
  citations: ["R0001", publicationTitle],
  status: "review",
  revision: 0,
  criticNote: "",
  supervisors: { academic: "Prof. A", industrial: "B. Engineer" },
  namedPublication: publicationTitle,
  candidate: "a master's graduate in computer engineering",
  researchQuestions: ["Can the pass be proved correct?"],
  plan: [{ year: 1, work: "Build a baseline on 2,000 samples", result: "A working baseline" }],
  whatEachSideBrings: { company: ["data"], faculty: ["supervision"] },
  whyThisPair: `The paper "${publicationTitle}" is the closest work.`,
  agreedUpFront: { publicationReviewDays: 60, ip: "The company owns the models; the faculty keeps the methods." },
  risks: ["The pair fails if the company cannot share its data."],
  unverified: ["Budget is not confirmed."],
});

const codes = (proposal: Proposal): string[] =>
  structuralRejects(proposal, dataset).map((reject) => reject.code);

test("a complete proposal passes every structural gate", () => {
  assert.deepEqual(structuralRejects(validProposal(), dataset), []);
});

test("a missing required section is a hard reject", () => {
  const proposal = validProposal();
  proposal.markdown = proposal.markdown.replace("## Research questions", "## Questions");
  assert.ok(codes(proposal).includes("missing-section"));
});

test("a proposal that names no publication title of the researcher is a hard reject", () => {
  const proposal = validProposal();
  proposal.markdown = proposal.markdown.replace(`"${publicationTitle}"`, "a recent paper");
  assert.ok(codes(proposal).includes("no-publication-title"));
});

test("a year-one plan without a number is a hard reject", () => {
  const proposal = validProposal();
  proposal.plan = [{ year: 1, work: "Build a baseline", result: "A working baseline" }];
  assert.ok(codes(proposal).includes("no-quantified-milestone"));
});

test("a proposal that names no failure mode is a hard reject", () => {
  const proposal = validProposal();
  proposal.risks = [];
  assert.ok(codes(proposal).includes("no-failure-mode"));
});

test("a proposal without supervisors or a candidate is a hard reject", () => {
  const proposal = validProposal();
  proposal.supervisors = { academic: "", industrial: "" };
  proposal.candidate = "";
  assert.ok(codes(proposal).includes("no-supervisors"));
});

test("a proposal without an IP/publication clause is a hard reject", () => {
  const proposal = validProposal();
  proposal.agreedUpFront = { publicationReviewDays: 0, ip: "" };
  assert.ok(codes(proposal).includes("no-ip-publication-clause"));
});
