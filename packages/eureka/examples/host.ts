/**
 * A host participant, in-process.
 *
 *   MOCK=1 bun examples/host.ts
 *
 * This is the integration seam from the README, executable: the host joins the
 * same Mozaik bus as the five role pools, posts a challenge, and reacts to the
 * semantic events. It imports the runtime vocabulary, not the agents.
 *
 * For the HTTP seam instead, run `MOCK=1 bun src/index.ts serve` and use the
 * curl commands printed by that command.
 */
import { createHuman, SituationSpecification } from "@mozaik-ai/core";

import { startServe } from "../src/serve.js";
import { join } from "../src/runtime/session.js";

class PortfolioReady extends SituationSpecification {
  override isSatisfiedBy({ event }: { event: { type: string } }): boolean {
    return event.type === "portfolio.ready" || event.type === "run.completed";
  }
}

const context = await startServe(4301);

const host = createHuman({
  name: "NetworkHost",
  capabilities: ["observe"],
  handlers: [
    {
      specification: new PortfolioReady(),
      processor: {
        apply({ event }) {
          const payload = event.payload as any;
          if (event.type === "portfolio.ready") {
            console.log(`\n  host received portfolio.ready: ${payload.entries.length} collaborations`);
          } else {
            console.log(`  host received run.completed: $${payload.summary.costUsd.toFixed(4)}`);
            setTimeout(() => process.exit(0), 200);
          }
        },
      },
    },
  ],
});
join(host);

const result = context.postChallenge({ challengeId: "C001-CH1" });
console.log("  host posted challenge:", result);
