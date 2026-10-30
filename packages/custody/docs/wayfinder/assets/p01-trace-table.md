# P01 — Live run trace table (prototype)

A cheap mock of the human-readable trace for the money scenario. The real runner adds `loopId`,
`producerId`, runner/cost fields and the wall-clock timestamps; this is the information design, not
the implementation. `window` is the incident window id; `INFLIGHT` is the number of handlers held at
the deadline.

| t (ms) | participant | event | intent | vote | decision | reason | window |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 100 | preserve-1 | `intent.proposed` | `i-snapshot` | — | — | capture before anything moves | `inc-1#1` |
| 110 | contain-1 | `intent.proposed` | `i-block` | — | — | block 203.0.113.0/24 | `inc-1#1` |
| 120 | contain-1 | `intent.proposed` | `i-isolate` | — | — | isolate host-7 | `inc-1#1` |
| 130 | edge-bot | `intent.proposed` | `i-injected` | — | — | 10.0.0.0/8 (tainted log line) | `inc-1#1` |
| 140 | availability-1 | `intent.proposed` | `i-scale` | — | — | scale checkout 3 → 6 | `inc-1#1` |
| 1500 | airlock | `window.closed` | — | — | — | **INFLIGHT 5** | `inc-1#1` |
| 1500 | airlock | `decision.made` | `i-snapshot` | — | **ACCEPT** | all invariants hold | `inc-1#1` |
| 1500 | airlock | `decision.made` | `i-block` | availability: blast 10% > 8% | **REWRITE** | narrowed /24 → /32 (2%) | `inc-1#1` |
| 1500 | airlock | `decision.made` | `i-isolate` | preserve: evidence lock; availability: 40% | **DEFER** | evidence lock on host-7 held by preserve-1 | `inc-1#1` |
| 1500 | airlock | `decision.made` | `i-injected` | provenance: taint; availability: protected + 90% | **REJECT** | tainted rationale; protected range; over budget | `inc-1#1` |
| 1500 | airlock | `decision.made` | `i-scale` | — | **ACCEPT** | all invariants hold | `inc-1#1` |
| 1501 | contain-1 | `function_call.started` | `i-block` | — | — | executes the narrowed /32 | `inc-1#1` |
| 1501 | preserve-1 | `function_call.started` | `i-snapshot` | — | — | snapshot host-7 | `inc-1#1` |
| 1502 | availability-1 | `function_call.started` | `i-scale` | — | — | scale checkout | `inc-1#1` |
| 1510 | airlock | `intent.deferred` | `i-isolate` | — | — | retryAt +2000, attempt 1/3 | `inc-1#1` |
| 1510 | airlock | `action.executed` | `i-block` | — | — | path: loop | `inc-1#1` |

## What the table must make obvious in five seconds

1. **Two loops were in flight before the decision**: `i-block` (contain-1) and `i-snapshot`
   (preserve-1) both proposed before `window.closed`.
2. **One intent changed another**: the wide block was rewritten, not rejected; the isolate was
   deferred because preserve held the host.
3. **Holding the capability was not enough**: edge-bot held `block_egress`, and its intent was still
   rejected.

## What the real trace adds

`loopId` and `producerId` on every event, `inference.started/completed` spans, `interception.started/
finished`, runner/cost fields, and the wall-clock `at`. The CLI can print this table; the JSONL keeps
the full data.
