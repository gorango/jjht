# Example runs

Two runs, kept as the artefacts the brief asks for: a trace of a full run, an architecture diagram,
and at least three proposals.

| | `run-openrouter/` | `run-mock/` |
| --- | --- | --- |
| Date | 2026-10-29 | 2026-10-29 |
| Provider | OpenRouter (`deepseek/deepseek-v4-pro`, `deepseek/deepseek-v4.1-flash`) | deterministic mock |
| Command | `npm start -- --companies=4 --challenges=1 --candidates=4 --profile=2` | `npm run mock -- --companies=3 --challenges=2` |
| Companies / challenges | 4 / 4 | 3 / 6 |
| Proposals | 3 | 6 |
| Critic rejections | 0 | 6 |
| Unmatched (on purpose) | 1 | 0 |
| Model calls | 22 | 53 |
| Cost (est.) | $0.0374 | $0.0881 |
| Wall clock | 36.1s | 0.9s |

Each directory contains `trace.jsonl`, `portfolio.md`, `run.json` and `architecture.mmd`.

## What to look at in `run-openrouter/trace.jsonl`

- `challenge.analyzed` — the retrieval result: which researchers were considered for that challenge,
  and why (shared terms).
- `pairs.ranked` — the Matchmaker's scoring, with a reason and a risk per pair.
- `proposal.reviewed` — **where the Critic stepped in**. Each entry carries `verdict`, the Critic's
  `note`, and the claim ledger (`data.claims[]`) with each claim's sources and status.
- `task.measured` — per-task model, tokens, cost and duration. This is the transparency spine.
- `portfolio.ready` / `run.completed` — the final selection and the counters.
- `unmatched` appears in `portfolio.md`: one challenge was left unmatched because the Matchmaker
  judged no candidate a defensible fit. That is a result, not a failure.

## What to look at in `run-mock/trace.jsonl`

The mock writer fabricates one citation on the first draft **on purpose**, so the rejection loop is
reproducible without spending money: six `proposal.reviewed` rejections, six revisions, six
approvals. Use it to see the Critic's feedback path in a few hundred milliseconds.

## Why the real run has zero rejections

Real models cited correctly in this run, so the Critic approved on the first pass — which is the
behaviour you want. The rejection path is not untested: it is covered by
`tests/critic.test.ts` (a fabricated id is rejected even when it looks plausible) and visible in
`run-mock/`.

One real rejection did happen during development and is worth recording: the Writer cited
`C001::C001-CH1::R0071` — an internal pair key that had leaked into the prompt — and the Critic
rejected the proposal deterministically before any model opinion was consulted. The fix was to stop
passing the internal `key` field to the model. The guard stayed.
