# Investigation Report: Core Files (config.ts, errors.ts, ids.ts, index.ts)

## Area Overview
- **Files Scanned**: `src/config.ts` (494 lines), `src/errors.ts` (365 lines), `src/ids.ts` (51 lines), `src/index.ts` (459 lines)
- **Priority**: HIGH — Foundation layer, imported by everything

---

## Finding 1: P0 — `config.ts` Hardcoded Default Secret

**Location**: `src/config.ts:432`

```typescript
export function getConfirmationSecret(): string {
  return process.env.VIVIM_CONFIRMATION_SECRET ?? 'dev-insecure-do-not-use-in-prod'
}
```

**Issue**: The fallback secret `'dev-insecure-do-not-use-in-prod'` is used in production when `VIVIM_CONFIRMATION_SECRET` is not set. This is a security vulnerability — any attacker can forge NLCL confirmation tokens.

**Resolution**:
1. Make `getConfirmationSecret()` throw an error if the env var is not set (non-dev environments)
2. Add a startup check that validates the secret is set and is not the default
3. Add a comment documenting the required env var in `.env.example`

---

## Finding 2: P1 — `config.ts` Missing Validation for Numeric Env Vars

**Location**: `src/config.ts:260-396`

Multiple `Number.parseInt()` calls on env vars with no NaN guard:
```typescript
port: Number.parseInt(process.env.CAP_STORE_PORT ?? '9420', 10),
fleetPortRangeStart: Number.parseInt(process.env.CAP_STORE_FLEET_PORT_START ?? '9222', 10),
// ... 15+ similar lines
```

**Issue**: If an env var is set to a non-numeric string (e.g. `CAP_STORE_PORT=abc`), `Number.parseInt` returns `NaN` which silently propagates through the system.

**Resolution**:
1. Create a `requirePositiveInt(envVar: string, fallback: number): number` helper
2. Replace all `Number.parseInt(...)` calls with the validated helper
3. Log a warning when env var is set but invalid

---

## Finding 3: P1 — `ids.ts` Fallback Hash Not Cryptographically Secure

**Location**: `src/ids.ts:44-49`

```typescript
} catch {
  let h = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `fnv1a:${(h >>> 0).toString(16)}`
}
```

**Issue**: FNV-1a is not collision-resistant. Two different inputs can produce the same hash. The function is named `hashContent` and documented as "Stable SHA-256 of canonicalized content" but falls back to a non-cryptographic hash. This could cause silent data corruption in the universal Node layer.

**Resolution**:
1. Throw an error instead of falling back to FNV-1a
2. Or, document that the fallback is intentionally non-cryptographic and rename the function
3. Add unit tests for collision detection

---

## Finding 4: P2 — `index.ts` Barrel Exports Include Implementation Details

**Location**: `src/index.ts:446-459`

```typescript
export { AgenticStoreImpl } from './storage/impl/agentic-store-impl.js'
export { AlertStoreImpl } from './storage/impl/alert-store-impl.js'
// ... 15+ store implementations
```

**Issue**: The public barrel exports expose implementation classes (`*Impl`) which should only be used internally. This creates a contract surface that's hard to maintain.

**Resolution**:
1. Create a `src/internal.ts` barrel for internal/impl exports
2. Remove `*Impl` exports from `src/index.ts`
3. Verify no external consumers depend on these

---

## Finding 5: P2 — `config.ts` Side Effects at Import Time

**Location**: `src/config.ts:411-416`

```typescript
try {
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.profileBaseDir, { recursive: true })
} catch (e) {
  catchDebug(e, 'config: profileBaseDir creation failed')
}
```

**Issue**: Importing `config.ts` creates directories on disk as a side effect. This violates the principle of least surprise and makes testing harder.

**Resolution**:
1. Move directory creation to an explicit `ensureConfigDirs()` function
2. Call it during boot, not at import time
3. Export the function for test cleanup

---

## Finding 6: P3 — `errors.ts` Missing Error Cause Chain

**Location**: `src/errors.ts:4-18`

```typescript
export class CapStoreError extends Error {
  public readonly code: string
  public readonly details?: unknown
  constructor(code: string, message: string, details?: unknown) {
    super(message)
    // ...
  }
}
```

**Issue**: The error hierarchy doesn't support the `cause` property (ES2022 standard). Many catch blocks lose error context when wrapping errors.

**Resolution**:
1. Add an optional `cause` parameter to `CapStoreError`
2. Update error constructors in child classes to accept and pass `cause`
3. Refactor catch blocks to preserve error chains

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| Hardcoded default secret | P0 | Low | Security |
| Missing NaN validation | P1 | Low | Reliability |
| FNV-1a fallback hash | P1 | Low | Data integrity |
| Impl exports in barrel | P2 | Medium | API surface |
| Side effects at import | P2 | Low | Testability |
| Missing error cause chain | P3 | Medium | Debuggability |

**Estimated Total Effort**: 2-3 days for P0-P1 items
