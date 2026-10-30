/**
 * The trace is a deliverable, not a debugging aid: the brief asks for a run trace
 * with time and cost per task, and the EINSTEIN track asks for the trace of one
 * full run showing where the Critic stepped in. So it is written by an ordinary
 * participant that subscribes to every event on the bus, and it ships as JSONL.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { SituationSpecification, createHuman, type SemanticEvent } from "@mozaik-ai/core";

import { type RunSummary } from "./events.js";
import { join } from "./session.js";
import type { EurekaState } from "./state.js";

export interface TraceLine {
  t: number;
  ts: string;
  type: string;
  producer: string;
  summary: string;
  data?: unknown;
}

/** Matches every event on the bus. */
class Everything extends SituationSpecification {
  override isSatisfiedBy(): boolean {
    return true;
  }
}

const truncate = (value: string, max = 1600): string =>
  value.length <= max ? value : `${value.slice(0, max)}… [${value.length - max} chars cut]`;

const summarize = (type: string, payload: any): string => {
  switch (type) {
    case "participant.joined":
      return `+ ${payload.name} (${payload.role})`;
    case "participant.left":
      return `- ${payload.name}`;
    case "work.available":
      return `${payload.role} work available`;
    case "task.claimed":
      return `${payload.role} claims ${payload.item} (${payload.worker}, gen ${payload.generation})`;
    case "model.answer":
      return "answer committed";
    case "inference.started":
      return "inference started";
    case "inference.completed":
      return "inference completed";
    case "task.measured":
      return `${payload.role} ${payload.item} on ${payload.model}: ${payload.inputTokens}→${payload.outputTokens} tokens, $${payload.costUsd.toFixed(4)}, ${payload.durationMs}ms`;
    case "task.failed":
      return `${payload.role} failed on ${payload.item} (${payload.worker}): ${payload.reason}`;
    case "researcher.profiled":
      return `${payload.researcherId} profiled (${payload.profile.expertise.length} expertise areas)`;
    case "challenge.analyzed":
      return `${payload.challengeId} analysed; ${payload.candidates.length} candidates retrieved; needs: ${payload.analysis.needs.slice(0, 3).join(", ")}`;
    case "pairs.ranked":
      return `${payload.challengeId}: ${payload.scores.length} pairs ranked`;
    case "proposal.drafted":
      return `${payload.proposal.id} drafted for ${payload.proposal.companyId}/${payload.proposal.researcherId}`;
    case "proposal.reviewed":
      return `${payload.proposalId}: ${payload.verdict.toUpperCase()} — ${payload.note}`;
    case "proposal.revised":
      return `${payload.proposal.id} revised (revision ${payload.proposal.revision})`;
    case "proposal.abandoned":
      return `${payload.proposalId} abandoned: ${payload.reason}`;
    case "portfolio.ready":
      return `portfolio ready: ${payload.entries.length} collaborations`;
    case "run.completed":
      return `run complete in ${(payload.summary.elapsedMs / 1000).toFixed(1)}s, $${payload.summary.costUsd.toFixed(4)}`;
    case "run.failed":
      return `run failed: ${payload.reason}`;
    default:
      return type;
  }
};

const dataFor = (type: string, payload: any): unknown => {
  switch (type) {
    case "researcher.profiled":
      return payload.profile;
    case "challenge.analyzed":
      return { ...payload.analysis, candidates: payload.candidates };
    case "pairs.ranked":
      return payload.scores;
    case "proposal.drafted":
    case "proposal.revised":
      return { ...payload.proposal, markdown: truncate(payload.proposal.markdown) };
    case "proposal.reviewed":
      return { note: payload.note, verdict: payload.verdict, claims: payload.claims };
    case "portfolio.ready":
      return payload.entries;
    default:
      return undefined;
  }
};

export class Trace {
  readonly dir: string;
  readonly file: string;
  private readonly lines: TraceLine[] = [];
  private readonly names = new Map<string, string>();
  private readonly startedAt = Date.now();

  constructor(readonly runId: string) {
    this.dir = resolve(process.cwd(), "runs", runId);
    mkdirSync(this.dir, { recursive: true });
    this.file = resolve(this.dir, "trace.jsonl");
    writeFileSync(this.file, "");
  }

  record(event: SemanticEvent): void {
    const payload = event.payload as any;
    if (event.type === "participant.joined" && payload?.name) {
      this.names.set(event.producerId, String(payload.name));
    }
    const actorName = this.names.get(event.producerId) ?? event.producerId;
    const line: TraceLine = {
      t: Date.now() - this.startedAt,
      ts: new Date().toISOString(),
      type: event.type,
      producer: actorName,
      summary: summarize(event.type, payload),
      data: dataFor(event.type, payload),
    };
    this.lines.push(line);
    appendFileSync(this.file, `${JSON.stringify(line)}\n`);
    const actor = actorName.padEnd(12);
    console.log(`  ${String(line.t).padStart(6)}ms  ${actor} ${line.summary}`);
  }

  finish(summary: RunSummary, portfolioMarkdown: string, diagram: string): void {
    writeFileSync(resolve(this.dir, "run.json"), JSON.stringify({ summary, lines: this.lines.length }, null, 2));
    writeFileSync(resolve(this.dir, "portfolio.md"), portfolioMarkdown);
    writeFileSync(resolve(this.dir, "architecture.mmd"), diagram);
  }
}

/**
 * Join the Trace observer. It never calls `runLoop` or `sendMessage` — it only
 * reacts, which is exactly what the runtime means by an observer.
 */
export const joinTrace = (state: EurekaState): Trace => {
  const trace = new Trace(state.runId);

  const observer = createHuman({
    name: "Trace",
    capabilities: ["observe"],
    handlers: [
      {
        specification: new Everything(),
        processor: {
          apply({ event }) {
            trace.record(event);
          },
        },
      },
    ],
  });

  join(observer);
  return trace;
};


