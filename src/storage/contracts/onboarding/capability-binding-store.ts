// src/storage/contracts/onboarding/capability-binding-store.ts
// Narrow contract surface for the existing CapabilityBinding table, scoped to
// just the operations the onboarding pipeline's test gate uses.
// The full CapabilityBinding table is owned by capability-binding-store.ts;
// this is an additive contract for the onboarding-specific operations
// (create + appendPromotionHistory + setStatus) so the test gate doesn't need
// to import the full store.
//
// SOTA-AUDIT-V2 §2.2 Gap O-3: the contract previously had no `create`
// operation. The orchestrator called `gate.run(...)` per entity, but the gate
// only called `appendPromotionHistory` + `setStatus` — both no-ops on a
// non-existent row. Net result: no CapabilityBinding rows were ever created
// during onboarding, so downstream CapabilityResolutionEngine had nothing to
// resolve. Adding `create` closes that.

export interface CapabilityBindingCreateInput {
  /** Stable binding id (primary key). ULID. */
  id: string
  /** CapabilityTaxonomy.id (FK) — the canonical capability this binding realizes. */
  globalId: string
  providerId: string
  status: 'active' | 'prospect' | 'rejected'
  confidence: number
}

export interface CapabilityBindingStoreContract {
  /**
   * Create a new CapabilityBinding row. Idempotent on `(globalId, providerId)`
   * — if a binding with that pair already exists, the call is a no-op.
   */
  create(input: CapabilityBindingCreateInput): Promise<void>
  appendPromotionHistory(
    providerId: string,
    capabilityId: string,
    entries: Array<{ stage: string; timestamp: string; passed: boolean }>,
  ): Promise<void>
  setStatus(
    providerId: string,
    capabilityId: string,
    status: 'active' | 'prospect' | 'rejected',
    confidence: number,
  ): Promise<void>
}
