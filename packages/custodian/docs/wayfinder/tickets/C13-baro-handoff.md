---
id: C13
title: "Baro handoff contract"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: [T01]
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Baro handoff contract

## Question

What exactly does CUSTODIAN promise the slow loop, and what may the demo claim about it?

Decide:

- **Goal file.** The exact shape: repo, target file, failing test, acceptance criterion, constraints,
  and what baro must not touch. Baro's README says narrow goals work and vague ones do not.
- **Invocation.** `baro --headless --detach --goal-file ...` plus `baro watch <run-id>`? What is the
  fallback when baro is unavailable, and how is the fallback labelled?
- **Repo target.** The scratch/test repo, a fork, or `--local-only`. Never the host repo with
  `--local-only` off during the demo.
- **Issue filing.** `gh issue create` when a token exists; otherwise `outbox/` plus the exact
  command. No silent fake. What is committed as evidence: the issue URL, the goal file, the PR URL,
  or all three?
- **PR verification.** Who runs `npm test` / re-scan, and what makes the PR "verified"? Is the merge
  the human's call, always?
- **What CUSTODIAN claims.** "Writes a claim-backed issue and a goal an independent coding agent can
  execute" — not "fixes code". The PR is the slow loop; containment is the fast one.
- **Closing the loop.** What does the patched build need to be for the replay arm: the PR branch, a
  merged commit, or a local patch? This feeds the ablation design.

## Why this is a decision, not a build

The handoff is the integration seam and the north-star story. The contract defines what is real,
what is outbox, and what the README may claim. A fake PR is worse than an honest goal file.

## Inputs

- `06-infrastructure-and-repo-handoff.md` §"Repo handoff: issue → baro → PR".
- The seed's integration-seam note.
- `GitHub test repo and token` for what auth and repo are actually available.
- `07-demo-and-rubric.md` §"Failure fallbacks".

## Resolution

**Resolved 2026-10-30 (delegated).** Target: <https://github.com/gorango/jjhts> (public).
Issue #1 is real; the fixture is `src/checkout.ts` with the failing
`test/checkout.test.ts`.

### Goal file

Write `outbox/inc-1/goal.txt`:

```text
goal: Fix the shell injection in src/checkout.ts in gorango/jjhts.
repo: https://github.com/gorango/jjhts (branch main)
file: src/checkout.ts
failing test: test/checkout.test.ts > does not execute a shell metacharacter from User-Agent
acceptance:
  - bun test passes
  - no shell interpolation of request headers remains in src/
  - the fix uses an argument array (execFile/spawn), not a WAF rule
constraints:
  - do not change test/checkout.test.ts
  - do not add dependencies
  - open a PR against main; do not merge
evidence:
  - issue #1
  - telemetry evt-1042 (tainted log line)
  - snapshot anchor in the trace
```

### Invocation and modes

- **Demo-safe (default):** `baro --headless --detach --local-only --goal-file outbox/inc-1/goal.txt`
  against a local clone of the scratch repo. Baro produces a local branch/commit and a diff; a human
  pushes and opens the PR. No host repo, no network push.
- **Full:** `--local-only` **off** only against `jjhts`, never against `origin`:
  `baro --headless --detach --goal-file outbox/inc-1/goal.txt`, then `baro watch <run-id>`. The PR
  URL is evidence; the merge is the human's call.
- **Fallback:** if baro is unavailable or flaky, commit the issue text, the goal file and the exact
  command. **No fake PR.** The interface is the claim; the PR is upside.

### Verification and evidence

- Run `bun test` in the patched checkout; the new regression test must pass and the old failure must
  be gone.
- Commit: the issue URL, the goal file, the baro run id, the local branch/commit or PR URL, and the
  test output. The README links the issue and the goal file, not a private repo.
- **Patched build for the closing arm:** the baro branch/commit (local or PR) checked out in a
  worktree. The scenario runner compares `main` vs that commit. If no baro run exists, the closing
  arm is conditional and labelled "not run", not implied.

### What CUSTODIAN claims

> "CUSTODIAN writes a claim-backed issue and a goal file an independent coding agent can execute. It
> does not write code, open the PR, or merge."

The slow loop is the handoff; containment is the fast loop. Do not claim a fix that was not
verified.
