# baro handoff, incident 1

An independent coding agent received a goal file written from the CUSTODY scenario, cloned the
target repository, and produced a commit that fixes the shell injection. CUSTODY wrote the goal.
CUSTODY did not write, merge, or push the fix.

The repository was `gorango/custody-scratch` during the run. It is now public as
[`gorango/jjhts`](https://github.com/gorango/jjhts) and pinned in this repository at
`modules/custody-scratch`. The old URL redirects.

This run used OpenAI `gpt-5.5` and `gpt-5.4-mini`. The current runner is
`scripts/baro-handoff.ts`, which routes baro through OpenCode Go with `deepseek-v4-pro` and
`deepseek-v4.1-flash`. The recorded artifacts are unchanged; rerun with `bun run baro`.

## Artifacts

| File | What it is |
| --- | --- |
| `issue.md` | The issue body CUSTODY wrote. Issue #1 is real at <https://github.com/gorango/jjhts/issues/1>. |
| `goal.txt` | The goal handed to baro, in the C13 shape. The repository line names the current name; the run used the old name, which redirects. |
| `run-id.txt` | The baro run id. |
| `watch.log` | `baro watch run-1589768` output for the finished run, the milestone view. |
| `run.log` | The full baro run log, 617 lines. It carries every model call, token count, tool call and retry. |
| `run.stderr.txt` | The run's stderr, including the `llm=openai` routing line and the worktree setup warnings. |
| `timeline.md` | The 478 s computed from `run.log`, with the phase table and the retry sequence. |
| `diff.patch` | `git diff main 7c3d7ba`, the fix baro produced. |
| `commit.txt` | `git log` and `git show` for `7c3d7ba` from the local clone, plus the branch that contains it. This is the binding between the SHA and the diff. The commit was never pushed. |
| `test-output.txt` | The reproduction failing on `main` and passing on `7c3d7ba`. |

## Issue

Issue #1 is real: <https://github.com/gorango/jjhts/issues/1>. The committed `issue.md` is the text
CUSTODY wrote. To file it again from that text:

```bash
gh issue create --repo gorango/jjhts \
  --title "Shell injection in src/checkout.ts from the request User-Agent" \
  --body-file packages/custody/outbox/inc-1/issue.md
```

## Install

```bash
npm install -g baro-ai@0.121.0
baro --doctor
```

`baro-ai`'s postinstall downloads the 0.121.0 release binary to `~/.baro/bin/baro` and stages the
JavaScript bundles beside it. That is the binary that ran. A local `cargo build --release -p
baro-tui` in `modules/baro` also builds 0.121.0, but the npm postinstall replaces the copy in
`~/.baro/bin`, so the run used the downloaded artifact.

The command runs from a clone of the target repository. The recorded run used
`cwd=/tmp/custody-scratch` and the goal file from `packages/custody/outbox/inc-1/goal.txt`. baro
then created its own worktrees under `/tmp/baro-worktrees/run-progressive-762dfab8e6e41f5d/`.

`baro --doctor` reports 5 of 9 checks failed on this machine: `claude`, `codex` and `devin` are not
installed. Those are optional. `opencode`, `pi`, `gh` and the audit directory pass. `OPENAI_API_KEY`
is set, and the run used the OpenAI backend.

## Run

```bash
gh repo clone gorango/jjhts /tmp/jjhts
cd /tmp/jjhts
git checkout -b custody/inc-1
baro --llm openai --headless --detach --local-only \
  --goal-file <repo>/packages/custody/outbox/inc-1/goal.txt
baro watch run-1589768
baro logs run-1589768
```

The original run used `/tmp/custody-scratch` and the old repository name. Both redirect or resolve
to the same history.

The run started at 2026-10-31T09:32Z and stopped after 458 s. It produced two commits on its
integration branch `baro/ispraviti-shell-injection-u-src-checkout-ts-tako-31a708e3-39144`:

- `20f771b` Verify checkout shell injection fix
- `7c3d7ba` baro: merge story GREM-e5ca22c107ee-local-verify

The local-verify story passed its critic. The run then failed the PR-evidence obligation `G-C5`
because `--local-only` denies publish and PR commands. The host checkout was left untouched as an
unverified checkpoint. The fix commit is real; the PR does not exist. That contradiction is in the
committed goal (`open a PR against main`) and in the demo-safe invocation C13 prescribes
(`--local-only`). The run is recorded as failed, not as a success.

## Reproduction

```bash
CUSTODY_SCRATCH_REPO=/tmp/custody-scratch bun scripts/patched-check.ts \
  --vulnerable main --patched 7c3d7ba
```

`main` fails `test/checkout.test.ts` with `Received: "uid=1000(g) ..."`, so `attackSucceeded: true`.
`7c3d7ba` passes, so `attackSucceeded: false`. The script writes `eval/patched.json`, and
`bun scripts/ablate.ts` merges it into `eval/results.json`. The command needs the local clone that
holds `7c3d7ba`; that commit was never pushed.

The recorded diff also applies cleanly to the pinned submodule, so the fix can be re-created from
committed artifacts alone:

```bash
git -C modules/custody-scratch apply --check packages/custody/recordings/baro-inc-1/diff.patch
git -C modules/custody-scratch apply packages/custody/recordings/baro-inc-1/diff.patch
cd modules/custody-scratch && bun test test/checkout.test.ts
git -C modules/custody-scratch checkout -- src/checkout.ts
```

## What is real and what is not

- Real: the goal file, the baro installation, the OpenAI-backed run `run-1589768`, the commits,
  the diff, both test results, and public issue #1.
- Real: an independent agent produced the fix. The fix uses `execFileSync` with an argument array,
  not a WAF rule, and leaves `test/checkout.test.ts` unchanged.
- Not real: a pull request or a merge. No PR is claimed.
- Not run: pushing the baro branch or opening the PR. `--local-only` forbids both, and the merge is
  the human's call.
