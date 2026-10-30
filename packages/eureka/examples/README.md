# Example runs

Runs kept as the artefacts the brief asks for: a trace of a full run, an architecture diagram, and
at least three proposals.

| | `run-openrouter/` | `run-proposals/` | `run-full/` | `run-mock/` |
| --- | --- | --- | --- | --- |
| Date | 2026-10-30 | 2026-10-30 | 2026-10-30 | 2026-10-30 |
| Provider | OpenRouter (`deepseek/deepseek-v4-pro` for every role) | same run as `run-openrouter/` | deterministic mock, full scale | deterministic mock, default scale |
| Command | `EUREKA_FAST_MODEL=deepseek/deepseek-v4-pro bun start -- --companies=4 --challenges=1` | same run | `MOCK=1 bun start -- --companies=12 --challenges=2` | `bun run mock` |
| Companies / challenges | 4 / 4 | 4 / 4 | 12 / 24 | 6 / 12 |
| Proposals | 4 | 4 | 24 | 12 |
| Approved | 4 | 4 | 24 | 12 |
| Critic rejections | 4 | 4 | 24 | 12 |
| Abandoned after 3 attempts | 0 | 0 | 0 | 0 |
| Unmatched (on purpose) | 0 | 0 | 0 | 0 |
| Portfolio | 4 | 4 | 5 | 5 |
| Model calls | 36 | 36 | 201 | 103 |
| Cost (est.) | $0.1934 | $0.1934 | $0.0000 | $0.0000 |
| Wall clock | 131.0s | 131.0s | 0.4s | 0.3s |
| Max in flight | 7 | 7 | 14 | 14 |

Each directory contains `trace.jsonl`, `portfolio.md`, `run.json` and `architecture.mmd`.

`run-openrouter/` and `run-proposals/` are the same real run, kept under both names because the brief
asks for a trace showing the Critic stepping in and for three proposals. It contains **4 real Critic
rejections and 4 approvals**; nothing was forced. `run-full/` was regenerated offline at 24
challenges because the paid-run budget was already spent; its text generation is mock and its
`run.json` says cost $0, so it proves scale and concurrency, not proposal quality.

## What to look at in `run-openrouter/trace.jsonl`

- `challenge.analyzed` — the retrieval result: which researchers were considered for that challenge,
  and why (shared terms).
- `pairs.ranked` — the Matchmaker's scoring, with a reason and a risk per pair.
- `proposal.reviewed` — **where the Critic stepped in**. Four entries are `reject`; each carries
  `verdict`, the Critic's `note`, `hardRejects` (machine-readable codes), and the claim ledger
  (`data.claims[]`) with each claim's sources and status. The four approvals follow revisions.
- `task.measured` — per-task model, tokens, cost and duration. This is the transparency spine.
- `portfolio.ready` / `run.completed` — the final selection and the counters.

The three best proposals at the top of the portfolio are ArmaturaSec × Krisztina Kiss, Zrenjanin
Game Works × Danilo Mitrović, and AutomVoj × Bojan Erić. Each has the organisers' reference shape:
supervisors and candidate, research questions, a three-year plan with a quantified year-one
milestone, what each side brings, why this pair, an agreed publication/IP clause, risks and an
explicit unverified-evidence section.

## What to look at in `run-mock/trace.jsonl`

The mock writer fabricates one citation on the first draft **on purpose**, so the rejection loop is
reproducible without spending money: twelve `proposal.reviewed` rejections, twelve revisions, twelve
approvals. Use it to see the Critic's feedback path in a few hundred milliseconds.

## What to look at in `run-full/trace.jsonl`

A full-scale offline run: 12 companies, 24 challenges, 201 model calls, up to 14 turns in flight,
$0.00. It is the cheapest way to inspect the queues, leases and concurrency at size.

## Honest note on the real run

A clean run first produced proposals that cut corners (a missing publication title, a year-one plan
with no number, an unsourced person claim); the Critic rejected them and the Writer revised. Those
rejections are in the trace. Nothing was coerced by a test flag.

`bun run check:examples` re-reads these files and fails if any number in the READMEs or any claimed
trace event drifts.
