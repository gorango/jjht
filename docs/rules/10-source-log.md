# Source log and observed discrepancies

All pages accessed **2026-10-30**. This file exists so a disagreement between our notes and the
official site can be diagnosed instead of argued about.

## Sources

| # | URL | Used for |
| --- | --- | --- |
| 1 | <https://build.jigjoy.ai/> | Landing page: tracks, prizes, judges, schedule, venue, FAQ |
| 2 | <https://build.jigjoy.ai/tracks/software-factory> | Track 01 brief, hidden task, rubric |
| 3 | <https://build.jigjoy.ai/tracks/einstein> | Track 02 brief, suggested roles, deliverables, rubric |
| 4 | <https://build.jigjoy.ai/tracks/freestyle> | Track 03 brief, rubric |
| 5 | <https://build.jigjoy.ai/rules> | Official rules (all 14 sections) |
| 6 | <https://build.jigjoy.ai/apply> | Registration form and fields |
| 7 | <https://build.jigjoy.ai/submit> | Submission form state |
| 8 | <https://build.jigjoy.ai/dashboard> | Participant dashboard (login required) |
| 9 | <https://build.jigjoy.ai/editions/build-2026/winners> | Last edition results |
| 10 | <https://build.jigjoy.ai/gallery/separation-c7ef86> | Winner's write-up |
| 11 | <https://build.jigjoy.ai/gallery/metamorph-602b9d> | 2nd place write-up |
| 12 | <https://jigjoy.ai/hackathon-2026> | Duplicate landing page (same content) |
| 13 | <https://jigjoy.ai/blog/anatomy-of-a-software-factory> | baro design rationale, factory economics |
| 14 | <https://docs.jigjoy.ai> and subpages | Mozaik runtime API |
| 15 | <https://github.com/jigjoy-ai/mozaik> | Package README, license, API |
| 16 | <https://github.com/jigjoy-ai/mozaik-examples> | Example projects |
| 17 | <https://github.com/jigjoy-ai/cli-agent-starter> | Starter template |
| 18 | <https://github.com/jigjoy-ai/baro> | Software factory, flags, architecture |
| 19 | <https://github.com/jigjoy-ai/einstein-matchmaker-data> | Dataset repo and `docs/apis.md` |
| 20 | `learn.jigjoy.ai` (client-rendered; lesson manifest read from the JS bundle) | Mini-course structure |
| 21 | <https://build.jigjoy.ai/sitemap.xml> | Enumerating all public routes |

## Discrepancies and open questions

### 1. `/submit` says submissions are closed

Observed on 2026-10-29 and again 2026-10-30, while the event had not yet reached its deadline:

> "Submissions are closed. The deadline was Saturday, 31 October at 14:00 CET. Every entry is in the
> gallery, and winners are announced on 7 November."

This looks like the post-event deployment state of the site. **Unresolved.** Confirm with the
organizers in Discord that the submission form will open (or is open) during the event.

### 2. "48 h" vs the actual window

The landing page says "48 h — Kickoff to submission". The schedule runs Friday 10:00 → Saturday
14:00, which is **~28 hours**. The "48 h" figure probably counts from doors-open Thursday or from
the intro stream. Treat 28 hours as the real budget.

### 3. Demo video: optional vs not needed

- Rules §5: "A demo video, live deployment, and screenshots are optional but **strongly
  recommended**."
- Every track brief: "**No video needed.**"

Harmless contradiction, but it means a video earns goodwill rather than points. A runnable repo and
a README are the scored artifacts.

### 4. Dataset size

The GitHub repo README read at crawl time describes **37 researchers and 20 companies**. The copy
vendored in this repository (`data/README.md`) describes **1,047 researchers, 153 companies, 489
challenges**. The local data files match the larger description (verified by count).

Most likely the organizers expanded the dataset between the two reads, or the repo README was
updated after the data. **Use the vendored copy**, and re-download from the organizers if a newer
commit appears. Do not cite the small numbers anywhere.

### 5. Judging cards

The FAQ says: "The detailed judging criteria and the judging cards the jury fills in are published
before the hackathon starts." At crawl time no `/judging` page, card file, or dashboard link was
found. **Open question** — check the dashboard and Discord. If the cards appear, transcribe them
into `04-judging.md`, because they may weight the criteria differently from the 100-point tables.

### 6. "First five" vs "winning participants"

- Landing page: five six-month Mozaik Cloud Premium subscriptions.
- Rules §7: "five (5) six-month Mozaik Cloud Premium subscriptions for **winning participants**."
- Last edition: the top five places each received one.

Operational reading: the top five teams receive one each.

### 7. Registration closes before the event starts

Registration closes **09:00 on 30 October**; doors open **10:00**. Anyone not registered by 09:00
cannot enter. Confirm registration status early.

### 8. Eligibility window vs git history

Rules §4 requires the project to be **built during the Hackathon (30–31 October)**.

### 9. Track 01 timing is tight

Code freeze at 14:00, hidden specs published, output pushed by 16:30, demos at 17:00. That leaves
**2.5 hours** to run the factory on unseen input and push. Any plan for Track 01 must assume a run
finishes well inside that.

## Maintenance

If the site changes, update the affected file and add a dated entry here. Keep this folder
append-only in spirit: record what was true when it was read, rather than silently rewriting history.
