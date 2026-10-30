---
id: C16
title: "Name and one-line framing"
type: grilling
status: closed
parent: CUSTODY-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Name and one-line framing

## Question

CUSTODY vs VETO vs TWO-KEY vs QUORUM — and what is the one sentence that names the thing?

Decide:

- **The name.** Does it carry both meanings (evidence custody and custody of authority)? Is it
  understandable in five seconds? Is it confused with a SIEM, a password manager, or a legal tool?
  Is the GitHub org/repo name available, and does it survive a search?
- **The one-line framing.** A sentence a judge can repeat: what it is, who it is for, and what it
  prevents. It must not be "an AI SOC" or "an LLM with guardrails".
- **The opening 20 seconds.** The thesis's sentence is a candidate; is it the final one? Does it
  lead with the mechanism (joint authority under conflicting mandates) or the threat (prompt
  injection in logs)?
- **What the name commits us to.** A name that promises "two-key" makes the second-key mechanism
  load-bearing; a name that promises "quorum" makes vote-counting load-bearing (the airlock uses
  vetoes, not quorum). Avoid a name that describes a feature we cut.
- **Repo and package naming.** `custody`, `@custody/*`, the command `bun run custody` — what changes
  if the name changes, and what is the cost now vs after submission?

## Why this is a decision, not a build

The name appears in the README, the repo, the submission, the command, and every slide. It also
signals which mechanism is central. Choosing it late forces a rename across docs and code; choosing
it wrong makes the pitch promise something the demo does not show.

## Inputs

- `00-thesis.md` §"The thesis".
- `07-demo-and-rubric.md` §"Three-minute script" (the opening sentence).
- `08-plan-risks-and-decisions.md` open decision 10.
- `Repo visibility and name before submission` for the task that follows.

## Resolution

**Resolved 2026-10-30 (delegated).** The name is **CUSTODY**.

- **One line:** "CUSTODY is an incident-response runtime where agents propose actions and a joint
  airlock decides them — so an attacker who writes the logs still cannot write the system."
- **Opening 20 seconds:** "Every AI security demo lets a model read attacker-controlled logs and then
  run commands. That is remote code execution with extra steps. CUSTODY is the version where the
  attacker can write the logs and still cannot write the system."
- **Why CUSTODY:** it carries both meanings the system actually implements — evidence custody and
  custody of authority. VETO is one mechanism; TWO-KEY promises a feature that is only one part;
  QUORUM is wrong because the airlock uses vetoes, not vote-counting.
- **No rename.** The package, command (`bun run custody`), docs and trace already use it. Renaming now
  costs time and breaks links; the repo rename/visibility is a submission step, not part of the slice.
