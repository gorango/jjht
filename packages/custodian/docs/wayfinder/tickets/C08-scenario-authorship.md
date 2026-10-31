---
id: C08
title: "Scenario authorship and self-grading"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Scenario authorship and self-grading

## Question

The scenarios and their expected decisions are authored by the same person who wrote the airlock.
With one builder and roughly 14 hours, what is the minimum credible mitigation?

Choose and specify:

- **External scenarios.** Get at least three scenarios proposed by someone else (a teammate, a
  mentor, another hackathon participant) and say which. How are they collected, and what if nobody
  is available?
- **Red-team generator.** A small agent that mutates existing scenarios to try to produce a
  `custodian`-arm violation. Is it in scope for the first run, or only after the ablation is stable?
- **Reviewer recompute.** Commit the fixtures, labels, and a command that recomputes every number, so
  a judge can disagree and check. What exactly must be committed?
- **Disagreement reporting.** If a label is contested, does the README report the disagreement
  rather than hide it? In what format?
- **Deterministic construction.** The demo is deterministic by construction; how is that disclosed,
  and what unedited real run (Docker, model, or baro) balances it?

## Why this is a decision, not a build

The ablation's credibility depends on who wrote the test. This is a process decision that changes
the scenario set and the README, not an implementation task. It must be settled before the ablation
design fixes the scenario count.

## Inputs

- `04-judge-and-evidence.md` §"Self-grading risks".
- `05-scenarios.md` §"Red-team scenarios (stretch)".
- `07-demo-and-rubric.md` §"Mapping, honestly".
- The seed's fog note on the red-team generator.

## Resolution

**Resolved 2026-10-30 (delegated).** One builder, so the mitigation is **external provenance plus
radical transparency**, not a fake second author.

- The ten incident shapes stay, but at least **three carry an external source**: one adapted from the
  previous edition's write-skew air-traffic winner (Separation), one from the OWASP LLM Top 10
  prompt-injection pattern, one from MITRE ATT&CK credential-access/lateral-movement. The README
  names the source per scenario. These are published adversarial patterns, not a teammate's labels;
  say that plainly.
- The red-team generator is **not** in the first ablation. Five hand-written mutations (split
  instruction, operator impersonation, poisoned eventId, individually-safe/jointly-destructive,
  stolen capability) are a stretch only after the ten fixed scenarios pass.
- Commit the fixtures, `allowedEffects`, `taintedIntentIds`, expected decisions, and a
  `bun run custodian:ablate` recompute. A judge can disagree with a label and recompute.
- The README reports the self-grading limitation and any contested label. Do not hide it.
- The deterministic demo is disclosed; one unedited Docker run (or the recorded attempt, even if it
  fails) balances it.
- Minimum credible claim: "ten scenarios, three from published external patterns, all labels and
  fixtures committed; the builder wrote the rest and says so."
