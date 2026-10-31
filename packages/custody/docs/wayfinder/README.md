# CUSTODY wayfinder tracker

**Archive.** This is the pre-execution decision record. It is not required to run the demo. Where it
disagrees with the product README, `docs/judging.md`, or the recordings, those win.

Local-markdown issue tracker for the CUSTODY wayfinder map. No external tracker is configured; this
directory is the canonical tracker. Every map and ticket is a Markdown file with YAML frontmatter.

## Files

- `map.md` — the map. Label `wayfinder:map`.
- `tickets/Cxx-slug.md` — child tickets of the map. Label `wayfinder:ticket` plus one of
  `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`.
- The tracker script is not included in this archive. The tickets are all closed.

## Frontmatter

```yaml
---
id: C03
title: "Live correlation mechanism"
type: grilling                  # research | prototype | grilling | task
status: open                    # open | closed
parent: CUSTODY-MAP
blocked_by: [C01]               # canonical blocking edges
assignee: null                  # a name here is the claim
labels: [wayfinder:ticket, wayfinder:grilling]
---
```

## Operations

- **Claim** a ticket by setting `assignee:` to the dev driving the map, before any work. An open,
  unassigned ticket is unclaimed. Concurrent sessions must skip claimed tickets.
- **Frontier** was the open, unblocked, unclaimed children. Every ticket is closed now, so the
  frontier is empty. A ticket was unblocked when every id in `blocked_by` had `status: closed`.
- **Resolve** by posting the answer under `## Resolution` in the ticket, setting `status: closed`,
  then appending one line to the map's **Decisions so far** with a link to the ticket. The map gists;
  the ticket holds the detail.
- **Blocking edges** are declared only in `blocked_by`. Do not add a `blocks:` field; it drifts.
- **Fog** lives in the map's **Not yet specified** section until a question is sharp enough to
  ticket. Graduating a patch means deleting it there and creating a ticket.
- **Scope** lives in the map's **Out of scope** section. Out-of-scope work never graduates.
- Never resolve more than one ticket per session, except `research` tickets, which may be resolved
  in parallel.
