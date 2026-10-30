# Submission requirements

Sources: `/rules` §5, the track "For every team" blocks, `/submit`, and `/apply` (accessed 2026-10-30).

## What must be submitted

Through the submission page:

1. **Project name**
2. **A repository the judges can access** (a public GitHub repo is what every track brief asks for)
3. **A description**
4. **An explanation of how your agents run concurrently**

Optional but **strongly recommended** by the rules: a **demo video**, a **live deployment**, and
**screenshots**. Every track brief, however, says **"No video needed"** — so treat the video as
upside, not a requirement. See `10-source-log.md`.

## Repository requirements

The briefs are consistent:

> Submit a public GitHub repo with a README: **what it does, the architecture, how to run it**.

Track-specific extras:

| Track | Extra deliverables |
| --- | --- |
| 01 Software Factory | One command that runs the factory on a spec file. Hidden-task output pushed by 16:30. Human interventions logged. |
| 02 EINSTEIN | Architecture diagram; trace of one full run showing where the Critic stepped in; ≥3 proposals for 3 different pairs; README answers "how would this plug into the EINSTEIN network and EINSTEIN Stars?" |
| 03 Freestyle | Runnable from the README. |

## Exclusion risk

> "Submissions the judges cannot open, run, or verify may be excluded from judging."

Practical implications:

- The repo must be **public** at judging time (not flipped private after the event).
- A judge should be able to go from clone → first successful output **without a paid key** if at all
  possible, or with one clearly documented key.
- Lockfiles must match `package.json`; a failed `npm ci` is a "cannot run" signal.
- Secrets must not be committed. Sample `.env.example` only.

## Resubmission

- Resubmit as often as needed until **31 October, 14:00 CET**; the **latest** entry is judged.
- For Track 01, the submitted commit is the one frozen at 14:00.

## Registration form

Separate from submission (`/apply`):

| Field | Notes |
| --- | --- |
| Name | |
| Email | |
| Taking part | On site at NTP Novi Sad, or online |
| Entering as | Solo (teammates will be found for you) or team |
| Marketing opt-in | Optional, future JigJoy events and partner offers |

A solo entrant can still compete; teams are capped at 4 and a person may join only one team.

## Submission copy — current draft (internal)

Kept here so it is not lost:

**Project name:** EUREKA

**One line:** An evidence-first matchmaker where every sentence in a proposal is a claim that a
Critic can reject.

**Description (~150 words):** EUREKA turns a company's technical challenge into a ranked shortlist
of University of Novi Sad researchers and a one-page joint-project or industrial-PhD proposal. Five
agent pools — analyst, profiler, matchmaker, writer, critic — run on a single Mozaik runtime and
claim work through a lease market rather than a fixed pipeline. Deterministic retrieval narrows
1,047 researchers to six candidates per challenge with no model calls; the Matchmaker ranks them;
the Writer drafts; and the Critic checks every citation against the dataset in code before any
model judgement is considered. Proposals that survive carry sourced claims, a named failure mode,
and an explicit list of what could not be verified. The system is allowed to conclude that a
challenge has no defensible pair, and does so for roughly one in six. A full run of twelve
challenges costs about $0.17 and produces a JSONL trace with time and cost per task.

**How the agents run concurrently (~150 words):** Five role pools (3/3/3/3/2 workers) join one
runtime; each worker is an independent Mozaik agent with its own loop. Coordination is by event, not
by call: `challenge.analyzed`, `pairs.ranked`, `proposal.drafted`, `proposal.reviewed`. Work is
published to queues and claimed through a lease market that carries a generation, so a stale worker
cannot overwrite the result of the worker that replaced it. Workers of the same role compete for
the same queue: adding a worker adds throughput without changing code. The only coordinating
participant, the Scheduler, owns no work — it publishes the initial work and closes the run when the
market and queues are empty.

> Keep the numbers in this copy in sync with the committed example runs. A description that
> disagrees with `examples/*/run.json` is worse than no numbers.
