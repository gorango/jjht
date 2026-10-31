# baro run 1589768, timeline from the full log

`run.log` is a byte copy of `~/.baro/logs/run-1589768.log`, 617 lines and 207 KB. The committed
`watch.log` is only the milestone view. Everything below is computed from `run.log` timestamps and
`model_usage` rows.

## Span

The first row is `2026-10-31T09:32:06Z`, the last is `09:40:04Z`. That is 478 seconds. baro's own
`done` line says `failed in 458s`, measured from its stop watch rather than the first log row.

The run ended `failed`. The incomplete stories were `S1`, `GREM-2068dd58a3ba`,
`GREM-e5ca22c107ee-publish-pr`, `GREM-e5ca22c107ee-pr-verify`, `GREM-51c955c07ba3`,
`GREM-d71c47e3b550`, `GREM-e5ca22c107ee-pr-verify-publish-capable`, and
`GREM-e5ca22c107ee-pr-verify-publish-capable-2`. The acceptance gate that stayed inconclusive was
`G-C5`, opening an unmerged PR against `main`.

## Where the time went

| Phase | Model calls | Input tokens | Output tokens | Model |
| --- | ---: | ---: | ---: | --- |
| story | 34 | 1,860,942 | 17,119 | `gpt-5.5` |
| critic | 31 | 136,251 | 7,619 | `gpt-5.4-mini` |
| surgeon | 5 | 15,605 | 2,711 | `gpt-5.5` |
| architect | 3 | 2,145 | 2,300 | `gpt-5.5` |
| planner | 1 | 12,899 | 993 | `gpt-5.5` |

There is no single stall. The largest timestamp gap is 8.7 seconds. The time is 74 model calls and
the retry loop around them. The code change itself was quick. `S1` started at `09:32:36` and
committed `f0f4555` at `09:32:52`, sixteen seconds later. The critic passed it seven seconds after
that.

## Event sequence

| Time | Event | Duration | What happened |
| --- | --- | ---: | --- |
| 09:32:06 | architect | 16 s | Three obligation batches, `G-A1..3`, `G-C1..3`, `G-C4..5`. |
| 09:32:22 | intake | 12 s | Plan accepted from the goal. |
| 09:32:34 | planner | 2 s | One story admitted, `S1`. |
| 09:32:36 | `S1` run 1 | 138 s | Fix committed at 09:32:52. Two retries. Ended `maxTurns (4) exhausted` at 09:34:54. |
| 09:34:54 | `GREM-e5ca22c107ee` | 63 s | Same mix of code and PR evidence. Ended `maxTurns (4) exhausted`. |
| 09:36:03 | `GREM-...-local-verify` | 20 s | Split story. Critic passed. Merged as `7c3d7ba`. |
| 09:36:23 | `GREM-...-pr-verify` | 34 s | Killed by a dependency block because the command guard rejects `git push` and `gh pr`. |
| 09:36:58 | `...-publish-capable` | 8 s | Same block. |
| 09:37:08 | `...-publish-capable-2` | 15 s | Critic could not evaluate, no terminal shell evidence. |
| 09:37:24 | `S1` run 2 | 151 s | Two retries, then `maxTurns (4) exhausted` at 09:39:55. |
| 09:40:04 | done | | `failed in 458s`. |

## Why it failed

The goal says `open a PR against main; do not merge`. The invocation is `--local-only`. That flag
denies `git push` and `gh pr`. Every story that tried to produce PR evidence lost its turn budget
to a command the guard rejects. The `local-verify` split did its job and produced
`7c3d7ba`, which is the fix the reproduction measures. The PR half could never pass.

This is the contradiction recorded in the recording README. It is a property of the demo-safe
invocation C13 chose, not a defect in the fix.

## Provider

The calls went to OpenAI directly, through the official `openai` JavaScript SDK v6.38.0 that
`modules/mozaik` depends on. The routing evidence is the run's stderr:

```text
[orchestrate] llm=openai: Story, Critic, Surgeon all running through Mozaik's native OpenAI runner (gpt-5.x).
[story-factory] S1 → openai:gpt-5.5 (model="heavy")
```

`OPENAI_API_KEY` is set. `OPENAI_BASE_URL` is not set, and Mozaik's client config passes no
`baseURL`, so the SDK default `https://api.openai.com/v1` applies. `MOZAIK_API_KEY` is not set, so
the Mozaik cloud gateway is not in the path.

The models are `gpt-5.5` for story, surgeon, architect and planner, and `gpt-5.4-mini` for the
critic. That is 43 calls on `gpt-5.5` and 31 on `gpt-5.4-mini`.

The log rows say `"backend":"openai"`, `"provider":null` and `"providerRequestId":null`. baro did
not record the provider response id. The `pending_gateway_meter` string in the cost field is baro's
accounting placeholder, not evidence of a proxy.

## What the log does not have

- Wall time per model call. Every `model_usage` row says `"durationMs":{"reason":"not_reported"}`.
- Cost. The gateway meter is `"pending_gateway_meter"` and `providerUsd` is `unknown`.
- A single trace of the shell commands. Tool calls and results are logged as activity rows, not as
  a transcript.

The raw 1.7 MB JSONL at `~/.baro/runs/custody-scratch-1793439144.jsonl` is not committed. The
207 KB `run.log` here is the readable subset baro itself writes.
