/**
 * Refresh every committed example artefact and the table that quotes it.
 *
 *   bun run refresh:examples          # free: mock, full-scale mock, curve, eval
 *   bun run refresh:examples --real   # paid: also re-run the OpenRouter evidence
 *
 * The paid run is adopted only if it is at least as demonstrative as the one it
 * replaces: >=3 proposals, >=1 Critic rejection, at least one machine-readable
 * hard reject, and a non-zero cost. Otherwise the old artefact is kept and the
 * script exits non-zero, because replacing good evidence with weaker evidence is
 * not a refresh.
 *
 * The README headline is deliberately not rewritten here. `check:examples`
 * fails with the exact strings that need updating, so a human reads the new
 * numbers before they are published.
 */
import { execSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const EXAMPLES = ["run-openrouter", "run-proposals", "run-full", "run-mock"] as const;
type Example = (typeof EXAMPLES)[number];
const FILES = ["trace.jsonl", "portfolio.md", "run.json", "architecture.mmd"] as const;
const withReal = process.argv.includes("--real");

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
  costUsd: number;
}

const run = (command: string, env: Record<string, string> = {}): string => {
  process.stderr.write(`\n$ ${command}\n`);
  return execSync(command, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
};

const runIdOf = (stdout: string): string => {
  const match = /trace\s+runs\/([^\s/]+)\/trace\.jsonl/.exec(stdout);
  if (!match) throw new Error(`could not find the run id in:\n${stdout}`);
  return match[1];
};

const readSummary = (dir: string): Summary =>
  (JSON.parse(readFileSync(resolve(ROOT, "examples", dir, "run.json"), "utf8")) as { summary: Summary }).summary;

const inspect = (runId: string): { rejected: number; approved: number; hardRejects: number } => {
  const lines = readFileSync(resolve(ROOT, "runs", runId, "trace.jsonl"), "utf8").split("\n").filter(Boolean);
  let rejected = 0;
  let approved = 0;
  let hardRejects = 0;
  for (const line of lines) {
    const event = JSON.parse(line) as { type: string; data?: { verdict?: string; hardRejects?: unknown[] } };
    if (event.type !== "proposal.reviewed") continue;
    if (event.data?.verdict === "reject") rejected += 1;
    if (event.data?.verdict === "approve") approved += 1;
    if (Array.isArray(event.data?.hardRejects) && event.data.hardRejects.length > 0) hardRejects += 1;
  }
  return { rejected, approved, hardRejects };
};

const adopt = (runId: string, target: Example): void => {
  for (const file of FILES) {
    copyFileSync(resolve(ROOT, "runs", runId, file), resolve(ROOT, "examples", target, file));
  }
  process.stderr.write(`  adopted runs/${runId} -> examples/${target}/\n`);
};

const refresh = (label: string, command: string, env: Record<string, string>, target: Example): void => {
  process.stderr.write(`\n== ${label}\n`);
  const runId = runIdOf(run(command, env));
  adopt(runId, target);
};

// --- free artefacts -------------------------------------------------------
refresh("mock, default scale", "bun src/index.ts run", { MOCK: "1" }, "run-mock");
refresh("mock, full scale", "bun src/index.ts run --companies=12 --challenges=2", { MOCK: "1" }, "run-full");

// --- paid artefact --------------------------------------------------------
if (withReal) {
  process.stderr.write(`\n== real run (OpenRouter)\n`);
  const runId = runIdOf(run("bun src/index.ts run --companies=4 --challenges=1"));
  const summary = JSON.parse(readFileSync(resolve(ROOT, "runs", runId, "run.json"), "utf8")).summary as Summary;
  const review = inspect(runId);
  const problems: string[] = [];
  if (summary.costUsd <= 0) problems.push("cost is $0, so this was not a paid run");
  if (summary.proposals < 3) problems.push(`${summary.proposals} proposals, need >= 3`);
  if (review.rejected < 1) problems.push("no Critic rejection in the trace");
  if (review.hardRejects < 1) problems.push("no machine-readable hard reject in the trace");
  if (problems.length > 0) {
    console.error(`\n  refresh aborted: the new run is weaker than the committed evidence`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`  kept examples/run-openrouter/ and examples/run-proposals/; new run is left in runs/${runId}/\n`);
    process.exit(1);
  }
  adopt(runId, "run-openrouter");
  adopt(runId, "run-proposals");
}

// --- derived measurements ------------------------------------------------
process.stderr.write(`\n== pool-scaling curve\n`);
execSync("bun scripts/concurrency.ts", { cwd: ROOT, stdio: "inherit" });
process.stderr.write(`\n== retrieval eval\n`);
execSync("bun scripts/eval.ts", { cwd: ROOT, stdio: "inherit" });

// --- keep the README's pool curve in step with eval/concurrency.json ------
const curve = (
  JSON.parse(readFileSync(resolve(ROOT, "eval/concurrency.json"), "utf8")) as {
    results: Array<{ pools: number; wallClockMs: number; maxInFlight: number; modelCalls: number; costUsd: number }>;
  }
).results;
const readmePath = resolve(ROOT, "README.md");
const readmeLines = readFileSync(readmePath, "utf8").split("\n");
let curveRows = 0;
for (let index = 0; index < readmeLines.length; index += 1) {
  const match = /^\| (\d+) \| [\d,]+ ms \| \d+ \| \d+ \| \$[\d.]+ \|$/.exec(readmeLines[index]);
  if (!match) continue;
  const row = curve.find((candidate) => candidate.pools === Number(match[1]));
  if (!row) continue;
  readmeLines[index] =
    `| ${row.pools} | ${row.wallClockMs.toLocaleString("en-US")} ms | ${row.maxInFlight} | ${row.modelCalls} | $${row.costUsd.toFixed(4)} |`;
  curveRows += 1;
}
if (curveRows === 0) throw new Error("README.md has no pool-scaling table rows to update");
writeFileSync(readmePath, readmeLines.join("\n"));

// --- keep examples/README.md's table in step ------------------------------
const date = new Date().toISOString().slice(0, 10);
const summaryOf = Object.fromEntries(EXAMPLES.map((dir) => [dir, readSummary(dir)])) as Record<Example, Summary>;
const inFlight = (dir: Example): number => {
  const lines = readFileSync(resolve(ROOT, "examples", dir, "trace.jsonl"), "utf8").split("\n").filter(Boolean);
  let live = 0;
  let peak = 0;
  for (const line of lines) {
    const type = (JSON.parse(line) as { type: string }).type;
    if (type === "inference.started") peak = Math.max(peak, ++live);
    else if (type === "inference.completed") live -= 1;
  }
  return peak;
};
const cells = (value: (summary: Summary, dir: Example) => string): Record<Example, string> =>
  Object.fromEntries(EXAMPLES.map((dir) => [dir, value(summaryOf[dir], dir)])) as Record<Example, string>;

const rows: Record<string, Record<Example, string>> = {
  Date: cells((s) => s.runId.replace(/^run-/, "").slice(0, 10)),
  "Companies / challenges": cells((s) => `${s.companies} / ${s.challenges}`),
  Proposals: cells((s) => String(s.proposals)),
  Approved: cells((s) => String(s.approved)),
  "Critic rejections": cells((s) => String(s.rejections)),
  Portfolio: cells((s) => String(s.portfolio)),
  "Model calls": cells((s) => String(s.modelCalls)),
  "Cost (est.)": cells((s) => `$${s.costUsd.toFixed(4)}`),
  "Wall clock": cells((s) => `${(s.elapsedMs / 1000).toFixed(1)}s`),
  "Max in flight": cells((_s, dir) => String(inFlight(dir))),
};

const path = resolve(ROOT, "examples/README.md");
const lines = readFileSync(path, "utf8").split("\n");
const headerIndex = lines.findIndex((line) => EXAMPLES.every((dir) => line.includes(`${dir}/`)));
if (headerIndex === -1) throw new Error("examples/README.md has no table header containing every example directory");
const columns = lines[headerIndex].split("|").map((cell) => cell.trim());
const columnOf = Object.fromEntries(
  EXAMPLES.map((dir) => [dir, columns.findIndex((cell) => cell.includes(`${dir}/`))]),
) as Record<Example, number>;

for (let index = 0; index < lines.length; index += 1) {
  const parts = lines[index].split("|");
  const label = parts[1]?.trim();
  const values = label ? rows[label] : undefined;
  if (!values) continue;
  for (const dir of EXAMPLES) {
    const column = columnOf[dir];
    if (column < 0) continue;
    parts[column] = ` ${values[dir]} `;
  }
  lines[index] = parts.join("|");
}
writeFileSync(path, lines.join("\n"));

process.stderr.write(`\n== examples/README.md table updated from committed run ids (${date})\n`);
process.stderr.write(`\nNow run: bun run check:examples\n`);
process.stderr.write(`It will name any README headline strings that still quote old numbers.\n\n`);
