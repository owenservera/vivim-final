/**
 * VIVIM AI Gateway — In-Memory Resource Manager
 * @module ai/runtime/in-memory-resource-manager
 *
 * Tracks resource leases per provider. acquire() returns undefined (never throws)
 * when a request cannot currently be satisfied. Used by both IResourceManager
 * (lease authority) and IResourceMonitor (read-only view for the Router).
 */

import type { ProviderId } from '../core/types.js'
import type {
  IResourceManager,
  IResourceMonitor,
  ResourceKind,
  ResourceLease,
  ResourceLeaseId,
  ResourceRequest,
  ResourceSnapshot,
} from './resources.js'
import { resourceLeaseId } from './resources.js'

const DEFAULT_CAPACITIES: Readonly<Record<ResourceKind, number>> = {
  'ram-mb': 8192,
  'vram-mb': 0, // no GPU by default
  'cpu-cores': 8,
  'disk-bytes': 10 * 1024 * 1024 * 1024, // 10 GB
  'gpu-device': 0,
  'concurrent-slot': 4,
}

export class InMemoryResourceManager implements IResourceManager, IResourceMonitor {
  private readonly capacities = new Map<ResourceKind, number>()
  private readonly allocated = new Map<ResourceKind, number>()
  private readonly leases = new Map<ResourceLeaseId, ResourceLease>()

  constructor(capacities?: Partial<Record<ResourceKind, number>>) {
    for (const kind of Object.keys(DEFAULT_CAPACITIES) as ResourceKind[]) {
      this.capacities.set(kind, capacities?.[kind] ?? DEFAULT_CAPACITIES[kind]!)
      this.allocated.set(kind, 0)
    }
  }

  async acquire(request: ResourceRequest): Promise<ResourceLease | undefined> {
    const total = this.capacities.get(request.kind) ?? 0
    const allocated = this.allocated.get(request.kind) ?? 0
    const available = total - allocated

    if (available < request.amount) {
      if (request.strict) {
        return undefined // hard failure
      }
      // Partial allocation: grant what's available (or nothing if 0)
      if (available === 0) return undefined
      const partialAmount = available
      return this.grantLease(request, partialAmount)
    }

    return this.grantLease(request, request.amount)
  }

  private grantLease(request: ResourceRequest, amount: number): ResourceLease {
    const id = resourceLeaseId(crypto.randomUUID())
    const lease: ResourceLease = {
      id,
      providerId: request.providerId,
      kind: request.kind,
      amount,
      acquiredAt: new Date().toISOString(),
    }
    this.leases.set(id, lease)
    this.allocated.set(request.kind, (this.allocated.get(request.kind) ?? 0) + amount)
    return lease
  }

  async release(leaseId: ResourceLeaseId): Promise<void> {
    const lease = this.leases.get(leaseId)
    if (!lease) return
    this.leases.delete(leaseId)
    const current = this.allocated.get(lease.kind) ?? 0
    this.allocated.set(lease.kind, Math.max(0, current - lease.amount))
  }

  async releaseAllForProvider(providerId: ProviderId): Promise<void> {
    for (const [id, lease] of this.leases) {
      if (lease.providerId === providerId) {
        this.leases.delete(id)
        const current = this.allocated.get(lease.kind) ?? 0
        this.allocated.set(lease.kind, Math.max(0, current - lease.amount))
      }
    }
  }

  async snapshot(kind: ResourceKind): Promise<ResourceSnapshot> {
    const total = this.capacities.get(kind) ?? 0
    const allocated = this.allocated.get(kind) ?? 0
    return {
      kind,
      total,
      allocated,
      available: total - allocated,
    }
  }

  async snapshotAll(): Promise<readonly ResourceSnapshot[]> {
    const kinds = Array.from(this.capacities.keys())
    return Promise.all(kinds.map((k) => this.snapshot(k)))
  }
}
