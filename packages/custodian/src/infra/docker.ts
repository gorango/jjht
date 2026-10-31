/**
 * The Docker adapter. It is a second real implementation of the same port:
 * the runtime, the airlock and the trace do not know which adapter ran.
 *
 * The block is an ingress block at the local edge, not a destination-based
 * egress filter (C02). The probe runs from a fixed address on the compose
 * network so the `deny` rule has a real client to reject.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { EvidenceLock, Intent } from "../domain/types.js";
import type { Clock } from "../runtime/clock.js";
import { publish } from "../runtime/ingest.js";
import type { CustodianState, ExecutedAction } from "../runtime/state.js";
import {
  AdapterError,
  recordExecution,
  recordLock,
  type EvidenceAnchor,
  type InfraAdapter,
  type LockInput,
} from "./adapter.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "../..");

export interface DockerAdapterOptions {
  evidenceRoot: string;
  composeFile?: string;
  project?: string;
  cwd?: string;
  probeImage?: string;
  probeFrom?: string;
  probeUrl?: string;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

const run = (file: string, args: string[], cwd: string, timeout = 90_000): Promise<CommandResult> =>
  new Promise((settle) => {
    execFile(
      file,
      args,
      { cwd, timeout, maxBuffer: 16 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        const raw = (error as { code?: unknown } | null)?.code;
        const code = error ? (typeof raw === "number" ? raw : 1) : 0;
        settle({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      },
    );
  });

const snippet = (value: string): string => value.trim().split("\n").slice(0, 3).join(" | ");

const isIpv4Cidr = (value: string): boolean => {
  const [address, prefixRaw] = value.split("/");
  if (!address || prefixRaw === undefined || !/^\d{1,2}$/.test(prefixRaw)) return false;
  const prefix = Number(prefixRaw);
  if (prefix > 32) return false;
  const octets = address.split(".");
  return (
    octets.length === 4 &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
};

const sortedValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortedValue(record[key])]),
    );
  }
  return value;
};

/** C12: sorted keys, compact separators, UTF-8, trailing newline. */
export const canonicalJson = (value: unknown): string =>
  `${JSON.stringify(sortedValue(value))}\n`;

const sha256 = (data: Buffer | string): string =>
  createHash("sha256").update(data).digest("hex");

const stamp = (date: Date): string => date.toISOString().replace(/[:.]/g, "-");

const safeSegment = (value: string): string => value.replace(/[^A-Za-z0-9._-]/g, "_");

const redactEnv = (env: unknown): unknown => {
  if (!Array.isArray(env)) return [];
  return env.map((entry) => {
    const text = String(entry);
    const index = text.indexOf("=");
    return index === -1 ? text : `${text.slice(0, index)}=<redacted>`;
  });
};

/** Only the load-bearing fields; every env value is redacted. */
const redactInspect = (raw: unknown): unknown => {
  const inspect = (Array.isArray(raw) ? raw[0] : raw) as Record<string, any> | undefined;
  if (!inspect) return {};
  const state = inspect.State ?? {};
  const config = inspect.Config ?? {};
  const networks = inspect.NetworkSettings?.Networks ?? {};
  const mounts = Array.isArray(inspect.Mounts) ? inspect.Mounts : [];
  return {
    Id: inspect.Id ?? null,
    Name: inspect.Name ?? null,
    Image: inspect.Image ?? null,
    State: {
      Status: state.Status ?? null,
      Running: state.Running ?? null,
      Paused: state.Paused ?? null,
      StartedAt: state.StartedAt ?? null,
    },
    Config: {
      Image: config.Image ?? null,
      Env: redactEnv(config.Env),
      Labels: config.Labels ?? {},
    },
    HostConfig: {
      NetworkMode: inspect.HostConfig?.NetworkMode ?? null,
      RestartPolicy: inspect.HostConfig?.RestartPolicy ?? null,
    },
    NetworkSettings: {
      Networks: Object.fromEntries(
        Object.entries(networks).map(([name, value]) => {
          const network = value as Record<string, unknown>;
          return [name, { IPAddress: network.IPAddress ?? null, NetworkID: network.NetworkID ?? null }];
        }),
      ),
    },
    Mounts: mounts.map((mount: Record<string, unknown>) => ({
      Type: mount.Type ?? null,
      Source: mount.Source ?? null,
      Destination: mount.Destination ?? null,
      RW: mount.RW ?? null,
    })),
  };
};

export class DockerAdapter implements InfraAdapter {
  private readonly evidenceRoot: string;

  private readonly composeFile: string;

  private readonly project: string;

  private readonly cwd: string;

  private readonly probeImage: string;

  private readonly probeFrom: string;

  private readonly probeUrl: string;

  /** Previous include content per blocked CIDR; unblock restores exact bytes. */
  private readonly previousIncludes = new Map<string, string>();

  constructor(
    private readonly state: CustodianState,
    private readonly clock: Clock,
    options: DockerAdapterOptions,
  ) {
    this.evidenceRoot = resolve(options.evidenceRoot);
    this.composeFile = resolve(options.composeFile ?? join(PACKAGE_ROOT, "docker/compose.yaml"));
    this.project = options.project ?? process.env.CUSTODIAN_DOCKER_PROJECT ?? "custodian-docker";
    this.cwd = options.cwd ?? PACKAGE_ROOT;
    this.probeImage = options.probeImage ?? process.env.CUSTODIAN_PROBE_IMAGE ?? "curlimages/curl:8.10.0";
    this.probeFrom = options.probeFrom ?? process.env.CUSTODIAN_PROBE_IP ?? "203.0.113.9";
    this.probeUrl = options.probeUrl ?? process.env.CUSTODIAN_PROBE_URL ?? "http://edge/checkout";
  }

  async apply(intent: Intent, path: ExecutedAction["path"]): Promise<ExecutedAction> {
    let anchor: EvidenceAnchor | undefined;
    switch (intent.action) {
      case "block_egress":
        await this.block(intent);
        break;
      case "unblock_egress":
        await this.unblock(intent);
        break;
      case "snapshot":
        anchor = await this.snapshot(intent);
        break;
      case "isolate":
        await this.docker(["pause", await this.containerId("app")]);
        break;
      case "release":
        await this.docker(["unpause", await this.containerId("app")]);
        break;
      case "scale":
        await this.scale(intent);
        break;
      default:
        throw new AdapterError(
          "not_supported",
          `${intent.action} has no Docker mapping in this slice`,
        );
    }

    if (anchor) publish("evidence.anchored", intent.agent, anchor);
    return recordExecution(this.state, intent, path);
  }

  lockEvidence(input: LockInput): EvidenceLock {
    return recordLock(this.state, this.clock, input);
  }

  private async docker(args: string[], timeout?: number): Promise<CommandResult> {
    const result = await run("docker", args, this.cwd, timeout);
    if (result.code !== 0) {
      throw new AdapterError(
        "docker_failed",
        `docker ${args.slice(0, 2).join(" ")} exited ${result.code}: ${snippet(result.stderr || result.stdout)}`,
      );
    }
    return result;
  }

  private async compose(args: string[]): Promise<CommandResult> {
    const result = await run(
      "docker",
      ["compose", "-p", this.project, "-f", this.composeFile, ...args],
      this.cwd,
    );
    if (result.code !== 0) {
      throw new AdapterError(
        "compose_failed",
        `docker compose ${args.slice(0, 2).join(" ")} exited ${result.code}: ${snippet(result.stderr || result.stdout)}`,
      );
    }
    return result;
  }

  private async containerId(service: string): Promise<string> {
    const result = await this.compose(["ps", "-q", service]);
    const id = result.stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!id) {
      throw new AdapterError(
        "stack_unavailable",
        `${service} is not running; start it with docker compose -f ${this.composeFile} up -d`,
      );
    }
    return id;
  }

  private async networkOf(containerId: string): Promise<string> {
    const result = await this.docker(["inspect", containerId]);
    let parsed: Array<Record<string, any>>;
    try {
      parsed = JSON.parse(result.stdout) as Array<Record<string, any>>;
    } catch {
      throw new AdapterError("docker_failed", "docker inspect returned invalid JSON");
    }
    const networks = parsed[0]?.NetworkSettings?.Networks ?? {};
    const name = Object.keys(networks)[0];
    if (!name) throw new AdapterError("stack_unavailable", "the edge container has no network");
    return name;
  }

  private includePath(): string {
    return resolve(dirname(this.composeFile), "edge/include/deny.conf");
  }

  private async reload(): Promise<void> {
    const test = await run(
      "docker",
      ["compose", "-p", this.project, "-f", this.composeFile, "exec", "-T", "edge", "nginx", "-t"],
      this.cwd,
    );
    if (test.code !== 0) {
      throw new AdapterError(
        "nginx_test_failed",
        `nginx -t rejected the include: ${snippet(test.stderr || test.stdout)}`,
      );
    }
    await this.compose(["exec", "-T", "edge", "nginx", "-s", "reload"]);
  }

  private async probe(agent: string, action: string, cidr: string): Promise<string> {
    const edgeId = await this.containerId("edge");
    const network = await this.networkOf(edgeId);
    const result = await this.docker(
      [
        "run",
        "--rm",
        "--network",
        network,
        "--ip",
        this.probeFrom,
        this.probeImage,
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        this.probeUrl,
      ],
      120_000,
    );
    const status = result.stdout.trim();
    publish("adapter.probe", agent, {
      action,
      cidr,
      from: this.probeFrom,
      url: this.probeUrl,
      status,
    });
    return status;
  }

  private async block(intent: Intent): Promise<void> {
    const cidr = String(intent.params.cidr ?? "");
    if (!isIpv4Cidr(cidr)) {
      throw new AdapterError("invalid_cidr", `"${cidr}" is not an IPv4 CIDR`);
    }
    if ((this.state.topology?.protectedCidrs ?? []).includes(cidr)) {
      throw new AdapterError("protected_cidr", `${cidr} is a protected range`);
    }

    const include = this.includePath();
    const previous = readFileSync(include, "utf8");
    const separator = previous.length === 0 || previous.endsWith("\n") ? "" : "\n";
    writeFileSync(include, `${previous}${separator}deny ${cidr};\n`);

    try {
      await this.reload();
      const status = await this.probe(intent.agent, "block_egress", cidr);
      if (status !== "403") {
        throw new AdapterError(
          "probe_failed",
          `expected 403 from ${this.probeFrom}, got ${status}`,
        );
      }
    } catch (error) {
      writeFileSync(include, previous);
      await this.reload().catch(() => undefined);
      throw error;
    }

    this.previousIncludes.set(cidr, previous);
  }

  private async unblock(intent: Intent): Promise<void> {
    const cidr = String(intent.params.cidr ?? "");
    const include = this.includePath();
    const previous = this.previousIncludes.get(cidr);
    if (previous === undefined) {
      throw new AdapterError("unknown_block", `no recorded include for ${cidr}; refusing to guess`);
    }

    writeFileSync(include, previous);
    await this.reload();
    const status = await this.probe(intent.agent, "unblock_egress", cidr);
    if (status === "403") {
      throw new AdapterError("probe_failed", `${this.probeFrom} is still denied after unblock`);
    }
    this.previousIncludes.delete(cidr);
  }

  private async scale(intent: Intent): Promise<void> {
    if (intent.target.id !== "checkout") {
      throw new AdapterError("not_supported", `no compose service maps to ${intent.target.id}`);
    }
    const replicas = Number(intent.params.replicas);
    if (!Number.isInteger(replicas) || replicas < 1 || replicas > 20) {
      throw new AdapterError("invalid_scale", `replicas must be an integer in 1..20, got ${String(intent.params.replicas)}`);
    }

    await this.compose(["up", "-d", "--scale", `app=${replicas}`, "app"]);
    const listed = await this.compose(["ps", "-q", "app"]);
    const running = listed.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0).length;
    publish("adapter.scaled", intent.agent, { service: intent.target.id, composeService: "app", running });
    if (running !== replicas) {
      throw new AdapterError("scale_failed", `requested ${replicas} replicas, compose reports ${running}`);
    }
  }

  private async snapshot(intent: Intent): Promise<EvidenceAnchor> {
    const appId = await this.containerId("app");
    const startedAt = new Date(this.clock.now());
    const incident = [...this.state.incidents.values()].at(-1)?.id ?? "global";
    const bundle = join(
      this.evidenceRoot,
      safeSegment(incident),
      safeSegment(intent.target.id),
      stamp(startedAt),
    );
    mkdirSync(bundle, { recursive: true });

    const logs = await this.docker(["logs", "--timestamps", appId]);
    const processes = await this.docker([
      "top",
      appId,
      "-eo",
      "pid,ppid,user,stat,lstart,args",
    ]);
    const connections = await this.docker([
      "exec",
      appId,
      "sh",
      "-c",
      "printf '== /proc/net/tcp ==\\n'; cat /proc/net/tcp; printf '== /proc/net/tcp6 ==\\n'; cat /proc/net/tcp6",
    ]);
    const inspected = await this.docker(["inspect", appId]);
    let redacted: unknown;
    try {
      redacted = redactInspect(JSON.parse(inspected.stdout));
    } catch {
      throw new AdapterError("capture_failed", "docker inspect returned invalid JSON");
    }

    const artifacts: Record<string, string> = {
      "logs.txt": logs.stdout,
      "processes.txt": processes.stdout,
      "connections.txt": connections.stdout,
      "inspect.redacted.json": canonicalJson(redacted),
    };
    for (const [name, body] of Object.entries(artifacts)) {
      writeFileSync(join(bundle, name), body);
    }

    const lock = this.state.locks.get(intent.target.id);
    const meta = {
      adapter: "docker",
      artifacts: Object.fromEntries(
        Object.entries(artifacts).map(([name, body]) => [name, sha256(body)]),
      ),
      capturedAt: startedAt.toISOString(),
      captureFinished: new Date(this.clock.now()).toISOString(),
      captureStarted: startedAt.toISOString(),
      command:
        `docker logs --timestamps ${appId}; docker top ${appId}; ` +
        `docker exec ${appId} cat /proc/net/tcp /proc/net/tcp6; docker inspect ${appId}`,
      container: appId,
      host: intent.target.id,
      incident,
      lockHolder: lock?.holder ?? null,
      lockId: lock ? `${lock.targetId}@${lock.until}#${lock.holder}` : null,
      lockUntil: lock ? new Date(lock.until).toISOString() : null,
    };
    writeFileSync(join(bundle, "meta.json"), canonicalJson(meta));

    const names = readdirSync(bundle)
      .filter((name) => name !== "hashes.txt" && name !== "anchor.sha256")
      .sort();
    const hashes = names
      .map((name) => `${sha256(readFileSync(join(bundle, name)))}  ${name}`)
      .join("\n");
    const hashesBody = `${hashes}\n`;
    writeFileSync(join(bundle, "hashes.txt"), hashesBody);
    const anchor = sha256(hashesBody);
    writeFileSync(join(bundle, "anchor.sha256"), `${anchor}\n`);

    return { bundle, anchor };
  }
}
