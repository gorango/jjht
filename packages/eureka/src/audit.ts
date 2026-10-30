/**
 * Offline claim audit.
 *
 *   bun src/index.ts audit run-mock
 *   bun src/index.ts audit examples/run-full
 *
 * Re-resolves every source id in every claim in a committed trace against the
 * dataset. The Critic already did this at review time; the audit exists so a
 * judge can repeat it without trusting the runtime, the model or the README.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadDataset, lookupSource } from "./domain/dataset.js";

interface TraceLine {
  type: string;
  producer: string;
  data?: any;
}

export interface AuditRow {
  claim: string;
  proposalId: string;
  sources: string[];
  unresolved: string[];
}

export interface AuditResult {
  rows: AuditRow[];
  unresolved: number;
  claims: number;
}

const sourceIds = (): Set<string> => {
  const dataset = loadDataset();
  const ids = new Set<string>();
  const add = (id: string | undefined) => {
    if (id) ids.add(id);
  };
  for (const researcher of dataset.researchers) add(researcher.id);
  for (const id of dataset.publications.keys()) add(id);
  for (const id of dataset.projects.keys()) add(id);
  for (const id of dataset.patents.keys()) add(id);
  for (const id of dataset.byChallengeId.keys()) add(id);
  for (const id of dataset.byCompanyId.keys()) add(id);
  return ids;
};

export const auditLines = (lines: TraceLine[], known: ReadonlySet<string>): AuditResult => {
  const rows = new Map<string, AuditRow>();
  for (const line of lines) {
    if (line.type !== "proposal.reviewed") continue;
    const claims: Array<{ id?: string; text?: string; sources?: string[] }> = Array.isArray(line.data?.claims)
      ? line.data.claims
      : [];
    for (const claim of claims) {
      const key = claim.id ?? `${line.data?.claim ?? ""}:${claim.text}`;
      const sources = Array.isArray(claim.sources) ? claim.sources.map(String) : [];
      rows.set(key, {
        claim: String(claim.text ?? "(no text)"),
        proposalId: String(line.data?.proposalId ?? ""),
        sources,
        unresolved: sources.filter((id) => !known.has(id)),
      });
    }
  }
  const result = [...rows.values()];
  return {
    rows: result,
    claims: result.length,
    unresolved: result.filter((row) => row.unresolved.length > 0).length,
  };
};

const locateTrace = (run: string): string | undefined => {
  const candidates = [
    resolve(process.cwd(), "runs", run, "trace.jsonl"),
    resolve(process.cwd(), "examples", run, "trace.jsonl"),
    resolve(process.cwd(), run, "trace.jsonl"),
    resolve(process.cwd(), run),
  ];
  return candidates.find((candidate) => existsSync(candidate));
};

export const auditRun = (run: string): number => {
  const file = locateTrace(run);
  if (!file) {
    console.error(`no trace for '${run}' (looked in runs/ and examples/)`);
    return 2;
  }
  const lines = readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceLine);
  const dataset = loadDataset();
  const known = sourceIds();
  const result = auditLines(lines, known);

  const width = Math.min(64, Math.max(...result.rows.map((row) => row.claim.length), 20));
  console.log(`\n  audit ${file}`);
  console.log(`  ${result.claims} claims\n`);
  console.log(`  ${"claim".padEnd(width)}  ${"sources".padEnd(24)}  status`);
  console.log(`  ${"-".repeat(width)}  ${"-".repeat(24)}  ------`);
  for (const row of result.rows) {
    const status =
      row.unresolved.length > 0
        ? `UNRESOLVED ${row.unresolved.join(", ")}`
        : row.sources.length === 0
          ? "no source"
          : "resolved";
    const sources = row.sources.length > 0 ? row.sources.join(", ") : "(none)";
    const claim = row.claim.length > width ? `${row.claim.slice(0, width - 1)}…` : row.claim;
    console.log(`  ${claim.padEnd(width)}  ${sources.padEnd(24)}  ${status}`);
  }

  if (result.rows.length > 0) {
    const sample = result.rows[0]!;
    for (const id of sample.sources.slice(0, 1)) {
      const record = lookupSource(dataset, id);
      if (record) console.log(`\n  example source: ${id} — ${record.type}: ${record.label}`);
    }
  }

  console.log(
    `\n  ${result.unresolved === 0 ? "PASS" : "FAIL"}: ${result.claims - result.unresolved}/${result.claims} claims resolve\n`,
  );
  return result.unresolved === 0 ? 0 : 1;
};
