# Preparation notes — what scored last time

Sources: <https://build.jigjoy.ai/editions/build-2026/winners> and the project pages (accessed
2026-10-30). Last edition was **Build with Mozaik, 5–6 September 2026**, fully online, with daily.dev
and Hyperskill. Prizes and sponsors differ from this edition; the *patterns* are the useful part.

## Numbers

- 210 builders, 82 countries, 40 projects from 41 teams, 22 demo videos, 74 gallery likes.
- Most common stacks: TypeScript 28, Python 28, Node.js 16, React 12, Java 10.
- Categories: incident & operations 11, cybersecurity 7, developer tools 5, simulations 5,
  research & decisions 4, market & opportunity 3, agent infrastructure 2, content & learning 2,
  financial controls 1.

## Podium

### 1st — Separation ($500)

Two air-traffic controllers issue clearances that are safe alone and deadly together. An **airlock
holds both half-formed clearances mid-turn** and rewrites one before it executes. The write-skew
problem, transplanted into a Mozaik TRACON sector.

What made it win:

- **A precise, real failure mode**, not a demo theme: write skew, named in 1995, invisible to
  commit-time validation.
- **`InterceptionHandler` used at the exact right moment** — `handle()` is awaited inside the loop,
  which is the only interval where a peer's half-formed intent can change its mind.
- **A sequential ablation arm** proving the concurrency matters: 600 runs, 100 losses in both control
  arms, **0 with the interlock**; 100/100 hazardous seeds altered, 0/100 safe.
- **Shared state with a contract**: `VersionedCell` per aircraft, CAS writes, stale writes announced
  as `cas.rejected`.
- Observers, a trace file, and asserted invariants (e.g. "INFLIGHT AT THIS MOMENT: 2").

Takeaway: **the winning move is a measured ablation**, not a feature list.

### 2nd — Metamorph ($300)

CLI that migrates a codebase between frameworks. Mapper lists files onto the bus; workers rewrite in
a shadow copy; reviewers check; retry cap; coordinator starts integration once work settles; reporter
writes the summary *while* install/build runs.

What made it strong: "they never call each other", a shared migration plan, **bounded in-flight
work** (max 3 workers/reviewers) to control cost, a lock so integration cannot start twice, and
nothing touches the user's branch until Apply.

### 3rd — Watchtower ($200)

Security operations for Solana protocols, with **human approval** for protective actions.

### 4th — Butterfly; 5th — Hive

- Butterfly: interactive heist simulation where one changed event produces a different story.
- Hive: Windows desktop workspace where several agents collaborate on user requests.

### Hyperskill Premium (5)

BountyProof (verifies public software bounties), Zero-Capital Economic Agent Swarm, Concurrent
Agent-Based Simulation Environment, Separation, Metamorph.

## Patterns worth copying

1. **One concrete domain failure**, stated in one sentence, that a non-expert can feel.
2. **A control arm.** Show the same scenario with the concurrency mechanism disabled and report the
   difference as numbers. This is the single highest-signal artifact in either edition.
3. **A lock, lease, or airlock as the shared-state centerpiece** — something that makes double-work
   or double-writes structurally impossible.
4. **Bounded in-flight work** — a pool cap, not unbounded fan-out. It reads as engineering maturity.
5. **A trace a human can read**, with time and cost per task.
6. **Observers for UI**, so the interface is a participant rather than a special case.
7. **Honest failure** — a system allowed to say "no match" or "abandoned" reads as more credible
   than one that always produces an answer.

## Patterns that did not place

Incident/ops and security ideas were the largest category (18 of 40 projects), so competition there
is dense. Generic "swarm of agents monitors X" entries without a measured failure mode did not
podium. A pretty topology graph was not sufficient on its own.
