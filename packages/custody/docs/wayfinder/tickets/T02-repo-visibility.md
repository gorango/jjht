---
id: T02
title: "Repo visibility and name before submission"
type: task
status: closed
parent: CUSTODY-MAP
blocked_by: [C16]
assignee: null
labels: [wayfinder:ticket, wayfinder:task]
---

# Repo visibility and name before submission

## Question

Is the repository public, correctly named, and runnable by a stranger before the 14:00 submission?

## Work

1. Apply the name decision from `Name and one-line framing` to the GitHub repo, the package name,
   and the command. Update links that would break.
2. Make the repo **public** (verify visibility, not just "created"). If the hackathon requires the
   entry repo to be public, the private `origin` note in the seed is a blocker.
3. Verify a clean clone on a machine that is not yours:
   `git clone <url> && bun install && bun run custody` (or the README command) works offline.
4. `git status` clean; no `.env`, no keys, no `runs/`, no `evidence/` with host data committed.
5. Confirm the README renders: Mermaid, image paths, command blocks.
6. Record the final URL and the visibility check timestamp.

## Facts the resolution must leave behind

- Final repo URL and visibility.
- Whether a clean-clone run succeeded, and on what machine/OS.
- The exact command a judge runs.
- Any remaining blocker (private repo, missing lockfile, submodule build step).

## Why this is a task, not a decision

The naming decision is already made. This is the mechanical act that makes the entry accessible and
runnable. It unblocks the claim table, which must link a real public URL.

## Safety

Do not rewrite git history to hide the earlier EUREKA commits if the rules require disclosure; the
risk register already flags this. Do not commit secrets while renaming.

## Resolution

**Ruled out of scope 2026-10-30.** Repo visibility/rename and site submission are **submission
logistics**, not decisions that block the plan or the slice. The naming decision is CUSTODY (C16).
The origin repo (`gorango/eureka`) stays private until a separate submission pass that includes a
secret scan, a clean-clone test, and a deliberate decision about the EUREKA history. That pass is
past this map's destination (plan + slice), so the ticket is closed without doing the work.

See the map's **Out of scope** section. The handoff target `gorango/custody-scratch` is public and
separate from the entry repo.
