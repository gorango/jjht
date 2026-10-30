# Pivot review — the Gemini conversation

A decision record for the ideas raised in the 30 October brainstorming session: what was proposed,
what survives contact with the rules and the rubric, and what we are doing instead. Companion to
[`review.md`](review.md) and [`docs/rules/`](rules/README.md).

**Decision: no pivot.** Deepen EUREKA. Import exactly one idea from the conversation — human-injected
fault scenarios — as an optional mode inside the existing project. Rationale and revisit conditions
below.

---

## 1. What the conversation actually proposed

Twenty-three distinct suggestions, in the order they appeared. "Turn" means the approximate point in
the exchange.

| # | Idea | Turn | Category |
| --- | --- | --- | --- |
| 1 | Decentralized oracle for algorithmic trading signals; independent sources validate each other, aggregate a consensus before acting | early | Trading |
| 2 | Automated risk-management swarm: volatility monitors, exposure checks, pause execution at systemic thresholds | early | Trading |
| 3 | Market-microstructure simulation: one swarm simulates L2 order-book dynamics, responders adapt strategies | early | Trading |
| 4 | Merge 1–3 into one signal → risk → execution environment | early | Trading |
| 5 | Decentralized supply-chain coordinator (suppliers, warehouses, distributors) | mid | Simulation |
| 6 | Collaborative research swarm that debates and synthesizes a report | mid | Research |
| 7 | Automated content moderation with routing | mid | Ops |
| 8 | Concurrent CI/CD pipeline manager (build, test, security in parallel) | mid | Dev tools |
| 9 | Distributed-systems monitor: heartbeats, failure detection, self-healing | mid | Infra |
| 10 | Cybersecurity defender: network, endpoint, integrity agents, containment | mid | Security |
| 11 | Decentralized energy-grid manager | later | Simulation |
| 12 | Distributed-database sync manager (replication conflicts, consistency) | later | Infra |
| 13 | Autonomous infrastructure recovery | later | Infra |
| 14 | Real-time collaborative code-generation swarm for pull requests | later | Dev tools |
| 15 | Automated trading risk suite (market dynamics, toxic flow, system health) | later | Trading |
| 16 | Scenario-based stress testing instead of backtesting: replay flash crash / liquidity spike | later | Method |
| 17 | Infrastructure failure scenarios: feed loss, dead execution service, backup routing | later | Method |
| 18 | Human-in-the-loop dashboard as an **event injector** into the live run | later | Method |
| 19 | Apply the injection pattern to cyber, infra, and trading variants | later | Method |
| 20 | Stack: TypeScript/Node, `RuntimeState`, situation handlers, non-blocking loops | later | Implementation |
| 21 | Static HTML + JS frontend dispatching events to the backend | later | Implementation |
| 22 | Dashboard flair: live event log, participant connectivity graph, anomaly-injection panel | later | UI |
| 23 | Graph libraries: vis-network, D3, Cytoscape | later | UI |

Most of these are not ideas about *this* hackathon. They are a list of domains that could host
concurrent agents, generated without reference to the three briefs, the two rubrics that matter, or
the one-entry rule.

---

## 2. The constraints the conversation never applied

Any pivot has to survive these. None of them were mentioned:

1. **One entry per team, one track** (rules §3, briefs). A new project does not supplement EUREKA; it
   replaces it. There is no "submit both".
2. **Track 02 has a partner and a dataset.** The EINSTEIN brief supplies 1,047 researchers, 153
   companies, 489 challenges, a curated API guide, and mentors. A trading or security system starts
   with none of that and no partner alignment — the 15-point "potential for real use" criterion has
   nothing to attach to.
3. **The jury scores evidence, not ambition.** Last edition's winner took first place with a
   measured ablation (600 runs, 100 losses in both control arms, 0 with the interlock), not with a
   broader domain.
4. **Time.** Deadline is Saturday 14:00; roughly 27 hours remain, minus sleep, minus submission.
   A new domain means new data, new prompts, new failure modes, new README, new demo.
5. **The rubric is already aligned.** EUREKA's claim ledger is a direct answer to a criterion that
   exists in only one track. A new project would compete on generic criteria where 40 other teams
   already are.

---

## 3. Option comparison

Scores are estimates for **the state at Saturday 14:00**, not potential.

| Option | Track | Effort to be credible | Realistic score | Variance | Partner fit | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Deepen EUREKA** (current) | 02 | 8–10 h | **88–93** | low | Strong (EINSTEIN) | **Chosen** |
| B. Pivot to trading risk control room | 03 | 14–18 h | 55–70 | very high | None | Reject |
| C. EUREKA + red-team mode | 02 | +3–4 h | 90–94 | low | Strong | **Adopt if P1–P2 land early** |
| D. Cyber defender / distributed-systems monitor | 03 | 12–16 h | 60–75 | high | None | Reject |
| E. Supply chain / energy grid / DB sync | 03 | 12–16 h | 55–70 | high | None | Reject |
| F. CI/CD or PR code-gen swarm | 01 or 03 | 12–16 h | 60–75 | high | None | Reject — judges wrote baro |

Option B is the one worth arguing about, so: a trading control room is the most *demo-friendly* of
the rejects. A human clicks "flash crash", agents react, the dashboard lights up. It would look
good for ninety seconds. It loses on the things this jury actually scores:

- **"Useful and original" (30).** Financial risk tooling is neither novel to this jury nor
  verifiable in the time available.
- **"It works" (25).** "Works" for a risk system means it would have protected you. That requires
  backtesting, which the conversation itself conceded was infeasible and proposed replacing with
  scenarios. Scenarios demonstrate *reactivity*, not *correctness*.
- **Credibility.** EUREKA's own README already documents dropping two features — the Funding Scout
  and CORDIS pair-matching — because the evidence could not support them. Shipping a simulated
  trading desk with invented prices would violate the same principle at a larger scale.

The cheapest honest version of B is a simulator that says "this is a simulator", which is exactly
what last edition's simulations did — and that category had five entries.

---

## 4. Idea-by-idea assessment

| # | Idea | Verdict | Reason |
| --- | --- | --- | --- |
| 1 | Oracle consensus for trading signals | Reject | No ground truth for "correct signal"; consensus among sources is not accuracy. Demo is theatre with invented prices. |
| 2 | Risk-management swarm | Reject | The invariant (pause at threshold) is good, but without a market it is a state machine with three agents. |
| 3 | Market-microstructure simulation | Defer | Genuinely interesting concurrency, but it simulates a simulation; 5–6 h minimum for a convincing order book. |
| 4 | Merge 1–3 | Reject | Scope creep. The user flagged it in the conversation ("highly related and interconnected"); the correct response was "pick one", not "integrate". |
| 5 | Supply-chain coordinator | Defer | Reasonable invariant (stock never negative), but no dataset and a crowded simulation space. |
| 6 | Collaborative research swarm | Reject | Strictly weaker than EUREKA: same domain, no claim ledger, no sourced-output discipline. |
| 7 | Content moderation | Reject | Policy nuance, no labeled corpus, weak proof of correctness. |
| 8 | CI/CD manager | Reject | Overlaps Track 01; the Track 01 reference implementation is baro, written by the judges. |
| 9 | Distributed-systems monitor | Defer | Best of the infra ideas (failure detection + self-healing is a real invariant), but incident/ops was the largest category last edition (11 of 40). |
| 10 | Cybersecurity defender | Defer | 7 of 40 last edition; needs a labeled attack corpus or it is fake logs versus fake attacks. |
| 11 | Energy grid | Defer | Good physical invariant (balance), heavy simulation cost. |
| 12 | DB sync manager | Defer | Conflict invariants are provable and testable — the most intellectually solid reject — but niche and hard to demo in the time left. |
| 13 | Autonomous infra recovery | Defer | Same as 9 with more scope. |
| 14 | PR code-gen swarm | Reject | Directly competes with baro and with Track 01's premise. |
| 15 | Trading risk suite | Reject | As B above. |
| 16 | Scenario stress testing | **Adopt (method)** | The right substitute for backtesting *for a demo*, and the right way to prove recovery. Not a claim of profitability. |
| 17 | Infrastructure failure scenarios | **Adopt (method)** | Becomes fault injection: stalled worker, expired lease, provider error, duplicate researcher. |
| 18 | Human as event injector | **Adopt (design)** | Natively Mozaik: a `Human` participant calls `sendEvent`, agents react. This is the one durable idea in the thread. |
| 19 | Apply injection across domains | Partially adopt | Apply it to EUREKA only. Cross-domain application is the pivot we are rejecting. |
| 20 | TypeScript + `RuntimeState` + handlers | Adopt (already done) | Correct, and already the architecture. |
| 21 | Static HTML + JS frontend | Defer | Track 02 scores no UI. The existing trace viewer is enough. |
| 22 | Event log, connectivity graph, injection panel | Partial | Event log exists (trace viewer). Connectivity graph is decoration. Injection panel is worth building **only** as the red-team control. |
| 23 | vis-network / D3 / Cytoscape | Reject | No scoring value; adds a dependency and a maintenance surface for a picture. |

Summary: **3 adopt, 1 partial, 6 defer, 13 reject.**

---

## 5. Process critique of the conversation

Separate from the ideas, the exchange itself has reusable lessons:

1. **It answered a different question.** Asked for alternatives to a Track 02 submission, it
   produced a domain list. Asked for out-of-the-box ideas, it produced more domains. It never asked
   which track, what the rubric was, or whether a second entry was possible.
2. **It asserted a fact the user could check and it could not.** It claimed it could not access the
   winners list; the page is public and scrapeable, and the winners are exactly the evidence needed
   to judge whether an idea is derivative. The user had to correct it twice.
3. **It validated before verifying.** "That is already an incredibly strong submission" was offered
   without seeing the repository, the rubric, or the artifacts. Encouragement is cheap; a rubric
   table is useful.
4. **It drifted into implementation when asked to stay high-level**, then offered to define state
   structures after the user explicitly said "let's stay out of the weeds."
5. **It recommended merging related ideas**, which is the classic hackathon failure mode: three
   half-built systems instead of one finished one.
6. **Its one genuinely good contribution** — a human injecting scenarios into a live run — arrived
   late, as an answer to "how would this be demoed", and was not connected to the platform's own
   primitives until the user pushed.

The lesson for the remaining hours: **use the rubric as the interrogator**, not a general-purpose
model. Every idea should be scored against 30/25/20/15/10 before it gets any build time.

---

## 6. The one thing worth importing: red-team mode

If P1 (proposal quality) and P2 (measured concurrency) land by Friday evening, add a bounded
`--red-team` mode to EUREKA. It is the conversation's best idea, applied where it strengthens
existing points instead of resetting them.

**Design**

- A `Human` participant (`RedTeam`) joins the runtime and calls `sendEvent` with a scenario id.
- Scenarios, each of which targets an existing mechanism:

| Scenario | Injected event | What it should prove |
| --- | --- | --- |
| Undermatched challenge | `redteam.challenge` with a challenge that has no fit | The system says "no defensible pair" rather than inventing one |
| Fabricated citation | `redteam.poison` marks a proposal draft with a non-existent id | Code rejects before the model's verdict; writer revises |
| Stalled worker | `redteam.stall` makes one worker sleep past lease TTL | Lease expires, another worker reclaims, stale write discarded, trace shows it |
| Duplicate researcher | `redteam.alias` inserts a second record for the same person | Deduplication or an explicit "ambiguous identity" outcome |
| Provider error | `redteam.provider` returns a 500 once | Retry path, no silent empty proposal |

- Every scenario emits its own event and appears in the trace, so the viewer becomes a replay of
  adversarial conditions rather than a happy path.
- The README gets one paragraph and one command: `npm run mock -- --red-team`.

**Why it scores:** it strengthens the 30-point architecture criterion (recovery is visible), the
20-point transparency criterion (the trace explains failures), and the 10-point responsible-use
criterion (the system refuses to invent a pair). It costs 3–4 hours because the primitives already
exist: `sendEvent`, the lease market, the claim ledger, and the trace.

**Why not make it the whole submission:** because it is a mode, not a product. The 25-point proposal
criterion would still be untouched.

---

## 7. Decision

1. **Stay on Track 02 with EUREKA.** The rubric fit, the partner, the dataset, and the existing
   claim ledger are a comparative advantage that no new domain can match in 27 hours.
2. **Do not enter a second project.** The rules allow one entry per team; a second entry would
   require a second team and would halve focus.
3. **Import fault injection, not the trading domain.** Red-team mode is the transferable idea.
4. **Revisit only under the conditions in §8.**

Sunk cost is not the argument. The argument is that EUREKA is currently the best available use of the
remaining time under this rubric, and the alternatives are dominated on expected score.

---

## 8. What would change our mind

Reopen this decision only if one of these becomes true:

- **EUREKA cannot be made runnable** by Saturday morning (e.g. the lockfile/model path cannot be
  fixed). At that point the 25 "it works" points are gone and a simpler Freestyle entry might score
  higher — but only as a fallback, not a plan.
- **A real, labeled dataset and harness already exist locally** for one of the deferred ideas
  (market data with a backtest, a security corpus with ground truth). None does today.
- **There are three or more days left.** The constraint is time, not imagination.
- **The organizers publish judging cards that weight something other than the published rubrics.**
  Then re-score every option against the cards before doing anything else.

Absent one of those, the answer to "should we be more ambitious?" is: **be more rigorous instead.**
Ambition that a judge can measure beats ambition that a judge has to believe.
