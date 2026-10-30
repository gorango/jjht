# 08 — Plan, risks, decisions

## Where the clock is

Submissions close **Saturday 31 October, 14:00 CET**. Work started around **Friday 14:00**. That is
roughly 24 hours, of which maybe 14 are usable.

## The plan

| Window | Build | Exit test |
| --- | --- | --- |
| Fri 14:00–16:00 | Worker + pool + trace; wire the airlock into a live loop with mock inference | two Contain turns and one Preserve turn actually interleave; trace shows it |
| Fri 16:00–18:00 | Digital twin + the remaining nine scenarios | `bun test` covers all ten; replay passes |
| Fri 18:00–20:00 | Ablation harness (`naive`, `checks-only`, `custody`) | table with real numbers, committed |
| Fri 20:00–22:00 | Viewer (lift EUREKA's) + human scenario injector | a human can trigger a scenario and watch the decision |
| **Fri 22:00** | **Go / no-go** | see below |
| Fri 22:00–00:30 | Docker adapter, one real run | 403 in nginx + evidence bundle with hashes |
| Sat 08:00–10:00 | Issue → baro → PR (or outbox + goal file) | a real issue URL or a committed outbox |
| Sat 10:00–12:00 | README, judging map, demo rehearsal | 60-second block + `docs/judging.md` |
| Sat 12:00–13:30 | Submit, then stop touching it | submission confirmed |

## Go / no-go at 22:00 Friday

Ship CUSTODY **only if**:

- the airlock is wired into a real Mozaik loop (not just the pure function), and
- all ten scenarios pass, and
- the ablation shows `naive > 0` and `custody = 0` harmful actions.

Otherwise submit **EUREKA** to Track 02. It is already stronger than most of that field, and the
rules allow the entry to change until 14:00. Sunk cost is not a reason to submit a half-wired
runtime.

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Eligibility:** rules say built during 30–31 Oct; EUREKA's commits are 29 Oct | high (already true) | disqualification | CUSTODY is built in-window; resolve the old project's status in Discord, don't hide it |
| The airlock's live correlation is harder than the pure function | medium | the 30-point criterion weakens | timebox 16:00; fall back to a dedicated Airlock participant with a pending set |
| The demo reads as "another security sim" | medium | originality score | lead with the injection + evidence conflict, not the dashboards |
| Scope creep into a SIEM | high | nothing ships | the twin and the airlock are the product; no log store, no detection rules |
| Docker fragility | medium | lost "real" proof | record the run early, never demo live on stage |
| baro handoff burns time | medium | no PR | outbox + goal file is enough; the interface is the claim |
| A judge asks for a threat model | low | credibility | one page in docs: attacker can write telemetry, not code; can steal a token; cannot modify the airlock |

## Open decisions (for the wayfinder session)

1. **Live correlation:** window + shared pending set, or a dedicated Airlock participant? (See
   [03-airlock](03-airlock.md), open question 1.)
2. **Denial semantics:** `refuse_action` vs a tool-level refusal.
3. **Second key:** human lease vs typed confirmation vs both.
4. **Taint authority:** ingestion layer vs Watch model (must be ingestion).
5. **How many roles actually run models:** could be 3 (Watch, Contain, Scribe) with the rest
   deterministic. Fewer models = more reliable demo, but fewer "agents".
6. **Adapter scope:** Docker only, or also a Kubernetes stub to show the interface generalises?
7. **Evidence format:** JSON bundle vs signed manifest; is a hash enough for the claim?
8. **Scenario authorship:** who writes the three scenarios not written by the author, to avoid
   self-grading?
9. **What "no action" looks like in the demo:** a quiet incident that closes cleanly — does it earn
   a slot in a three-minute pitch?
10. **The name:** CUSTODY vs VETO vs TWO-KEY vs QUORUM. CUSTODY carries both meanings (evidence
    custody, custody of authority); the others are punchier but narrower.

## Submission checklist (do not skip)

- [ ] repo public, no `.env`, no keys in history
- [ ] clean clone + `bun install` + `bun run custody` works on a machine that is not yours
- [ ] README: 60-second block, architecture diagram, judging map, honest limitations
- [ ] at least one recorded real run (Docker or the twin, labelled)
- [ ] ablation numbers committed, with the scenario files and expected decisions
- [ ] one track, one entry, chosen deliberately
- [ ] submission confirmed on the site (the `/submit` page was showing "closed" on 29 Oct)
