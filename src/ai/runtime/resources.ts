/**
 * VIVIM AI Gateway — Resource Management
 * @module ai/runtime/resources
 *
 * v1.0/doc2 modeled this as reserveMemory(mb)/releaseMemory(mb). That's the
 * wrong shape as soon as you have a second resource type (VRAM, a GPU
 * device slot, a concurrent-request slot) — you end up bolting on
 * reserveVram, reserveGpuSlot, etc. one at a time. A generic lease over a
 * typed resource kind scales to all of them without new methods.
 */

import type { ProviderId } from '../core/types.js'

export type ResourceKind =
  | 'ram-mb'
  | 'vram-mb'
  | 'cpu-cores'
  | 'disk-bytes'
  | 'gpu-device'
  | 'concurrent-slot'

export interface ResourceRequest {
  readonly providerId: ProviderId
  readonly kind: ResourceKind
  readonly amount: number
  /** If true, the caller wants a hard failure over degraded/partial allocation. */
  readonly strict?: boolean
}

export type ResourceLeaseId = string & { readonly __brand: 'ResourceLeaseId' }
export const resourceLeaseId = (v: string): ResourceLeaseId => v as ResourceLeaseId

export interface ResourceLease {
  readonly id: ResourceLeaseId
  readonly providerId: ProviderId
  readonly kind: ResourceKind
  readonly amount: number
  readonly acquiredAt: string
}

export interface ResourceSnapshot {
  readonly kind: ResourceKind
  readonly total: number
  readonly allocated: number
  readonly available: number
}

export interface IResourceManager {
  /** Returns undefined (never throws for a plain capacity miss) when the request cannot currently be satisfied. */
  acquire(request: ResourceRequest): Promise<ResourceLease | undefined>
  release(leaseId: ResourceLeaseId): Promise<void>
  releaseAllForProvider(providerId: ProviderId): Promise<void>
}

/** Read-only view used by the Router for resource-aware candidate scoring, without granting it lease authority. */
export interface IResourceMonitor {
  snapshot(kind: ResourceKind): Promise<ResourceSnapshot>
  snapshotAll(): Promise<readonly ResourceSnapshot[]>
}
