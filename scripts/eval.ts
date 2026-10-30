/**
 * Retrieval evaluation against hand labels.
 *
 *   npm run eval
 *
 * Answers the question the rubric actually asks ("are the pairs right?") rather
 * than the easier one the trace answers ("do the sources resolve?").
 *
 * Metrics, all computed over the labelled challenges:
 *   precision@1  — is the top-ranked researcher a labelled fit?
 *   precision@3  — share of the top three that are labelled fits
 *   hit@3        — does the top three contain at least one labelled fit?
 *   MRR          — 1/rank of the first labelled fit
 *
 * Challenges with an empty gold set are reported separately: "no qualified
 * researcher in the retrieved set" is a finding, not a zero.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadDataset, ResearcherIndex } from "../src/domain/dataset.js";

interface Labels {
  method: string;
  labelledBy: string;
  challenges: Array<{ challengeId: string; gold: string[]; note: string }>;
}

const labels = JSON.parse(readFileSync(resolve("eval/labels.json"), "utf8")) as Labels;
const dataset = loadDataset();
const index = new ResearcherIndex(dataset.researchers);

const K = 3;
let scored = 0;
let precisionAt1 = 0;
let precisionAt3 = 0;
let hitAt3 = 0;
let reciprocalRank = 0;
const misses: string[] = [];
const noGold: string[] = [];

for (const label of labels.challenges) {
  const entry = dataset.byChallengeId.get(label.challengeId);
  if (!entry) {
    console.warn(`label references unknown challenge ${label.challengeId}`);
    continue;
  }

  const gold = new Set(label.gold);
  if (gold.size === 0) {
    noGold.push(label.challengeId);
    continue;
  }

  const ranked = index
    .candidatesFor(entry.company, entry.challenge, 10)
    .map((candidate) => candidate.researcherId);

  scored += 1;
  if (gold.has(ranked[0] ?? "")) precisionAt1 += 1;

  const topK = ranked.slice(0, K);
  precisionAt3 += topK.filter((id) => gold.has(id)).length / K;
  if (topK.some((id) => gold.has(id))) hitAt3 += 1;

  const firstHit = ranked.findIndex((id) => gold.has(id));
  if (firstHit >= 0) reciprocalRank += 1 / (firstHit + 1);
  else misses.push(`${label.challengeId} (gold: ${[...gold].join(", ")})`);
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const result = {
  generatedAt: new Date().toISOString(),
  labelledChallenges: labels.challenges.length,
  scored,
  noGold,
  metrics: {
    precisionAt1: precisionAt1 / scored,
    precisionAt3: precisionAt3 / scored,
    hitAt3: hitAt3 / scored,
    mrr: reciprocalRank / scored,
  },
  misses,
};

writeFileSync(resolve("eval/results.json"), `${JSON.stringify(result, null, 2)}\n`);

console.log(
  [
    "",
    `  labelled challenges   ${labels.challenges.length} (${noGold.length} with no qualified researcher in the top 10)`,
    `  scored                ${scored}`,
    "",
    `  precision@1           ${pct(result.metrics.precisionAt1)}`,
    `  precision@3           ${pct(result.metrics.precisionAt3)}`,
    `  hit@3                 ${pct(result.metrics.hitAt3)}`,
    `  MRR                   ${result.metrics.mrr.toFixed(2)}`,
    "",
    misses.length ? `  no hit at all: ${misses.join("; ")}` : "  every labelled challenge had a hit in the top 10",
    "",
  ].join("\n"),
);
