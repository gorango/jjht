/**
 * The topology the airlock reasons about. In production this is fed by the
 * infrastructure adapter; here it is a small, deterministic fixture so the
 * invariants can be tested without a cluster.
 */
import type { Topology } from "./types.js";

export const demoTopology: Topology = {
  services: [
    { id: "payments-api", trafficShare: 0.32, host: "host-7", critical: true },
    { id: "redis", trafficShare: 0.08, host: "host-7", critical: true },
    { id: "checkout", trafficShare: 0.28, host: "host-12", critical: true },
    { id: "catalog", trafficShare: 0.19, host: "host-12", critical: false },
    { id: "search", trafficShare: 0.09, host: "host-19", critical: false },
    { id: "mailer", trafficShare: 0.04, host: "host-19", critical: false },
  ],
  hosts: {
    "host-7": ["payments-api", "redis"],
    "host-12": ["checkout", "catalog"],
    "host-19": ["search", "mailer"],
  },
  links: [
    { from: "edge", to: "host-7" },
    { from: "edge", to: "host-12" },
    { from: "edge", to: "host-19" },
  ],
  protectedCidrs: ["10.0.0.0/8"],
};

export const trafficOnHost = (topology: Topology, hostId: string): number =>
  topology.services
    .filter((service) => service.host === hostId)
    .reduce((total, service) => total + service.trafficShare, 0);

export const hostOf = (topology: Topology, serviceId: string): string | undefined =>
  topology.services.find((service) => service.id === serviceId)?.host;

export const servicesOnHost = (topology: Topology, hostId: string): string[] =>
  topology.hosts[hostId] ?? [];
