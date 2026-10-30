---
id: C10
title: "Taint authority and boundary"
type: grilling
status: closed
parent: CUSTODY-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Taint authority and boundary

## Question

Which layer sets `tainted`, and exactly which fields of which telemetry types are untrusted?

Decide:

- **The setter.** Ingestion, before any model sees the text — not Watch, not the model, not the
  intent parser. Confirm this and define what "ingestion" means in the module graph.
- **The boundary.** For each telemetry source (network, auth, runtime, logs, tickets, filenames,
  headers, error messages): which fields are attacker-controlled, which are trusted counters, and
  what is the default when unknown?
- **The trusted list.** Kernel/network counters the attacker cannot write, deploy events, topology.
  Who maintains it, and what happens if a source is misclassified?
- **Propagation.** Is taint per-event or per-field? How does it survive parsing into an `Intent`?
  Does a rationale citing one trusted and one tainted event inherit taint? Does a note field taint
  the whole rationale?
- **Compromised Watch.** If Watch is compromised, what can it clear, forge, or re-label? The answer
  must be "nothing that changes the bit" for the claim to hold.
- **Second key interaction.** Tainted + second key = allowed; tainted + no key = rejected. Confirm
  that is the only exception.
- **Testability.** What fixture proves the bit is set before the model, and what test fails if a
  model tries to set it?

## Why this is a decision, not a build

"The logs are attacker-controlled" is the opening sentence of the thesis. If taint is set by a model,
a compromised model clears it and the entry's central claim collapses. The boundary is also the
difference between a demo that rejects an injected log line and one that only rejects a string match.

## Inputs

- `00-thesis.md` §"The thesis", point 4.
- `02-action-model.md` §"Taint".
- `03-airlock.md` §"Open questions" 4.
- `src/domain/types.ts`, `src/domain/invariants.ts`.
- Seed fog note "Taint at ingestion" — now graduated into this ticket.

## Resolution

**Resolved 2026-10-30 (delegated).** Taint is set at **ingestion**, before any model sees the text,
and is **per field**, not per event.

- New `src/runtime/ingest.ts` (or `domain/taint.ts`) normalizes every `TelemetryEvent`:
  `TelemetryEvent.taintedFields: string[]` is populated from a static `TAINT_POLICY` table. The model
  never receives a writable taint bit.
- `Intent.rationale` gains `citedFields: string[]` alongside `eventId`; `tainted` is **computed** by
  the intent parser as "any cited field on the cited event is tainted." A model that emits
  `tainted: false` cannot clear it; the parser overwrites the bit.
- **Taint policy (default tainted when unknown):**

  | Source | Tainted fields | Trusted fields |
  | --- | --- | --- |
  | `logs` | `message`, `body`, `userAgent`, `path`, `query`, `filename` | none |
  | `auth` | `username`, `userAgent`, `raw` | `srcIp` only when it comes from a kernel/network counter |
  | `runtime` | application error text, stack traces | deploy events, health checks, restart counts |
  | `tickets` | all free text | none |
  | `network` | `http.host`, `http.userAgent`, `http.path` | byte/packet/connection counters |
  | `topology` | none | all fields |

- **Propagation:** one primary `eventId` plus `citedFields`; taint if any cited field is tainted. A
  free-text `note` does not taint the rationale unless it is cited. If a future intent cites multiple
  events, extend to `eventIds` and taint if any is tainted.
- **Compromised Watch:** Watch can choose which event to cite and can omit a tainted event, but it
  cannot change `taintedFields` or clear the computed bit. Omission is a provenance/relevance
  problem, not a taint bypass; relevance is a future invariant, stated honestly in the README.
- **Second key:** tainted + valid second key = allowed; tainted without = rejected. This is the only
  exception.
- **Test:** a fixture with a tainted log line and a trusted network counter; assert the bit is set
  before the fake model runs; a fake model that tries to set `tainted: false` has no effect; the
  parser recomputes from `taintedFields`.
