/**
 * Turn a saved money trace into the two artifacts the slow loop consumes: the
 * issue CUSTODIAN writes and the goal an independent agent executes. The trace is
 * the source of truth; the scenario fixture supplies the title and expectations.
 */
import type { Scenario } from "../scenarios/types.js";

export interface TraceRow {
  at: string;
  producerId: string;
  type: string;
  loopId?: string;
  payload: any;
}

export interface HandoffDecision {
  intentId: string;
  agent: string;
  action: string;
  target: string;
  kind: string;
  reason: string;
}

export interface HandoffTelemetry {
  id: string;
  source: string;
  kind: string;
  text: string;
  tainted: boolean;
}

export interface HandoffSource {
  scenario: string;
  title: string;
  tracePath: string;
  incidentId: string;
  decisions: HandoffDecision[];
  telemetry: HandoffTelemetry[];
  executed: Array<{ intentId: string; action: string; target: string }>;
  anchor?: string;
  bundle?: string;
}

export interface HandoffOptions {
  push?: boolean;
  vulnerableSource?: string;
}

export interface Handoff {
  source: HandoffSource;
  issue: string;
  goal: string;
}

const cell = (value: string): string => value.replace(/\|/g, "\\|");

const readRows = (rows: readonly TraceRow[]): HandoffSource => {
  const decisions: HandoffDecision[] = [];
  const telemetry: HandoffTelemetry[] = [];
  const executed: HandoffSource["executed"] = [];
  let scenario = "";
  let incidentId = "inc-1";
  let tracePath = "";
  let anchor: string | undefined;
  let bundle: string | undefined;

  for (const row of rows) {
    const payload = row.payload ?? {};
    switch (row.type) {
      case "run.started":
        scenario = String(payload.scenario ?? "");
        break;
      case "incident.opened":
        incidentId = String(payload.incidentId ?? incidentId);
        break;
      case "telemetry.received": {
        const event = payload.event ?? {};
        telemetry.push({
          id: String(event.id ?? ""),
          source: String(event.source ?? ""),
          kind: String(event.kind ?? ""),
          text: String(event.text ?? ""),
          tainted: Boolean(event.tainted),
        });
        break;
      }
      case "decision.made": {
        const decision = payload.decision ?? {};
        decisions.push({
          intentId: String(decision.intentId ?? ""),
          agent: String(decision.agent ?? ""),
          action: String(decision.action ?? ""),
          target: String(decision.target ?? ""),
          kind: String(decision.kind ?? ""),
          reason: String(decision.reason ?? ""),
        });
        break;
      }
      case "action.executed": {
        const intent = payload.intent ?? {};
        const target = intent.target ?? {};
        executed.push({
          intentId: String(intent.id ?? ""),
          action: String(intent.action ?? ""),
          target: String(target.id ?? ""),
        });
        break;
      }
      case "evidence.anchored":
        anchor = String(payload.anchor ?? "") || undefined;
        bundle = String(payload.bundle ?? "") || undefined;
        break;
      default:
        break;
    }
  }

  return {
    scenario,
    title: scenario,
    tracePath,
    incidentId,
    decisions,
    telemetry,
    executed,
    ...(anchor ? { anchor } : {}),
    ...(bundle ? { bundle } : {}),
  };
};

export const buildHandoff = (
  rows: readonly TraceRow[],
  scenario: Scenario,
  tracePath: string,
  options: HandoffOptions = {},
): Handoff => {
  const source = readRows(rows);
  source.scenario = scenario.id;
  source.title = scenario.title;
  source.tracePath = tracePath;

  const tainted = source.telemetry.filter((event) => event.tainted);
  const evidenceIds = source.telemetry.map((event) => event.id).filter(Boolean);
  const anchorLine = source.anchor
    ? `  - snapshot anchor ${source.anchor}${source.bundle ? ` (${source.bundle})` : ""}`
    : "  - no evidence anchor in this run (the simulated adapter does not anchor)";
  // A story cannot publish: baro's story lanes reject `git push` and every `gh`
  // call. The finalizer pushes the integrated branch and opens the PR. Asking a
  // story to open one only burns its turn budget on the publish guard.
  const publication = options.push
    ? "  - do not merge; leave delivery to baro's finalizer"
    : "  - do not push or open a pull request; leave the fix as a local commit";

  const goal = `goal: Fix the shell injection in src/checkout.ts in gorango/jjhts.
repo: https://github.com/gorango/jjhts (branch main)
file: src/checkout.ts
failing test: test/checkout.test.ts > does not execute a shell metacharacter from User-Agent
acceptance:
  - bun test passes
  - no shell interpolation of request headers remains in src/
  - the fix uses an argument array (execFile/spawn), not a WAF rule
constraints:
  - do not change test/checkout.test.ts
  - do not add dependencies
${publication}
evidence:
  - trace ${tracePath}
  - telemetry ${tainted.map((event) => event.id).join(", ") || "(none marked tainted)"}
${anchorLine}
`;

  const decisionRows = source.decisions
    .map(
      (decision) =>
        `| \`${cell(decision.intentId)}\` | ${cell(decision.agent)} | ${cell(decision.action)} | ${cell(decision.target)} | ${cell(decision.kind.toUpperCase())} | ${cell(decision.reason)} |`,
    )
    .join("\n");

  const taintedBlocks = tainted.length
    ? tainted
        .map(
          (event) =>
            `\`${event.id}\` (${event.source}/${event.kind}) is attacker-controlled:\n\n\`\`\`text\n${event.text}\n\`\`\``,
        )
        .join("\n\n")
    : "No telemetry event in this trace is marked tainted.";

  const issue = `# CUSTODIAN handoff: ${scenario.title}

Generated from \`${tracePath}\` for incident \`${source.incidentId}\`. The runtime made these
decisions; an independent agent executes the goal below.

## Decisions

| intent | agent | action | target | decision | reason |
| --- | --- | --- | --- | --- | --- |
${decisionRows || "| (none) | | | | | |"}

## Tainted input

${taintedBlocks}

## Affected file

\`src/checkout.ts\`${options.vulnerableSource ? `:\n\n\`\`\`ts\n${options.vulnerableSource.trim()}\n\`\`\`` : ` interpolates a request header into a shell command.`}

The string interpolation is the defect. A WAF rule is not a fix.

## Failing test

\`test/checkout.test.ts\` asserts that \`healthProbe("$(id)")\` does not contain \`uid=\`. Before the
patch the test fails; after it passes.

## Evidence

- trace \`${tracePath}\`
- telemetry ${evidenceIds.join(", ") || "(none)"}
- executed effects ${source.executed.map((effect) => `${effect.action}:${effect.target}`).join(", ") || "(none)"}
${source.anchor ? `- snapshot anchor \`${source.anchor}\`${source.bundle ? ` in \`${source.bundle}\`` : ""}` : "- no evidence anchor in this run"}
- issue #1 at <https://github.com/gorango/jjhts/issues/1>
`;

  return { source, issue, goal };
};
