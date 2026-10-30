# Judging

Sources: track pages, `/rules` §6, the landing-page FAQ, and the September edition's winners page.

## Process

- Panel selected by JigJoy; names published on the site and added as they confirm (see below).
- Judging takes up to **7 days** after the 14:00 Saturday close, extendable by up to 7 more.
- **Decisions are final.**
- **Demos are optional.** The jury judges every entry from its repo; the 17:00 Saturday demos exist
  for teams that want to show work live.
- The site promises: *"The detailed judging criteria and the judging cards the jury fills in are
  published before the hackathon starts, so you know exactly what is scored."* At the time of
  writing the cards had not been located on the public site — see `10-source-log.md`. If they
  appear, this file should be updated with their exact wording, because they may weight criteria
  differently from the 100-point tables.
- Stated emphasis: **"genuine use of concurrency — agents that actually run together, not a
  sequential pipeline in disguise."**

## Rubrics

### Track 01 — Software Factory (100)

| Criterion | Pts | What it rewards |
| --- | --- | --- |
| Hidden task: tests pass, fewest human steps | 35 | Unattended operation on an unseen spec. This is the largest single block in any track. |
| Multi-agent architecture | 25 | Distinct roles, real parallelism, shared state. |
| Autonomy | 15 | Noticing and recovering from its own mistakes. |
| Transparency | 15 | Trace with **time and cost per task**. |
| README | 10 | Someone else can run it. |

### Track 02 — EINSTEIN Matchmaker (100)

| Criterion | Pts | What it rewards |
| --- | --- | --- |
| Multi-agent architecture: roles, coordination, review loops | 30 | The review loop is named explicitly. |
| Proposals a company and a researcher would actually sit down over | 25 | Craft and specificity, judged on the output. |
| Accuracy and transparency: sources, trace, no hallucinations | 20 | Every claim traceable; no invented papers or people. |
| Potential for real use in EINSTEIN | 15 | Fit with the network and EINSTEIN Stars. |
| Responsible use of data | 10 | Public/synthetic data only; propose, never rank people by worth. |

### Track 03 — Freestyle (100)

| Criterion | Pts | What it rewards |
| --- | --- | --- |
| Useful and original | 30 | |
| How it uses Mozaik: agents in parallel, shared state | 30 | |
| It works: we can run it from the README | 25 | |
| README: clear what it does and how | 15 | |

## Jury and mentors

| Person | Role | Lens |
| --- | --- | --- |
| Miodrag Vilotijević | Co-founder & CEO, JigJoy; creator of Mozaik | Runtime design, concurrency model |
| Miodrag Todorović | Co-founder, JigJoy; Mozaik Cloud, baro | Production agents, traces, cost, observability |
| Petar Ćirković | Product engineer, jam.dev | UI/UX, product craft, small interactions |
| Aleksandar Hadžibabić | Building beaver.rs | AI-native engineering, community |
| Kishan Sharma | Full-stack AI engineer, Magure; Mozaik contributor | Multi-agent systems, developer tools |
| Milan Vasić | Senior software engineer | Turning ideas into products people use |
| Vladimir Hristov | Embedded SW engineer | RAG pipelines, documentation, reliability |

More names are added as they confirm. The two JigJoy founders wrote the framework and the
"Anatomy of a Software Factory" post, so expect the architecture questions to be specific: *what
ran at the same time, and how do you know?*

## How to read the rubrics (internal note)

- Every track has **10–15 points for the README or "we can run it"**. That is the cheapest block on
  every card and the most commonly lost.
- Every track puts **25–35 points on "does it work"** — a measured, reproducible run beats an
  ambitious design that does not boot.
- Track 02 is the only rubric with an explicit **review loop** and an explicit **no-hallucination**
  line, which is why a code-level citation check scores disproportionately well there.
- Track 01's hidden task means **the design must survive an unseen input**, so generality beats
  polish.
