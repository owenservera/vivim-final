# Error Handling

## Error Hierarchy (src/errors.ts)
All errors extend `CapStoreError` with structured codes:

```typescript
class CapStoreError extends Error {
  code: string
  details?: unknown
  toJSON(): { error, code, details }
}
```

## Error Categories

### Core Errors
- `ValidationError` — Zod/input validation failed
- `NotFoundError` — Entity not found
- `ConflictError` — State conflict

### Governor Errors
- `SlaveNotRunningError(slaveId)` — Slave not running
- `SlaveBusyError(slaveId)` — Slave in use
- `CdpTimeoutError(method)` — CDP timeout
- `CircuitOpenError(slaveId)` — Circuit breaker open
- `ChromeNotFoundError()` — Chrome binary missing
- `PortOccupiedError(range)` — No available ports

### Capability Errors
- `CapabilityNotFoundError(slug)` — No capability registered
- `IntentDecompositionError(message)` — NL parsing failed

### Sandbox Errors
- `SandboxTimeoutError(handlerSlug, budgetMs)` — Handler timeout
- `SandboxBudgetError(slug, kind, used, budget)` — Resource exceeded

### Execution Errors
- `BudgetExceededError(budget, used, limit)` — Cost/tokens exceeded
- `HitlGateExpiredError(gateId)` — Approval gate expired
- `HitlGateDeniedError(gateId, by)` — Approval denied

## Handling Pattern
```typescript
try {
  await capability.execute(params)
} catch (err) {
  if (err instanceof CapStoreError) {
    log.error({ code: err.code, details: err.details })
  }
  throw err
}
```