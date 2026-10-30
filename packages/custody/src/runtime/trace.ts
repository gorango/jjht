/**
 * The trace is a deliverable, not a debugging aid. It is written by an ordinary
 * participant subscribed to every event, so what it records is exactly what the
 * bus carried.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Human, SituationSpecification, type SemanticEvent } from "@mozaik-ai/core";

import { join } from "./session.js";

export interface TraceRow {
  at: string;
  producerId: string;
  type: string;
  loopId?: string;
  payload: unknown;
}

class Everything extends SituationSpecification {
  override isSatisfiedBy(): boolean {
    return true;
  }
}

export class Trace {
  readonly rows: TraceRow[] = [];

  readonly file: string;

  constructor(file: string) {
    this.file = resolve(file);
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, "");
  }

  record(event: SemanticEvent): void {
    const payload = event.payload as { loopId?: unknown } | undefined;
    const loopId = typeof payload?.loopId === "string" ? payload.loopId : undefined;
    const row: TraceRow = {
      at: event.occurredAt.toISOString(),
      producerId: event.producerId,
      type: event.type,
      ...(loopId ? { loopId } : {}),
      payload: event.payload,
    };
    this.rows.push(row);
    appendFileSync(this.file, `${JSON.stringify(row)}\n`);
  }

  observe(): void {
    const observer = new Human(
      { id: "trace", name: "Trace", role: "human", capabilities: ["observe"] },
      [
        {
          specification: new Everything(),
          processor: { apply: ({ event }) => this.record(event) },
        },
      ],
    );
    join(observer);
  }
}
