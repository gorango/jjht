---
id: T01
title: "GitHub test repo and token for filing issues"
type: task
status: closed
parent: CUSTODY-MAP
blocked_by: []
assignee: null
labels: [wayfinder:ticket, wayfinder:task]
---

# GitHub test repo and token for filing issues

## Question

What repo and credentials make the `--github` issue-filing path real, without touching the private
`origin` repo or production?

## Work

1. Create or choose a **scratch/test** GitHub repo (public or private with a judge-accessible link).
   It must not be the private `origin` repo and must not contain secrets.
2. Create a token with the minimum scope needed to file an issue (and, if the baro PR path is
   attempted, to push a branch). Record where it lives; never commit it.
3. Verify `gh issue create --repo <repo> --title ... --body-file ...` works from this machine.
4. Record the issue URL and the exact command. If the token cannot be created, record that and make
   `outbox/` the default path.
5. Confirm whether the repo should be public for the judge, and note the visibility.

## Facts the resolution must leave behind

- Repo owner/name and visibility.
- Auth mode (`gh` logged in, `GH_TOKEN`, or none) and where the token is stored.
- The verified command, and one real issue URL if created.
- Whether the baro PR path has push rights, or only issue rights.
- What the fallback is if auth expires before the demo.

## Why this is a task, not a decision

Nothing to decide until the access exists. The baro handoff contract cannot be written honestly
without knowing whether filing is real, outbox-only, or unavailable. This task unblocks that
decision; it does not deliver the handoff.

## Safety

Do not point baro at the host repo with `--local-only` off. Do not commit the token. Do not file
issues against a real third-party project as part of the demo.

## Resolution

**Resolved 2026-10-30.**

- **Repo:** <https://github.com/gorango/custody-scratch> — created private, then made **public** so
  the filed issue is judge-accessible. It contains one deliberately vulnerable fixture and a failing
  regression test; it is not production code and not the CUSTODY entry.
- **Auth:** `gh` is logged in as `gorango`; token scopes `repo`, `read:org`, `gist`,
  `admin:public_key`; stored in `~/.config/gh/hosts.yml`, not in the repo.
- **Issue:** <https://github.com/gorango/custody-scratch/issues/1> — "checkout: shell injection via
  User-Agent in health probe", filed with `gh issue create --repo gorango/custody-scratch --title ...
  --body-file ...`.
- **Fixture:** `src/checkout.ts` (shell interpolation), `test/checkout.test.ts` (fails with
  `uid=1000(g)...`), commit `0cdbc5a` on `main`.
- **Push rights verified:** the fixture commit was pushed to the scratch repo.
- **Fallback:** if auth expires, `outbox/` plus the exact `gh issue create` command; no silent fake.
- **Safety:** the private `origin` (`gorango/eureka`) was not touched; no production target.
