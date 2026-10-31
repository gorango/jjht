#!/usr/bin/env bun
/**
 * Drive the running dashboard through all ten scenarios and assert the summary.
 * Usage: bun scripts/dashboard-check.ts [baseUrl]
 */
const base = process.argv[2] ?? process.env.CUSTODY_DASHBOARD ?? "http://localhost:8787";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scenarios = (await (await fetch(`${base}/api/scenarios`)).json()) as Array<{ id: string }>;
if (scenarios.length !== 10) throw new Error(`expected 10 scenarios, got ${scenarios.length}`);

const lines: string[] = [];
for (const scenario of scenarios) {
  const started = await fetch(`${base}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario: scenario.id }),
  });
  if (started.status !== 200) throw new Error(`${scenario.id}: POST ${started.status}`);
  const { runId } = (await started.json()) as { runId: string };

  let running = true;
  let guard = 0;
  while (running) {
    const page = (await (await fetch(`${base}/api/runs/${runId}/events?offset=0`)).json()) as {
      running: boolean;
    };
    running = page.running;
    if (running) await sleep(200);
    if (++guard > 150) throw new Error(`${scenario.id}: did not finish`);
  }

  const s = (await (await fetch(`${base}/api/runs/${runId}/summary`)).json()) as {
    exitCode: number | null;
    expectedMatches: number;
    expectedTotal: number;
    inflightMax: number;
    executedCount: number;
    harmfulCount: number;
  };
  const ok = s.exitCode === 0 && s.expectedMatches === s.expectedTotal && s.harmfulCount === 0;
  lines.push(
    `${ok ? "ok  " : "FAIL"} ${scenario.id} exit=${s.exitCode} ` +
      `${s.expectedMatches}/${s.expectedTotal} inflight=${s.inflightMax} ` +
      `effects=${s.executedCount} harmful=${s.harmfulCount}`,
  );
}

console.log(lines.join("\n"));
const pass = lines.every((line) => line.startsWith("ok"));
console.log(pass ? "ALL TEN PASS" : "ALL TEN FAIL");
process.exit(pass ? 0 : 1);
