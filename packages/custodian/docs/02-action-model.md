# 02 — The action model

## Why a closed schema

The attacker's leverage is text. If the model's output becomes a shell string, the attacker is
writing your shell. So the model's output is parsed into an `Intent` whose `action` must be a key of
`ACTIONS` (`src/domain/registry.ts`). An unknown action is a parse failure, not a command.

```ts
interface Intent {
  id: string;
  agent: string;
  action: ActionName;          // closed union, 8 values
  target: Target;              // kind + id
  params: Record<string, string | number>;
  ttlMs: number;               // auto-expiry
  rationale: { eventId: string; tainted: boolean; note?: string };
  requestedAt: number;
}
```

## The schema

| Action | Destructive | Undo | Blast radius | Notes |
| --- | --- | --- | --- | --- |
| `block_egress` | no | `unblock_egress` | from CIDR prefix: /8 → 90%, /16 → 35%, /24 → 10%, /32 → 2% | Narrowable to `params.suspect` |
| `unblock_egress` | no | — | 1% | Compensation only |
| `isolate` | **yes** | `release` | total traffic share of the host | Refused while evidence is locked |
| `release` | no | — | 1% | Compensation only |
| `snapshot` | no | — | 0% | Captures and hashes; never blocks |
| `drain_node` | **yes** | `release` | traffic share of the host | For maintenance-style evacuation |
| `revoke_token` | **yes** | **none** | ≤10% | Deliberately two-key: a revoked secret cannot be un-revoked |
| `scale` | no | `scale` back | 1% | Availability's positive action |

Two design rules fall out of the table:

1. **Destructive without undo ⇒ second key.** This is enforced in `checkIntent`, not in a prompt.
2. **Blast radius is computed from the topology, not asserted by the agent.** The agent can lie
   about impact; the graph cannot.

## Blast radius

```
isolate(host)          = Σ trafficShare(services on host)
block_egress(cidr)     = f(prefix length), or 1.0 if the CIDR is a protected range
scale(service, n)      = 0.01
snapshot(host)         = 0
```

The demo budget is **8% of production traffic**. In the money scenario:

- `block_egress(203.0.113.0/24)` = 10% → over budget → narrowed to `/32` = 2% → accepted.
- `isolate(host-7)` = 40% → over budget *and* evidence-locked → deferred.
- `block_egress(10.0.0.0/8)` = 90% and protected → rejected twice over.

## Compensation

Every destructive action except `revoke_token` returns an undo intent. The airlock records it before
execution, so the trace can answer "what would it take to put this back?" after the fact. The
compensation is not executed automatically during an incident; it is the rollback plan.

## Narrowing

`block_egress` is the only action with a `narrow` implementation today. Given a wide CIDR and a
concrete `suspect`, the airlock substitutes the suspect `/32` and re-runs every invariant on the
narrowed intent. If the narrowed intent passes, the decision is `rewrite`; if not, `reject`.

This is the cheapest demonstration of "the airlock changes the action" without inventing a magic
mapping between action types. More `narrow` implementations are a roadmap item, not a requirement.

## Capabilities

`capabilities: Record<agentId, string[]>` lives in shared state. `*` is the human wildcard. The
check is `caps.includes(definition.capability)`. Capability names deliberately match action names
today; they can diverge later (a `contain:*` token, a target-scoped token) without changing callers.

## Taint

`rationale.tainted` is set by whatever parsed the telemetry, not by the model. Sources that count as
tainted: log bodies, request headers, ticket text, filenames, error messages from user input.
Trusted: kernel/network counters the attacker cannot write, deploy events, the topology itself.

A tainted rationale does not ban the action. It means the action needs a second key — a human or an
independent participant — which is the same authority model as a nuclear two-man rule.

## The adapter interface (next)

The airlock decides; an adapter executes. Proposed shape:

```ts
interface InfraAdapter {
  observe(): AsyncIterable<TelemetryEvent>;
  execute(intent: Intent): Promise<{ ok: boolean; undo: Intent | null; observed?: string }>;
  compensate(intent: Intent): Promise<void>;
  blastRadius(intent: Intent): number;      // must agree with the registry
  describe(): string;                        // "sim" | "docker"
}
```

`SimAdapter` is the deterministic fixture. `DockerAdapter` implements the same calls against a local
Compose stack. The registry's `blastRadius` stays the source of truth; the adapter's job is to
refuse an execution whose observed impact disagrees with it, not to redefine it.
