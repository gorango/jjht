# Review — where EUREKA stands, 30 October 2026

> **Historical snapshot.** This records the state at HEAD `27fa75a`, before the P0–P6 pass. The
> numbers below describe that state, not the committed artefacts; for current evidence see
> `examples/README.md` and `docs/judging.md`, and run `bun run check:examples`.

Snapshot taken at **10:30 CET on Friday 30 October**, in the middle of the build window.
Repository: `jigjoy` / EUREKA, HEAD `27fa75a`, working tree plus the new `docs/rules/` set.
Submission deadline: **Saturday 31 October, 14:00 CET**. This document is the working plan; the
official material it refers to lives in [`docs/rules/`](../../../docs/rules/README.md).

---

## 1. Bottom line

EUREKA is a credible Track 02 submission today: it satisfies every hard requirement, and one
criterion — accuracy and transparency — is answered better than most teams will manage. It is
**not yet a winning submission**, for three reasons:

1. The **25-point proposal criterion is the weakest link** and is currently unproven. The writer
   produces a good but thinner document than the organizers' own industrial-PhD example.
2. Three of the **30-point architecture claims are prose, not measurements** (14 turns in flight,
   scheduler-removal, lease recovery). A judge cannot verify them from the committed artifacts.
3. The **evidence artifacts contradict each other**. The headline numbers in the README cannot be
   reproduced from anything committed, because `runs/` is gitignored and `examples/` is stale.

Estimated score if judged now, without changes: **74–83 / 100**, with all variance in the
proposal criterion. The work in §5 targets **88–93** and is achievable inside the remaining hours.

Do **not** pivot tracks. See [`pivot.md`](pivot.md) for the analysis behind that decision.

---

## 2. What was verified, and how

Everything below was run against a clean clone (`git clone` into `/tmp`, then install), not inferred
from the README. Real-model runs were **not** re-executed — no API key was used — so the
`examples/run-openrouter` and `examples/run-full` artifacts are taken as recorded, not reproduced.

| # | Claim | How it was checked | Result |
| --- | --- | --- | --- |
| 1 | Tests pass | `npm test` | **4/4 pass** in 1.6s: citation resolves; fabricated publication rejected; duplicates collapsed; lease blocks second worker and stale generation cannot write |
| 2 | Typecheck clean | `npx tsc --noEmit` | **Clean** |
| 3 | Offline demo works from nothing | clean clone → `npm install` → `npm run mock` | **Works**, run completes in **1.1s**, 103 model calls, $0.00 |
| 4 | `npm ci` works | clean clone → `npm ci` | **FAILS** — lockfile out of sync (see D1) |
| 5 | Mock is reproducible | rerun in clean clone | **Yes**, identical summary (6 companies, 12 challenges, 12 proposals, 12 rejections, 12 approvals, portfolio 5) |
| 6 | Concurrency headline (14 in flight) | parsed `inference.started/completed` overlap in trace JSONL | **True of current code** (fresh run = 14) but **false of every committed example** (mock 9, full 10, OpenRouter 7) — see D2 |
| 7 | Retrieval evaluation | `npm run eval` | Reproduces committed numbers exactly: precision@1 **47.4%**, precision@3 **43.9%**, hit@3 **84.2%**, MRR **0.69**, 19 scored, C113-CH1 has no qualified researcher |
| 8 | Full run numbers | read `examples/run-full/run.json` + `portfolio.md` | 6 companies, 12 challenges, 10 proposals, 7 approved, 5 portfolio, 9 rejections, 86 calls, **$0.167**, **127s**; 2 unmatched listed in the portfolio |
| 9 | Critic shown stepping in on a real run | read `examples/run-openrouter/trace.jsonl` | **0 rejections** in that run; the rejection evidence is in `run-full` (9) and in mock (forced) |
| 10 | Trace viewer serves | `npm run trace` + `curl localhost:4173` | **302** (redirects to the viewer) — works |
| 11 | Dataset is the real one | counted JSON | 1,047 researchers, 153 companies, 489 challenges, 31 MB on disk |
| 12 | Scheduler-removal claim | grep for a flag/test | **Not demonstrated** — no flag, no test (D4) |
| 13 | Lease recovery | read `src/domain/market.ts` | No renewal path; TTL 120s; no `lease.expired` event (D5) |

### Verification detail worth keeping

The concurrency claim is the one number the jury is most likely to check, and it is currently the
easiest to disprove:

```
examples/run-mock/trace.jsonl       maxInFlight=9   calls=53
examples/run-full/trace.jsonl       maxInFlight=10  calls=86
examples/run-openrouter/trace.jsonl maxInFlight=7   calls=22
runs/ (untracked, gitignored)       maxInFlight=14  calls=103
```

`npm run mock` does produce 14 in flight — but it writes to a **gitignored** directory. The
screenshot in the README therefore cannot be traced to any committed artifact. This is fixable in
twenty minutes and is worth more than any new feature.

---

## 3. Rubric position

Track 02 — EINSTEIN Matchmaker. Each row states what a skeptical judge can verify without trusting
the README.

| Criterion | Pts | Now | Evidence a judge can check | Gap |
| --- | --- | --- | --- | --- |
| Multi-agent architecture: roles, coordination, review loops | 30 | **24–27** | Five pools in `src/agents/`, lease market with generations in `src/domain/market.ts`, critic→writer loop in `src/agents/roles.ts`, event catalogue in `src/runtime/events.ts` | Pool scaling and scheduler-removal are asserted, not measured; the 14-in-flight figure is not in any committed trace |
| Proposals a company and a researcher would sit down over | 25 | **15–18** | 3 real proposals in `examples/run-openrouter/portfolio.md`, 10 in `run-full` | Writer schema omits supervisors, candidate, research questions, year-by-year plan, and the "agreed up front" IP/publication terms that the organizers' own example contains |
| Accuracy and transparency: sources, trace, no hallucinations | 20 | **17–18** | Claim ledger in `src/runtime/state.ts`; code-level citation resolution in `roles.ts` (reject regardless of model verdict); JSONL trace with per-task time and cost; viewer | No one-command audit; stale examples undercut the story |
| Potential for real use in EINSTEIN | 15 | **10–11** | Event seam described in README; `docs/architecture.md`; run-full trace | The seam is a diagram and an assumption, not an endpoint anyone can call |
| Responsible use of data | 10 | **8–9** | Synthetic-only default; portfolio not leaderboard; unmatched challenges reported; OpenAlex limited to identifier resolution | No hard guard preventing real identities reaching a model |

The rubric is unusually kind to this project: the two largest blocks reward exactly what is already
built. The money is in converting "built" into "measured", and in the 25 points that depend on the
proposal document itself.

---

## 4. Defects found

Severity: **S1** = a judge may exclude or discount the entry; **S2** = loses points; **S3** = polish.

| ID | Sev | Finding | Why it matters | Fix |
| --- | --- | --- | --- | --- |
| D1 | S1 | `npm ci` fails: lockfile pins `@types/node@26.6.6` vs `24.19.2`, `dotenv@18.0.9` vs `17.4.2`, `typescript@7.0.2` vs `5.9.3`, `undici-types@8.9.0` vs `7.24.6` | Rules §5: entries judges "cannot run" may be excluded. A CI-style install is the first thing a careful judge does | `npm install`, commit the lockfile, verify `npm ci` in a clean clone |
| D2 | S1 | Committed examples contradict the README: max in-flight 9/10/7 vs claimed 14; `examples/run-mock` says `costUsd: 0.0881` while the code deliberately reports $0 for mock, and 3 companies/53 calls vs current 6/12/103 | The project's thesis is evidence hygiene. A stale artifact is the one thing that discredits the rest | Regenerate all three examples with current code; add `scripts/check-examples.ts` asserting README numbers against each `run.json` |
| D3 | S2 | The real-model example linked first (`run-openrouter`) has **zero** Critic rejections, so it does not show "where the Critic stepped in" as the brief requires | Misses an explicit Track 02 deliverable in the artifact most likely to be opened | Make `examples/run-full` the primary evidence (9 rejections); label `run-openrouter` as the cheap run; keep mock as the forced-rejection demo |
| D4 | S2 | README asserts "remove the Scheduler after boot and the run still drains", but there is no flag and no test | Unfalsifiable architectural claim on the 30-point criterion | Add `--no-scheduler-after-boot` + a test that the queues drain and the run closes on timeout, or soften the sentence |
| D5 | S2 | Lease TTL 120s, no renewal; README itself records a 186s writer call. A slow worker's lease can expire, a second worker re-claims, and the work is paid twice — with no `lease.expired` event explaining it | Turns a real concurrency hazard into an unexplained cost anomaly; also the best available autonomy story if instrumented | Emit `lease.expired` / `task.reclaimed`, add renewal or a TTL policy tied to observed latency, add a chaos test |
| D6 | S3 | `priceOf()` silently falls back to `{in:1,out:3}` for unknown model ids | A typo in `EUREKA_MODEL` understates cost in a trace sold as honest | Warn (or throw) on unknown ids; log the price table version in the run header |
| D7 | S3 | Only 4 tests, all unit-level; no runtime-level concurrency test | "We can run it" is 25 points; tests are the cheapest proof | Add one integration test: two workers, one queue, assert both items processed and one stale write discarded |
| D8 | S3 | README is 22 KB with no 60-second block; `docs/` has no judging map | Judges skim 40 repos; the first screen decides | Add a top block and `docs/judging.md` mapping criterion → file:line → command |
| D9 | S3 | No `npm run audit`; claim verification is only visible by reading code or the viewer | The 20-point criterion is strongest when it is one command | Offline re-resolution of every claim in a run, non-zero exit on failure |

---

## 5. Plan

Ordered by points per hour. Estimates assume one focused developer.

### P0 — Stabilise the evidence (30 min total)

| Task | Files | Done when |
| --- | --- | --- |
| Fix the lockfile | `package-lock.json` | `npm ci` passes in a clean clone |
| Regenerate all examples with current code | `examples/run-*` | Each `run.json` matches the README; mock shows $0.00 and 103 calls |
| Add an examples consistency check | `scripts/check-examples.ts`, `package.json` | `npm run check:examples` fails on any mismatch |
| Make `run-full` the primary evidence, mock the forced-rejection demo | `README.md`, `examples/README.md` | A reader reaches a trace with rejections in one click |

**Acceptance:** a fresh clone runs `npm ci && npm run mock` with no network, and every number in the
README is traceable to a committed file.

### P1 — Proposal quality (2–3 h) — the 25-point criterion

The organizers handed over the target shape in `data/docs/example-industrial-phd-topic.md`. Diff it
against the writer's schema:

| Section in the organizers' example | In the writer today |
| --- | --- |
| Company, faculty, academic + industrial supervisor, candidate | ✗ |
| Problem with numbers | ✓ |
| Research questions | ✗ |
| Year-by-year plan table | partial (first year only) |
| What each side brings | ✓ |
| Why this pair / why not alone | ✓ (matchmaker reason, not in the proposal) |
| "Agreed up front": publication review window, IP ownership | ✗ |
| Named failure modes / risks | ✓ |

Changes:

1. Extend the writer schema and prompt to include the missing sections.
2. Make the Critic **reject** proposals that lack a named publication belonging to that researcher,
   a quantified first-year milestone, a named failure mode, supervisors/candidate, or the
   IP/publication clause. Gates, not exhortations.
3. Re-run three pairs on the strong model; replace the three proposals at the top of the README.
4. Optional but cheap: a blind rubric score from a different model, reported as a number with the
   rubric attached.

**Acceptance:** three proposals that each contain every section of the organizers' example, and a
committed run showing the new gates firing at least once.

### P2 — Measured concurrency (2 h) — the 30-point criterion

| Experiment | Deliverable | Why it scores |
| --- | --- | --- |
| Pool scaling: same workload at pools 1 / 3 / 5 | `eval/concurrency.json` + a small chart; wall-clock and max in-flight per setting | Turns "agents run in parallel" into a curve |
| Lease expiry: `--chaos=slow-worker` sleeps past TTL | `lease.expired`/`task.reclaimed` events; test asserting stale write discarded | Turns D5 into a recovery story the trace explains |
| Scheduler removal: `--no-scheduler-after-boot` | test that queues drain; run closes | Makes the architecture claim falsifiable |

**Acceptance:** three numbers in the README that a judge can reproduce with three commands.

### P3 — Audit command (1 h) — the 20-point criterion

`npm run audit runs/<id>`: re-resolve every claim against the dataset offline, print a table of
claims → sources → resolved/unresolved, exit non-zero on any unresolved source.

**Acceptance:** works on `examples/run-full`, and fails loudly on a trace with a mutated citation.

### P4 — Executable EINSTEIN seam (1.5 h) — the 15-point criterion

`npm run serve` with `POST /challenges` and `GET /events` (SSE), plus a ten-line `examples/host.ts`
that joins the runtime as a participant. Replace "assumption" language in the README with a curl
example.

**Acceptance:** `curl` posts a challenge and receives `portfolio.ready` without importing our agents.

### P5 — Legibility (1 h)

- 60-second block at the top of the README: one sentence, one screenshot, three commands.
- `docs/judging.md`: each criterion → file:line → the command that proves it.
- Move the long limitations section to `docs/limitations.md` and link it.

**Acceptance:** a reader who gives the README 60 seconds can state what it does, that it runs, and
how concurrency is proven.

### P6 — Data guard and polish (1 h)

- `--allow-real-people` guard; refuse to send ORCID/OpenAlex identities to a model otherwise, and
  record the refusal in the trace.
- Warn on unknown model ids in `priceOf`.
- Cyrillic transliteration in `tokenize` (~20 lines), then re-run `npm run eval` and report whether
  hit@3 moves. A measured improvement is worth more than another feature.

### Schedule (deadline Saturday 14:00, internal freeze 13:00)

| Slot | Work |
| --- | --- |
| Fri 11:00–11:30 | P0 |
| Fri 11:30–14:30 | P1 |
| Fri 14:30–16:30 | P2 |
| Fri 16:30–17:30 | P3 |
| Fri 17:30–19:00 | P4 |
| Fri evening | P5, then a full re-run + regenerate examples |
| Sat 09:00–11:00 | P6, buffer, README numbers re-checked |
| Sat 11:00–13:00 | Submission, then a second pass reading the text against the artifacts |
| Sat 13:00 | Freeze. Anything after this is not worth the risk |

If time runs short, cut in reverse order: P6, P4, P5. **Never cut P0 or P1.**

---

## 6. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `/submit` still shows "submissions are closed" | unknown | cannot enter | Confirm with organizers; prepare the submission text locally |
| Model latency during the real run | medium | demo stalls, cost spikes | Mock is a complete run; keep the OpenRouter route pinned with `provider.sort: throughput` |
| Scope creep into a new domain | medium | lose the 25-point criterion | See `pivot.md`; any new idea must fit inside P2 or P6 |
| A judge computes max-in-flight and gets 9 | **high today** | credibility | P0 |
| Time lost to a broken lockfile in judging | medium | exclusion | P0 |

---

## 7. Submission gate (definition of done)

Before pressing submit:

- [ ] `npm ci` and `npm run mock` succeed in a clean clone, offline, in under 5 seconds.
- [ ] `npm test`, `npm run typecheck`, `npm run eval`, `npm run check:examples` all green.
- [ ] Every number quoted in the README and submission text appears in a committed artifact.
- [ ] One linked trace shows a real Critic rejection; one shows the forced mock rejection.
- [ ] `docs/judging.md` exists and every row points at a file that exists.
- [ ] Repo public, no `.env`, no keys, no `runs/` committed, README renders.
- [ ] Submission text re-read against `docs/rules/05-submission.md` for stale figures.
- [ ] Submitted before 13:00, with a calendar reminder for 13:45 to re-check.

---

## 8. What we are not doing

- **Not pivoting tracks.** [`pivot.md`](pivot.md).
- **Not adding a network graph UI.** Track 02 has no UI points; the trace viewer already proves the
  mechanism, and decoration reads as a substitute for evidence.
- **Not swapping retrieval for embeddings now.** It would invalidate the committed lexical
  evaluation, which is currently one of the stronger artifacts.
- **Not hand-editing proposals.** The claim is that no human writes the output; editing breaks it.
- **Not adding more agent roles.** Five pools already exceed what the rubric asks for; the marginal
  role adds cost and failure surface without adding points.
