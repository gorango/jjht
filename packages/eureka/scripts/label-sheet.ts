/**
 * Print a labelling sheet: for each sampled challenge, the retrieval top-k with
 * enough of each researcher's profile to judge a match by hand.
 *
 *   bun scripts/label-sheet.ts > eval/sheet.md
 */
import { loadDataset, ResearcherIndex } from "../src/domain/dataset.js";

const SAMPLE = 20;

const dataset = loadDataset();
const index = new ResearcherIndex(dataset.researchers);

const step = Math.max(1, Math.floor(dataset.companies.length / SAMPLE));
const sampled = dataset.companies.filter((_, position) => position % step === 0).slice(0, SAMPLE);

for (const company of sampled) {
  const challenge = company.challenges[0];
  if (!challenge) continue;

  console.log(`\n## ${challenge.id} — ${company.name}`);
  console.log(`sector: ${company.sector}`);
  console.log(`challenge: ${challenge.text.slice(0, 260)}`);
  console.log(`detail: ${challenge.detail.slice(0, 300)}`);

  const candidates = index.candidatesFor(company, challenge, 5);
  for (const [rank, candidate] of candidates.entries()) {
    const researcher = dataset.byResearcherId.get(candidate.researcherId);
    if (!researcher) continue;
    console.log(
      [
        `  ${rank + 1}. ${researcher.id} ${researcher.name} — ${researcher.fields.slice(0, 2).join("; ")}`,
        `     kw: ${researcher.keywords.slice(0, 6).join(", ")}`,
        `     open: ${researcher.open_to[0] ?? "—"}`,
        `     shared: ${candidate.sharedTerms.join(", ")}`,
      ].join("\n"),
    );
  }
}
