# Tracks

Source: <https://build.jigjoy.ai/#tracks> and the three track pages (accessed 2026-10-30).

Prizes are the same for all three. Every entry is scored out of 100 on its own track's criteria.
**One track per team**, chosen at submission.

---

## Track 01 — Software Factory

> A team of agents that turns a one-page spec into working software. Tested on a spec nobody has seen.

- **Input:** a spec as a Markdown file.
- **Output:** a small **TypeScript** project (a CLI or an HTTP API) whose **tests pass**.
- **The team:** someone plans; several builders work **at the same time**; someone reviews and tests
  and sends work back; someone puts it together. Name the roles as you like.
- **One command** runs the factory on a spec file.
- **Building on an existing factory is fine**, including JigJoy's open-source **baro**. "We judge
  what your team added."

### The hidden task

1. At **14:00 Saturday** the code is **frozen at the commit you submitted**.
2. JigJoy publishes **one or two specs nobody has seen**.
3. Teams run their factory on them, **unchanged**, and push what it produces **by 16:30**.
4. Acceptance tests run against the output; results are shown at the demos.
5. Teams may watch the run; **every time a person steps in, it must be noted in the log**.

### Scoring (100)

| Criterion | Points |
| --- | --- |
| Hidden task: tests pass, with the fewest human steps | 35 |
| Multi-agent architecture: roles, agents working in parallel, shared state | 25 |
| Autonomy: it notices its own mistakes and recovers | 15 |
| Transparency: a trace of the run, with time and cost per task | 15 |
| README: someone else can run it | 10 |

---

## Track 02 — EINSTEIN: Science-to-Business Matchmaker

> The University of Novi Sad has thousands of researchers and NTP Novi Sad hundreds of companies,
> yet they rarely work together. Build agents that find the most promising researcher–company pairs
> and write a concrete proposal for each.

### Suggested roles (not required)

| Agent | Role |
| --- | --- |
| Orchestrator | Takes the task, hands out work, tracks progress, assembles the result. |
| Research Profiler | Builds researcher profiles from public sources (ORCID, OpenAlex, CORDIS, Google Patents, Lens) or the dataset: fields, skills, projects, patents, each with its source. |
| Industry Analyst | Pulls each company's technical challenges, needs and direction. |
| Matchmaker | Ranks pairs and explains each: why these two, and which problem they solve together. |
| Proposal Writer | Drafts an industrial PhD topic or a one-page joint project for each chosen pair. |
| Critic | Checks every claim against its source and sends unsupported ones back. Never accepts invented papers or skills. |

**More ideas from the brief:** a Funding Scout (open calls such as Horizon Europe or the Innovation
Fund), an Outreach agent (an intro email for each pair), Reverse Search (a company describes a
problem, the system finds researchers), or a step where a person approves pairs before the Writer
starts.

### What you get

A **synthetic dataset** made for the hackathon: fictional researchers and companies, with
publications, projects, patents and the companies' challenges. A guide to the open APIs, an example
of a good industrial PhD topic, and mentors from UNS and NTP throughout.

### Also submit

- An **architecture diagram**.
- The **trace of one full run showing where the Critic stepped in**.
- **At least three proposals for three different pairs**.
- In the README, answer: **how would this plug into the EINSTEIN network and EINSTEIN Stars?**

### Data rule

Only **public data or the provided dataset**. The system **proposes collaborations; it never scores
or ranks people by worth**.

### Scoring (100)

| Criterion | Points |
| --- | --- |
| Multi-agent architecture: roles, coordination, review loops | 30 |
| Proposals a company and a researcher would actually sit down over | 25 |
| Accuracy and transparency: sources, trace, no hallucinations | 20 |
| Potential for real use in EINSTEIN | 15 |
| Responsible use of data | 10 |

---

## Track 03 — Freestyle

> Build anything on Mozaik. The one rule: the heart of it is several agents working at the same time
> and coordinating, not one chatbot with tools.

### Scoring (100)

| Criterion | Points |
| --- | --- |
| Useful and original | 30 |
| How it uses Mozaik: agents in parallel, shared state | 30 |
| It works: we can run it from the README | 25 |
| README: clear what it does and how | 15 |

---

## Rules common to every track

- **Built on Mozaik.** Every track, every team. One agent with a pile of tools doesn't count.
- **One track per team.** You choose it when you submit.
- **Deadline: Saturday 31 October, 14:00 CET.** Resubmit as often as you like; the last entry counts.
- **Submit:** a public GitHub repo with a README: what it does, the architecture, how to run it.
  No video needed.
- **Prizes:** $500, $300 and $200 for the top three overall, whatever the track. Each entry is
  scored out of 100 on its track's criteria.
- **Demos:** live at NTP from 17:00, team by team, for anyone who wants to show what they built.
  Demos are optional; the jury judges every entry from its repo.
