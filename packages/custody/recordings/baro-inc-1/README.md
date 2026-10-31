# baro handoff, incident 1

An independent coding agent received a goal file written from the CUSTODY scenario, cloned the
scratch repository, and produced a commit that fixes the shell injection. CUSTODY wrote the goal.
CUSTODY did not write, merge, or push the fix.

## Artifacts

| File | What it is |
| --- | --- |
| `issue.md` | The issue body. The repository is private, so this committed outbox stands in for issue #1. |
| `goal.txt` | The goal handed to baro, exactly as C13 specifies. |
| `run-id.txt` | The baro run id. |
| `watch.log` | `baro watch run-1589768` output for the finished run. |
| `diff.patch` | `main` to the baro commit `7c3d7ba`, the fix baro produced. |
| `test-output.txt` | The reproduction failing on `main` and passing on `7c3d7ba`. |

## Issue command

The scratch repo `gorango/custody-scratch` is private by operator decision. When it is public and
authenticated, the exact command is:

```bash
gh issue create --repo gorango/custody-scratch \
  --title "Shell injection in src/checkout.ts from the request User-Agent" \
  --body-file packages/custody/outbox/inc-1/issue.md
```

No issue URL is claimed. The outbox is the artifact.

## Install

```bash
cd modules/baro
cargo build --release -p baro-tui
mkdir -p ~/.baro/bin && cp target/release/baro ~/.baro/bin/baro
npm install -g baro-ai@0.121.0   # stages run-conversation.mjs and the other bundles
baro --doctor
```

`baro --doctor` reports 5 of 9 checks failed on this machine: `claude`, `codex` and `devin` are not
installed. Those are optional. `opencode`, `pi`, `gh` and the audit directory pass. `OPENAI_API_KEY`
is set, and the run used the OpenAI backend.

## Run

```bash
gh repo clone gorango/custody-scratch /tmp/custody-scratch
cd /tmp/custody-scratch
git checkout -b custody/inc-1
baro --llm openai --headless --detach --local-only \
  --goal-file /home/g/m/jigjoy/.worktrees/c/packages/custody/outbox/inc-1/goal.txt
baro watch run-1589768
baro logs run-1589768
```

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
`bun scripts/ablate.ts` merges it into `eval/results.json`.

## What is real and what is not

- Real: the goal file, the baro installation, the OpenAI-backed run `run-1589768`, the commits,
  the diff, and both test results.
- Real: an independent agent produced the fix. The fix uses `execFileSync` with an argument array,
  not a WAF rule, and leaves `test/checkout.test.ts` unchanged.
- Not real: a public issue, a pull request, or a merge. No PR is claimed.
- Not run: pushing the baro branch or opening the PR. `--local-only` forbids both, and the merge is
  the human's call.
