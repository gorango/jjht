/**
 * Guard the committed evidence against drift.
 *
 *   bun run check:examples
 *
 * 1. Every number in examples/README.md's table must equal examples/<dir>/run.json.
 * 2. Every run must have the trace shape its paragraph claims (rejections with a
 *    machine-readable reason, approvals, portfolio.ready, run.completed).
 * 3. The headline numbers in the top-level README must match the artefacts.
 *
 * Exits non-zero on any mismatch.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const EXAMPLES = ["run-openrouter", "run-proposals", "run-full", "run-mock"] as const;

interface Summary {
  runId: string;
  elapsedMs: number;
  companies: number;
  challenges: number;
  proposals: number;
  approved: number;
  portfolio: number;
  rejections: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface Artefact {
  summary: Summary;
  maxInFlight: number;
  rejected: number;
  approvedReviews: number;
  hasHardRejects: boolean;
  hasPortfolioReady: boolean;
  hasRunCompleted: boolean;
}

const failures: string[] = [];
const fail = (message: string): void => {
  failures.push(message);
};
const expectEqual = (label: string, actual: unknown, expected: unknown): void => {
  if (actual !== expected) fail(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
};

const readArtefact = (dir: string): Artefact => {
  const run = JSON.parse(readFileSync(resolve(ROOT, "examples", dir, "run.json"), "utf8")) as { summary: Summary };
  const lines = readFileSync(resolve(ROOT, "examples", dir, "trace.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; data?: any });

  let live = 0;
  let maxInFlight = 0;
  let rejected = 0;
  let approvedReviews = 0;
  let hasHardRejects = false;
  for (const line of lines) {
    if (line.type === "inference.started") maxInFlight = Math.max(maxInFlight, ++live);
    else if (line.type === "inference.completed") live -= 1;
    else if (line.type === "proposal.reviewed") {
      if (line.data?.verdict === "reject") rejected += 1;
      if (line.data?.verdict === "approve") approvedReviews += 1;
      if (Array.isArray(line.data?.hardRejects) && line.data.hardRejects.length > 0) hasHardRejects = true;
    }
  }

  return {
    summary: run.summary,
    maxInFlight,
    rejected,
    approvedReviews,
    hasHardRejects,
    hasPortfolioReady: lines.some((line) => line.type === "portfolio.ready"),
    hasRunCompleted: lines.some((line) => line.type === "run.completed"),
  };
};

const artefacts = Object.fromEntries(EXAMPLES.map((dir) => [dir, readArtefact(dir)])) as Record<
  (typeof EXAMPLES)[number],
  Artefact
>;

// Expectations are read from the artefacts themselves. Hard-coding them here
// meant every refresh needed a code edit, which is exactly the drift the guard
// is supposed to prevent. Structural invariants stay hard-coded.
for (const dir of EXAMPLES) {
  const artefact = artefacts[dir];
  if (!artefact.hasPortfolioReady) fail(`${dir}: trace has no portfolio.ready`);
  if (!artefact.hasRunCompleted) fail(`${dir}: trace has no run.completed`);
  if (artefact.approvedReviews !== artefact.summary.approved) {
    fail(`${dir}: ${artefact.approvedReviews} approve reviews but summary.approved=${artefact.summary.approved}`);
  }
  if (artefact.rejected !== artefact.summary.rejections) {
    fail(`${dir}: ${artefact.rejected} reject reviews but summary.rejections=${artefact.summary.rejections}`);
  }
  if (artefact.rejected < 1) fail(`${dir}: trace has no Critic rejection`);
  if (artefact.summary.modelCalls < 1) fail(`${dir}: trace has no model calls`);
  if (artefact.summary.challenges < 1) fail(`${dir}: run processed no challenges`);
}

for (const dir of ["run-mock", "run-full"] as const) {
  if (artefacts[dir].summary.costUsd !== 0) fail(`${dir}: a mock run must report $0.0000`);
}

const openrouter = artefacts["run-openrouter"].summary;
const proposals = artefacts["run-openrouter"];
if (openrouter.costUsd <= 0) fail("run-openrouter must be a paid run");
if (proposals.summary.proposals < 3) fail("run-openrouter must contain at least three proposals");
if (proposals.rejected < 1) fail("run-openrouter must contain a real Critic rejection");
if (!proposals.hasHardRejects) fail("run-openrouter must show at least one machine-readable hard reject");
if (artefacts["run-proposals"].summary.runId !== openrouter.runId) {
  fail("run-proposals must be the same run as run-openrouter");
}

// The table in examples/README.md is the human-facing copy; parse it and compare.
const examplesReadme = readFileSync(resolve(ROOT, "examples/README.md"), "utf8");
const rows = examplesReadme.split("\n").filter((line) => line.trim().startsWith("|"));
const header = rows.find((line) => EXAMPLES.every((dir) => line.includes(`${dir}/`)));
if (!header) {
  fail("examples/README.md has no table header containing every example directory");
} else {
  const columns = header.split("|").map((cell) => cell.trim());
  const indexOf = Object.fromEntries(
    EXAMPLES.map((dir) => [dir, columns.findIndex((cell) => cell.includes(`${dir}/`))]),
  ) as Record<(typeof EXAMPLES)[number], number>;

  const findRow = (label: string): string[] | undefined => {
    const row = rows.find((line) => line.split("|")[1]?.trim() === label);
    return row?.split("|").map((cell) => cell.trim());
  };
  const numeric = (value: string): number => Number(value.replace(/[$,\s/]/g, "").replace(/s$/, ""));
  const compareRow = (label: string, formatter: (artefact: Artefact) => string | number): void => {
    const row = findRow(label);
    if (!row) {
      fail(`examples/README.md is missing the "${label}" row`);
      return;
    }
    for (const dir of EXAMPLES) {
      expectEqual(`examples/README.md ${label} ${dir}`, numeric(row[indexOf[dir]] ?? ""), numeric(String(formatter(artefacts[dir]))));
    }
  };

  compareRow("Companies / challenges", (a) => `${a.summary.companies}/${a.summary.challenges}`);
  compareRow("Proposals", (a) => a.summary.proposals);
  compareRow("Approved", (a) => a.summary.approved);
  compareRow("Critic rejections", (a) => a.summary.rejections);
  compareRow("Portfolio", (a) => a.summary.portfolio);
  compareRow("Model calls", (a) => a.summary.modelCalls);
  compareRow("Cost (est.)", (a) => a.summary.costUsd.toFixed(4).replace(/^/, "$"));
  compareRow("Wall clock", (a) => `${(a.summary.elapsedMs / 1000).toFixed(1)}s`);
  compareRow("Max in flight", (a) => a.maxInFlight);
}

// Headline numbers in the top-level README. Keep these strings literal so a
// stale README fails loudly instead of quietly disagreeing with the artefacts.
const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
const summary = (dir: (typeof EXAMPLES)[number]): Summary => artefacts[dir].summary;
const snippets = [
  ["mock challenges", `${summary("run-mock").challenges} challenges`],
  ["mock calls", `${summary("run-mock").modelCalls} model calls`],
  ["mock in flight", `${artefacts["run-mock"].maxInFlight} turns in flight`],
  ["real proposals", `${summary("run-openrouter").proposals} proposals`],
  ["real rejections", `${summary("run-openrouter").rejections} Critic rejections`],
  ["real cost", `$${summary("run-openrouter").costUsd.toFixed(4)}`],
  ["full challenges", `${summary("run-full").challenges} challenges`],
  ["full calls", `${summary("run-full").modelCalls} model calls`],
];
for (const [label, snippet] of snippets) {
  if (!readme.includes(snippet)) fail(`README.md does not contain ${label}: ${JSON.stringify(snippet)}`);
}

// The pool-scaling table in README.md must match the committed measurement.
const curve = (
  JSON.parse(readFileSync(resolve(ROOT, "eval/concurrency.json"), "utf8")) as {
    results: Array<{ pools: number; wallClockMs: number; maxInFlight: number; modelCalls: number; costUsd: number }>;
  }
).results;
for (const row of curve) {
  const needle = `| ${row.pools} | ${row.wallClockMs.toLocaleString("en-US")} ms | ${row.maxInFlight} | ${row.modelCalls} | $${row.costUsd.toFixed(4)} |`;
  if (!readme.includes(needle)) fail(`README.md pool-scaling row for pools=${row.pools} is stale: expected ${JSON.stringify(needle)}`);
}

if (failures.length > 0) {
  console.error(`\n  check:examples FAILED (${failures.length})\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error("");
  process.exit(1);
}

console.log(
  `\n  check:examples PASS — ${EXAMPLES.length} artefacts match examples/README.md and README.md; ` +
    `real run: ${openrouter.proposals} proposals, ${artefacts["run-openrouter"].rejected} real rejections\n`,
);
