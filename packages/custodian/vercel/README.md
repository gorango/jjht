# CUSTODIAN replay-only deploy

Static copy of the dashboard. No server, Docker, baro, or API key is needed at runtime.

This is a static upload. Vercel has nothing to install or build; `vercel.json` disables both.

## Build

From `packages/custodian`:

```bash
bun run vercel:build
```

## Deploy

From this directory:

```bash
npx vercel --prod
```

Or connect the repository in Vercel and set the project root to
`packages/custodian/vercel`. The generated `index.html` and `data/` must be committed
for a repository-connected deploy.

The page loads `data/scenarios.json`, `data/runs.json`, and one
`data/runs/<id>/trace.jsonl` plus `summary.json` per run.
