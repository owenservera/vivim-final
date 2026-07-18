// src/engines/consent-engine.ts
// ConsentEngine — runtime consent gate for operation classification enforcement.
// Checks whether an operation's classification exceeds the allowed threshold
// and gates execution accordingly. Grants are time-bounded.
//
// Store contract: src/storage/contracts/consent-store.ts

import { ConsentViolationError } from '../errors.js'

export interface ConsentConfig {
  /** Default deny all operations that require consent (no blanket permission). */
  defaultDeny: boolean
  /** Highest classification allowed without explicit grant. */
  requireApprovalAbove: 'read' | 'write' | 'navigate' | 'destructive' | 'financial'
}

export interface ConsentGrant {
  target: string
  classification: string
  grantedAt: number
  expiresAt: number
}

export interface ConsentStore {
  saveGrant(grant: ConsentGrant): Promise<void>
  findGrant(target: string, classification: string): Promise<ConsentGrant | null>
  revokeGrant(target: string): Promise<void>
  listGrants(): Promise<ConsentGrant[]>
}

const CLASSIFICATION_RANK: Record<string, number> = {
  read: 0,
  write: 1,
  navigate: 2,
  destructive: 3,
  financial: 4,
  communication: 4,
}

export class ConsentEngine {
  private grants: Map<string, ConsentGrant> = new Map()

  constructor(
    private config: Partial<ConsentConfig> = {},
    private store?: ConsentStore,
  ) {
    this.config = {
      defaultDeny: true,
      requireApprovalAbove: 'write',
      ...config,
    }
  }

  /** Check whether an operation is allowed. */
  async check(operation: { classification: string; target: string }): Promise<boolean> {
    const rank = CLASSIFICATION_RANK[operation.classification] ?? 0
    const threshold = CLASSIFICATION_RANK[this.config.requireApprovalAbove ?? 'write'] ?? 1

    // Operations at or below threshold are always allowed
    if (rank <= threshold) return true

    // Check for an explicit grant
    const grantKey = `${operation.target}:${operation.classification}`
    const grant = this.grants.get(grantKey)

    if (grant && grant.expiresAt > Date.now()) return true

    // Expired grant — clean up
    if (grant) this.grants.delete(grantKey)

    // Try store-backed grant
    if (this.store) {
      const stored = await this.store.findGrant(operation.target, operation.classification)
      if (stored && stored.expiresAt > Date.now()) {
        this.grants.set(grantKey, stored)
        return true
      }
    }

    if (this.config.defaultDeny) return false
    return false
  }

  /** Require consent — throws if not allowed. */
  async require(operation: { classification: string; target: string }): Promise<void> {
    const allowed = await this.check(operation)
    if (!allowed) {
      throw new ConsentViolationError(
        `Operation "${operation.classification}" on "${operation.target}" requires user consent`,
      )
    }
  }

  /** Grant consent for a classification on a target. Duration in ms (default: 1 hour). */
  async grant(
    operation: { classification: string; target: string },
    durationMs = 3_600_000,
  ): Promise<void> {
    const now = Date.now()
    const grantKey = `${operation.target}:${operation.classification}`
    const grant: ConsentGrant = {
      target: operation.target,
      classification: operation.classification,
      grantedAt: now,
      expiresAt: now + durationMs,
    }
    this.grants.set(grantKey, grant)

    if (this.store) {
      await this.store.saveGrant(grant)
    }
  }

  /** Revoke all consent for a target. */
  async revoke(target: string): Promise<void> {
    for (const [key, grant] of this.grants) {
      if (grant.target === target) this.grants.delete(key)
    }
    if (this.store) {
      await this.store.revokeGrant(target)
    }
  }

  /** Check whether a classification requires consent. */
  isRestricted(classification: string): boolean {
    const rank = CLASSIFICATION_RANK[classification] ?? 0
    const threshold = CLASSIFICATION_RANK[this.config.requireApprovalAbove ?? 'write'] ?? 1
    return rank > threshold
  }

  /** List all active grants. */
  listActiveGrants(): ConsentGrant[] {
    const now = Date.now()
    return [...this.grants.values()].filter((g) => g.expiresAt > now)
  }
}
