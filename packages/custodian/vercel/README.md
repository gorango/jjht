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

The generated `index.html` and `data/` are committed. Rebuild and commit them after a change.

If the project is rooted at the repository or at `packages/custodian`, the `vercel.json` there
sets `framework: null`, disables install and build, and points the output at this folder.

The page loads `data/scenarios.json`, `data/runs.json`, and one
`data/runs/<id>/trace.jsonl` plus `summary.json` per run.
