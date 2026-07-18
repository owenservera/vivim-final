# Store Contract: ConsentStore

**Feature**: 001-production-hardening  
**Source**: `src/engines/consent-engine.ts:23-28`

## Interface

```typescript
export interface ConsentStore {
  /** Persist a consent grant. */
  saveGrant(grant: ConsentGrant): Promise<void>

  /** Find an active (non-expired) grant by target and classification. */
  findGrant(target: string, classification: string): Promise<ConsentGrant | null>

  /** Remove all grants for a target. */
  revokeGrant(target: string): Promise<void>

  /** List all grants (for audit/debug). */
  listGrants(): Promise<ConsentGrant[]>
}
```

## Type: ConsentGrant

```typescript
export interface ConsentGrant {
  target: string         // entity the consent applies to
  classification: string // operation classifier
  grantedAt: number      // Unix ms timestamp
  expiresAt: number      // Unix ms timestamp
}
```

## Implementation Status

- **Contract**: Defined inline in `consent-engine.ts` (not yet in `src/storage/contracts/`)
- **In-memory impl**: `ConsentEngine` uses internal `Map<string, ConsentGrant>`
- **DB impl**: Not yet implemented — `ConsentEngine` constructor accepts optional `ConsentStore`

## Integration Points

- Used by `ConsentEngine.check()` to look up existing grants
- Used by `ConsentEngine.revoke()` to clear grants
- Used by `capability-bootstrap.ts` consent gate wrapping (lines 1273-1275)
