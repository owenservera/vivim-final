// src/engines/pool/lease.ts
// Lease — represents a checked-out browser from the pool.
// Phase 4: Lease lifecycle managed by Domain Layer.

import type { AccountId, LeaseId, ProviderId, SlaveId } from '../../domain/types.js'
import { createLeaseId } from '../../domain/types.js'

export interface LeaseOptions {
  ttlMs?: number
  maxRenewals?: number
}

export class Lease {
  public readonly id: LeaseId
  public readonly slaveId: SlaveId
  public readonly providerId: ProviderId
  public readonly accountId: AccountId
  public readonly acquiredAt: number
  public readonly expiresAt: number
  public healthy: boolean
  private renewals = 0
  private maxRenewals: number

  constructor(
    slaveId: SlaveId,
    providerId: ProviderId,
    accountId: AccountId,
    options?: LeaseOptions,
  ) {
    this.id = createLeaseId(`lease:${slaveId}:${Date.now()}`)
    this.slaveId = slaveId
    this.providerId = providerId
    this.accountId = accountId
    this.acquiredAt = Date.now()
    this.expiresAt = this.acquiredAt + (options?.ttlMs ?? 300_000) // 5 min default
    this.healthy = true
    this.maxRenewals = options?.maxRenewals ?? 3
  }

  /**
   * Check if the lease has expired.
   */
  isExpired(): boolean {
    return Date.now() > this.expiresAt
  }

  /**
   * Renew the lease (extend TTL).
   */
  renew(ttlMs?: number): boolean {
    if (this.renewals >= this.maxRenewals) return false
    this.renewals++
    const ttl = ttlMs ?? 300_000
    ;(this as { expiresAt: number }).expiresAt = Date.now() + ttl
    return true
  }

  /**
   * Mark the lease as unhealthy (triggers recycling on release).
   */
  markUnhealthy(): void {
    this.healthy = false
  }

  /**
   * Get remaining time in milliseconds.
   */
  remainingMs(): number {
    return Math.max(0, this.expiresAt - Date.now())
  }
}
