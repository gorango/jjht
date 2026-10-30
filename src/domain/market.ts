/**
 * A tiny lease market.
 *
 * Work is claimed, not assigned: a worker shifts an id off a queue, then takes a
 * lease that carries a generation. Every write back into shared state is checked
 * against that generation, so a slow or stale worker cannot overwrite the result
 * of the worker that replaced it. This is the same discipline baro uses for its
 * story leases, shrunk to fit in a hackathon.
 */

export interface Lease {
  owner: string;
  generation: number;
  claimedAt: number;
  expiresAt: number;
}

export interface ClaimResult {
  generation: number;
  expiresAt: number;
}

export class MemoryMarket {
  private readonly leases = new Map<string, Lease>();
  private generation = 0;

  claim(key: string, owner: string, ttlMs: number): ClaimResult | undefined {
    const now = Date.now();
    const existing = this.leases.get(key);
    if (existing && existing.expiresAt > now && existing.owner !== owner) {
      return undefined;
    }

    this.generation += 1;
    const lease: Lease = {
      owner,
      generation: this.generation,
      claimedAt: now,
      expiresAt: now + ttlMs,
    };
    this.leases.set(key, lease);
    return { generation: lease.generation, expiresAt: lease.expiresAt };
  }

  /** A worker may only publish a result if it still holds the current generation. */
  isCurrent(key: string, generation: number): boolean {
    const lease = this.leases.get(key);
    return Boolean(lease && lease.generation === generation);
  }

  release(key: string, generation: number): boolean {
    if (!this.isCurrent(key, generation)) return false;
    this.leases.delete(key);
    return true;
  }

  ownerOf(key: string): string | undefined {
    return this.leases.get(key)?.owner;
  }

  size(): number {
    return this.leases.size;
  }
}
