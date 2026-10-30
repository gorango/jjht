/**
 * The worker pool. Concurrency in this system is the size of these pools: each
 * worker is an independent participant with its own loop, and they contend for
 * work through the lease market rather than being handed tasks in a sequence.
 */
import type { Agent } from "@mozaik-ai/core";

import type { EurekaState, Role } from "../runtime/state.js";
import { ROLES } from "../runtime/state.js";
import { ROLE_SPECS, modelFor } from "./roles.js";
import { createWorker } from "./worker.js";

export interface Pool {
  role: Role;
  agents: Agent[];
}

export const createPools = (state: EurekaState): Pool[] =>
  ROLES.map((role) => {
    const spec = ROLE_SPECS[role];
    const size = state.config.poolSize[role] ?? 1;
    const agents = Array.from({ length: size }, (_, index) =>
      createWorker(state, { ...spec, model: modelFor(state, spec) }, index + 1),
    );
    return { role, agents };
  });
