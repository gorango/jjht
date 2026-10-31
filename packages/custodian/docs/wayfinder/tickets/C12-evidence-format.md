---
id: C12
title: "Evidence format and CHAIN_OF_CUSTODIAN_PLACEHOLDER"
type: grilling
status: closed
parent: CUSTODIAN-MAP
blocked_by: [C02]
assignee: null
labels: [wayfinder:ticket, wayfinder:grilling]
---

# Evidence format and CHAIN_OF_CUSTODIAN_PLACEHOLDER

## Question

Is a JSON bundle with SHA-256 hashes enough to support the "evidence intact" claim, or does the slice
need a signed manifest or an external timestamp?

Decide:

- **Schema.** What exactly is in `evidence/<incident>/<host>/<timestamp>/`: `meta.json`, logs,
  processes, connections, hashes. Which fields are load-bearing, and which are decoration?
- **What is hashed.** Individual files, a canonical manifest, or both? In what order, and with what
  canonicalisation (newlines, sort order, timestamps)? Can a reviewer recompute it offline?
- **Lock proof.** How does the bundle show that Preserve's lock was held during capture, and that no
  action modified the host while it was held? A timestamp alone is not proof.
- **Signing.** Is a signature needed for the claim, or is "hash + git commit + trace" enough? If
  signed, who holds the key, and what does that add to a hackathon demo?
- **Verification command.** What one command lets a judge check the bundle, and what does it print?
- **Honesty.** What can the bundle *not* prove (memory, packets, completeness, absence of tampering
  before capture)? State it in the README.

## Why this is a decision, not a build

"Evidence intact" is an ablation metric and a demo claim. A hash of a file the attacker could have
written proves integrity, not provenance. The format determines what the viewer shows and what the
README may say. It must be fixed before the snapshot implementation and the ablation labelling.

## Inputs

- `06-infrastructure-and-repo-handoff.md` §"Evidence bundle".
- `02-action-model.md` §"Compensation" and `snapshot` row.
- `Docker adapter reversibility and evidence capture` for what can actually be captured.
- `04-judge-and-evidence.md` §"The ablation" (evidence intact metric).

## Resolution

**Resolved 2026-10-30 (delegated).** **JSON bundle + SHA-256 manifest + an anchor recorded outside
the bundle. No signature in the slice.**

Bundle layout (from C02):

```text
evidence/<incident>/<host>/<timestamp>/
  meta.json               # canonical JSON: host, capturedAt, adapter, command, lockId,
                          #   lockHolder, lockUntil, captureStarted, captureFinished,
                          #   per-artifact sha256
  logs.txt                # docker logs --timestamps
  processes.txt           # docker top -eo pid,ppid,user,stat,lstart,args
  connections.txt         # netstat -tnp + /proc/net/tcp[6]
  inspect.redacted.json   # selected docker inspect fields, env values redacted
  hashes.txt              # sorted "<sha256>  <filename>" for every file incl. meta.json
  anchor.sha256           # sha256 of hashes.txt, committed to the trace / repo
```

- **Hash chain:** each artifact → `hashes.txt`; `hashes.txt` → `anchor.sha256`. The anchor is written
  to the trace (`evidence.anchored`) and committed outside the bundle so altering the bundle without
  the anchor is detectable.
- **Lock proof:** `meta.json` records `lockId`, holder and expiry; the trace has `lock.acquired` and
  `lock.released`; the viewer shows the capture window inside the lock window. The bundle alone does
  not prove the lock was respected — the trace does.
- **Verification:** `bun run custodian:verify-evidence <dir>` recomputes `sha256sum -c hashes.txt` and
  checks `anchor.sha256`. It prints `OK` or the first mismatch.
- **No signature.** A signature adds key management and does not prove pre-capture integrity; the
  anchor + git commit is enough for the slice's claim.
- **Honest limitations:** the hashes prove integrity **after capture**, not identity, reproducibility
  (logs/connections move) or pre-capture tampering. No memory, packets, disk or rootfs capture is
  claimed. `meta.json` is canonical (sorted keys, compact separators, UTF-8, trailing newline) so the
  hash is stable.
