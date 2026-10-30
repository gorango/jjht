# Demo — three minutes

Everything below is copy-paste ready. Rehearse it once end to end; the only thing that can go
wrong live is a slow model call, and the fallbacks are at the bottom.

## Pre-flight (5 minutes before)

```bash
cd /home/g/m/jigjoy
git status                       # clean
bun run mock                     # ~1s, regenerates runs/<id>/
bun run trace -- --port=4173     # leave running in a second terminal
```

Open `http://localhost:4173/` in a browser tab and leave it there. Open
`examples/run-proposals/portfolio.md` in a second tab. Have a terminal at 18pt font, dark background.

## The script

**0:00 — the one sentence.**

> "EUREKA matches companies with university researchers. The hard part isn't ranking — it's that a
> language model will happily invent a publication. So we built a system where it can't."

**0:15 — run it live.**

```bash
bun run mock
```

Point at the final lines, not the trace:

- 12 challenges → 12 proposals → 12 Critic rejections → **12 approved after revision**
- **14 model turns in flight at once** — every worker in the pool busy
- 103 model calls, about a third of a second, `$0.00`

> "The mock fabricates one citation on purpose, so you always see the Critic catch it and the Writer
> fix it. Everything else — the runtime, the leases, the claims, the trace — is real." 

> "No keys, no network. Same runtime, same concurrency, same Critic as the paid run — only the text
> generation is a stand-in, and it says so in the trace."

**0:30 — the architecture, in one breath.**

> "Five roles — analyst, profiler, matchmaker, writer, critic — as separate pools. Nobody calls
> anybody. Work is published as events; a worker claims an item through a **lease that carries a
> generation**, so a slow worker that lost its lease cannot write back. That's baro's discipline,
> shrunk to fit."

**0:50 — the viewer.** Switch to the browser.

- Click `proposal.reviewed` in the chips to isolate the Critic's decisions.
- Expand one **red** row. Show `data.notes` and `data.claims`.

> "Every factual sentence is a claim with source ids. Code resolves those ids against the dataset
> **before** the model's opinion counts. If an id doesn't exist, the verdict is reject — the model
> never gets a vote on existence, only on relevance."

**1:30 — the real run.** Switch to `examples/run-proposals/portfolio.md`.

> "Four companies and four challenges, real models: 4 proposals, all 4 approved after 4 real Critic
> rejections. Nineteen cents, 131 seconds. Read the section headings: supervisors and candidate,
> research questions, a three-year plan, what each side brings, why this pair, the IP and
> publication clause, what could make it fail, and unverified evidence."

Read one sentence of the **unverified evidence** section aloud. That paragraph is the whole pitch:
the system is telling you what it could not prove.

**2:10 — the measurement.**

> "We hand-labelled twenty challenges. The right researcher is in the top three **84%** of the time,
> but first only **47%**. That gap is why a Matchmaker reranks six candidates with a model rather
> than trusting retrieval. Labels, sheet and script are in `eval/` — you can disagree with them and
> recompute."

**2:35 — close.**

> "A network posts a challenge event, gets back reviewed proposals and a trace with cost per task.
> The deliverable isn't this CLI — it's the event contract."

## If something breaks

| Failure | Do this |
|---|---|
| Model calls hang | Use the mock. It is a complete run, not a demo mode. |
| Viewer won't load | `bun run trace -- --run=<id>` from `runs/`; or show `examples/run-openrouter/trace.jsonl` raw. |
| No projector / no laptop | `examples/run-proposals/portfolio.md` and `docs/trace-viewer.png` render on GitHub. |
| "Is it real?" | `bun run eval` — 47%/84% in two seconds, and `git log` shows the rejected designs. |

## 60-second cut

Mock run (10s) → one red Critic row in the viewer (20s) → the unverified-evidence paragraph (15s) →
"84% hit@3, 47% precision@1, measured" (10s) → event-contract close (5s).

---

# Submission form copy

**Project name:** EUREKA

**One line:** An evidence-first matchmaker where every sentence in a proposal is a claim that a
Critic can reject.

**Description (≈150 words):**

> EUREKA turns a company's technical challenge into a ranked shortlist of University of Novi Sad
> researchers and a one-page joint-project or industrial-PhD proposal. Five agent pools — analyst,
> profiler, matchmaker, writer, critic — run on a single Mozaik runtime and claim work through a
> lease market rather than a fixed pipeline. Deterministic retrieval narrows 1,047 researchers to
> six candidates per challenge with no model calls; the Matchmaker ranks them; the Writer drafts;
> and the Critic checks every citation against the dataset in code before any model judgement is
> considered. Proposals that survive carry sourced claims, a named failure mode, and an explicit
> list of what could not be verified. The system is allowed to conclude that a challenge has no
> defensible pair. In the committed real run, four proposals were approved after four real Critic
> rejections and cost $0.1934; the JSONL trace records time and cost per task.

**How the agents run concurrently (≈150 words):**

> Five role pools (3/3/3/3/2 workers) join one runtime; each worker is an independent Mozaik agent
> with its own loop. Coordination is by event, not by call: `challenge.analyzed`, `pairs.ranked`,
> `proposal.drafted`, `proposal.reviewed`. Work is claimed from a queue through a lease market that
> carries a monotonic generation, so a worker that stalled and lost its lease has its write
> discarded instead of overwriting the worker that replaced it. Each worker runs one turn at a time,
> which keeps `model.answer` unambiguous and bounds cost — parallelism comes from the pool, not
> from fan-out inside one agent. Measured on a 6-challenge workload at 1 / 3 / 5 workers per role:
> 1,133 / 640 / 607 ms and 5 / 9 / 11 turns in flight. The default mock run reaches 14 in flight;
> the trace proves it: `inference.started` minus `inference.completed` over time is the curve.

**Track:** EINSTEIN: Science-to-Business Matchmaker
