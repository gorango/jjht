/**
 * The closed action schema.
 *
 * If an action is not in this registry, an agent cannot propose it. That is the
 * first line of defence against prompt injection: the model's output is parsed
 * into a name from this list, never into a shell command.
 */
import { hostOf, servicesOnHost, trafficOnHost } from "./topology.js";
import type { ActionName, Intent, Topology } from "./types.js";

export interface ActionDefinition {
  name: ActionName;
  label: string;
  /** Capability an agent must hold to propose this. */
  capability: string;
  /** Can remove availability or destroy in-flight evidence. */
  destructive: boolean;
  /** The undo, if one exists. `undefined` means the action needs a second key. */
  compensation?: (intent: Intent) => Intent | null;
  blastRadius: (topology: Topology, intent: Intent) => number;
  /** A safer, narrower intent the airlock may substitute. */
  narrow?: (intent: Intent) => Intent | null;
}

const cidrPrefix = (cidr: string): number => {
  const [, raw] = cidr.split("/");
  const prefix = Number(raw ?? "32");
  return Number.isFinite(prefix) ? prefix : 32;
};

/** Traffic share a CIDR block plausibly covers, from its prefix length. */
const cidrBlast = (cidr: string): number => {
  const prefix = cidrPrefix(cidr);
  if (prefix <= 8) return 0.9;
  if (prefix <= 16) return 0.35;
  if (prefix <= 24) return 0.1;
  return 0.02;
};

const concrete = (value: unknown): string | undefined => {
  const text = String(value ?? "");
  return text.length > 0 ? text : undefined;
};

export const ACTIONS: Record<ActionName, ActionDefinition> = {
  block_egress: {
    name: "block_egress",
    label: "block egress at the edge",
    capability: "block_egress",
    destructive: false,
    compensation: (intent) => ({
      ...intent,
      id: `${intent.id}#undo`,
      action: "unblock_egress",
      rationale: { ...intent.rationale, note: "compensation" },
    }),
    blastRadius: (topology, intent) => {
      const cidr = concrete(intent.params.cidr) ?? "";
      if ((topology.protectedCidrs ?? []).includes(cidr)) return 1;
      return cidrBlast(cidr);
    },
    narrow: (intent) => {
      const suspect = concrete(intent.params.suspect);
      const cidr = concrete(intent.params.cidr);
      if (!suspect || !cidr || suspect === cidr) return null;
      return {
        ...intent,
        id: `${intent.id}#narrow`,
        params: { ...intent.params, cidr: suspect.includes("/") ? suspect : `${suspect}/32` },
        rationale: { ...intent.rationale, note: "narrowed by the airlock" },
      };
    },
  },

  unblock_egress: {
    name: "unblock_egress",
    label: "remove an egress block",
    capability: "block_egress",
    destructive: false,
    blastRadius: () => 0.01,
  },

  isolate: {
    name: "isolate",
    label: "isolate a host",
    capability: "isolate",
    destructive: true,
    compensation: (intent) => ({
      ...intent,
      id: `${intent.id}#undo`,
      action: "release",
      rationale: { ...intent.rationale, note: "compensation" },
    }),
    blastRadius: (topology, intent) =>
      intent.target.kind === "host" ? trafficOnHost(topology, intent.target.id) : 0,
  },

  release: {
    name: "release",
    label: "return a host to service",
    capability: "isolate",
    destructive: false,
    blastRadius: () => 0.01,
  },

  snapshot: {
    name: "snapshot",
    label: "capture and hash evidence",
    capability: "snapshot",
    destructive: false,
    blastRadius: () => 0,
  },

  drain_node: {
    name: "drain_node",
    label: "drain a node",
    capability: "drain_node",
    destructive: true,
    compensation: (intent) => ({
      ...intent,
      id: `${intent.id}#undo`,
      action: "release",
      rationale: { ...intent.rationale, note: "compensation" },
    }),
    blastRadius: (topology, intent) => trafficOnHost(topology, intent.target.id),
  },

  revoke_token: {
    name: "revoke_token",
    label: "revoke a credential",
    capability: "revoke_token",
    destructive: true,
    // No undo: a revoked secret cannot be un-revoked, only reissued. Needs two keys.
    blastRadius: (topology, intent) => {
      if (intent.target.kind !== "service") return 0.02;
      const host = hostOf(topology, intent.target.id);
      return host ? Math.min(0.1, trafficOnHost(topology, host) / 4) : 0.02;
    },
  },

  scale: {
    name: "scale",
    label: "add capacity",
    capability: "scale",
    destructive: false,
    compensation: (intent) => ({
      ...intent,
      id: `${intent.id}#undo`,
      action: "scale",
      params: { ...intent.params, replicas: Number(intent.params.from ?? 1) },
      rationale: { ...intent.rationale, note: "compensation" },
    }),
    blastRadius: () => 0.01,
  },
};

export const definitionOf = (action: ActionName): ActionDefinition => ACTIONS[action];

/** Services an isolate would take out, for explaining the decision. */
export const affectedServices = (topology: Topology, intent: Intent): string[] => {
  if (intent.target.kind === "host") return servicesOnHost(topology, intent.target.id);
  if (intent.target.kind === "service") return [intent.target.id];
  return [];
};
