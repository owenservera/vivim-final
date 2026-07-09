# Unit 4.27: Survivor — src/errors.ts (port/verify)

**Phase:** 4 | **File:** `src/errors.ts` (survive as-is)
**Depends:** 1.4 CapStoreDb | **Produces:** Verified error class exports used by all engines
**Source:** `01-merged-epic.md` §Survivor Components, `07-merged-api.md` §Error Mapping Table

## Purpose

Ported survivor. `src/errors.ts` defines custom error classes consumed by all engines and the HTTP error mapping. This unit verifies the file exists, exports the correct error classes, and that every engine import resolves. No logic changes — copy from current codebase.

## Required Error Classes

```typescript
// Must export these (matching 07-merged-api.md error mapping):
class ValidationError extends Error { code: string; }
class AuthRequired extends Error { code: string; }
class NotFoundError extends Error { code: string; }
class ConflictError extends Error { code: string; }
class SlaveNotRunningError extends Error { slaveId: string; }
class SlaveBusyError extends Error { slaveId: string; }
class CdpTimeoutError extends Error { method: string; timeoutMs: number; }
class CircuitOpenError extends Error { slaveId: string; }
class CdpConnectionError extends Error { slaveId: string; }
class ChromeNotFoundError extends Error {}
class PortOccupiedError extends Error { port: number; }
```

## Tests
- [ ] File exists at `src/errors.ts`
- [ ] All 11 error classes are exported
- [ ] Each class extends `Error`
- [ ] Each class has the required properties listed above
- [ ] `import { SlaveNotRunningError } from '@/errors.js'` resolves in a typecheck

## Gate
- `bunx tsc --noEmit` passes with all error imports
- No engine references undefined error classes
