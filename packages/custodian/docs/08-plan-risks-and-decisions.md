# 08 — Plan, risks, decisions

## Where the clock is

Submissions close **Saturday 31 October, 14:00 CET**. Work started around **Friday 14:00**. That is
roughly 24 hours, of which maybe 14 are usable.

## The plan

| Window | Build | Exit test |
| --- | --- | --- |
| Fri 14:00–16:00 | Worker + pool + trace; wire the airlock into a live loop with mock inference | two Contain turns and one Preserve turn actually interleave; trace shows it |
| Fri 16:00–18:00 | Digital twin + the remaining nine scenarios | `bun test` covers all ten; replay passes |
| Fri 18:00–20:00 | Ablation harness (`naive`, `checks-only`, `custodian`) | table with real numbers, committed |
| Fri 20:00–22:00 | Viewer (lift EUREKA's) + human scenario injector | a human can trigger a scenario and watch the decision |
| **Fri 22:00** | **Go / no-go** | see below |
| Fri 22:00–00:30 | Docker adapter, one real run | 403 in nginx + evidence bundle with hashes |
| Sat 08:00–10:00 | Issue → baro → PR (or outbox + goal file) | a real issue URL or a committed outbox |
| Sat 10:00–12:00 | README, judging map, demo rehearsal | 60-second block + `docs/judging.md` |
| Sat 12:00–13:30 | Submit, then stop touching it | submission confirmed |

## Go / no-go at 22:00 Friday

Ship CUSTODIAN **only if**:

- the airlock is wired into a real Mozaik loop (not just the pure function), and
- all ten scenarios pass, and
- the ablation shows `naive > 0` and `custodian = 0` harmful actions.

Otherwise submit **EUREKA** to Track 02. It is already stronger than most of that field, and the
rules allow the entry to change until 14:00. Sunk cost is not a reason to submit a half-wired
runtime.

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Eligibility:** rules say built during 30–31 Oct; EUREKA's commits are 29 Oct | high (already true) | disqualification | CUSTODIAN is built in-window; resolve the old project's status in Discord, don't hide it |
| The airlock's live correlation is harder than the pure function | medium | the 30-point criterion weakens | timebox 16:00; fall back to a dedicated Airlock participant with a pending set |
| The demo reads as "another security sim" | medium | originality score | lead with the injection + evidence conflict, not the dashboards |
| Scope creep into a SIEM | high | nothing ships | the twin and the airlock are the product; no log store, no detection rules |
| Docker fragility | medium | lost "real" proof | record the run early, never demo live on stage |
| baro handoff burns time | medium | no PR | outbox + goal file is enough; the interface is the claim |
| A judge asks for a threat model | low | credibility | one page in docs: attacker can write telemetry, not code; can steal a token; cannot modify the airlock |

## Decisions

All ten open decisions are resolved; the canonical detail lives in the wayfinder tickets, indexed in
the [map](wayfinder/map.md).

| Decision | Ticket |
| --- | --- |
| Live correlation | [Live correlation mechanism](wayfinder/tickets/C03-live-correlation.md) |
| Denial semantics | [Denial semantics](wayfinder/tickets/C09-denial-semantics.md) |
| Second key | [Second key mechanics](wayfinder/tickets/C07-second-key.md) |
| Taint authority | [Taint authority and boundary](wayfinder/tickets/C10-taint-authority.md) |
| Model-driven roles | [Model-driven roles and the offline runner](wayfinder/tickets/C06-model-roles-and-offline-runner.md) |
| Adapter scope | [Adapter scope](wayfinder/tickets/C11-adapter-scope.md) |
| Evidence format | [Evidence format and CHAIN_OF_CUSTODIAN_PLACEHOLDER](wayfinder/tickets/C12-evidence-format.md) |
| Scenario authorship | [Scenario authorship and self-grading](wayfinder/tickets/C08-scenario-authorship.md) |
| No-action demo | [Vertical slice contract](wayfinder/tickets/C15-vertical-slice-contract.md) |
| Name and framing | [Name and one-line framing](wayfinder/tickets/C16-name-and-framing.md) |

## Submission checklist (do not skip)

- [ ] repo public, no `.env`, no keys in history
- [ ] clean clone + `bun install` + `bun run custodian` works on a machine that is not yours
- [ ] README: 60-second block, architecture diagram, judging map, honest limitations
- [ ] at least one recorded real run (Docker or the twin, labelled)
- [ ] ablation numbers committed, with the scenario files and expected decisions
- [ ] one track, one entry, chosen deliberately
- [ ] submission confirmed on the site (the `/submit` page was showing "closed" on 29 Oct)
