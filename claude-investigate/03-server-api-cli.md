# Investigation Report: Server/API Routes & CLI Entry Points

## Area Overview
- **Files Scanned**: 46 server files, 29 routers, 9 CLI files
- **Priority**: HIGH — HTTP surface, user-facing API

---

## Finding 1: P1 — `response.ts` CORS Wildcard Origin

**Location**: `src/server/response.ts:64`

```typescript
'Access-Control-Allow-Origin': '*',
```

**Issue**: The CORS policy allows all origins. While this is acceptable for local development, it's a security risk in production. The config has `corsOrigin` defined but it's not used here.

**Resolution**:
1. Read allowed origins from `config.corsOrigin`
2. Check the request's `Origin` header against the allowlist
3. Return the matching origin or omit the header for unknown origins
4. Add a production-mode guard that rejects requests without a valid Origin

---

## Finding 2: P1 — `response.ts` Cache Sweep Timer Leak

**Location**: `src/server/response.ts:38-50`

```typescript
function startCacheSweep(): void {
  if (sweepStarted) return
  sweepStarted = true
  setInterval(() => {
    // ...
  }, SWEEP_INTERVAL_MS).unref()
}
startCacheSweep()
```

**Issue**: The sweep timer is started at module load time and runs forever. The `sweepStarted` flag prevents multiple timers, but there's no way to stop it for testing or graceful shutdown.

**Resolution**:
1. Export a `stopCacheSweep()` function
2. Call it during server shutdown
3. Make the timer lazy (start on first cache use, not module load)

---

## Finding 3: P1 — `plugin-router.ts` Excessive Size (24 KB)

**Location**: `src/server/plugin-router.ts` (24 KB)

**Issue**: This is the largest router at 24 KB. It likely contains multiple concerns that should be split.

**Resolution**:
1. Analyze the file and split by concern (plugin CRUD, plugin build, plugin runtime)
2. Move each concern to a separate route module
3. Add unit tests for each route

---

## Finding 4: P1 — `conversation-router.ts` Large Size (16.4 KB)

**Location**: `src/server/conversation-router.ts` (16.4 KB)

**Issue**: This router handles conversation CRUD, message sending, streaming, and history sync. It's doing too much.

**Resolution**:
1. Split into `conversation-crud.ts` and `conversation-send.ts`
2. Extract streaming logic to `conversation-stream.ts`
3. Add request/response type definitions

---

## Finding 5: P2 — `cli/index.ts` Global Mutable State

**Location**: `src/cli/index.ts:15-21`

```typescript
const registry = new CommandRegistry()
const formatter = new OutputFormatter()
export let capabilityRegistry: UnifiedCapabilityRegistry | null = null
```

**Issue**: Global mutable state makes testing difficult and creates hidden dependencies.

**Resolution**:
1. Pass dependencies explicitly to functions
2. Create a `CLIContext` type that holds all dependencies
3. Remove the `export let` pattern

---

## Finding 6: P2 — `cli/index.ts` Audit-Commented Code

**Location**: `src/cli/index.ts:79-112`

Multiple `// [audit] removed: console.log(...)` lines.

**Issue**: The audit comments indicate console output was removed but the code structure remains. This dead code is confusing.

**Resolution**:
1. Remove the commented-out lines entirely
2. If logging is needed, use the structured logger
3. Clean up the audit comments

---

## Finding 7: P3 — `validate.ts` No Body Size Limit

**Location**: `src/server/validate.ts:39`

```typescript
raw = await req.json()
```

**Issue**: `req.json()` reads the entire request body into memory. Without a size limit, a malicious client can send a multi-GB body and crash the server.

**Resolution**:
1. Read the body as a stream first
2. Check the Content-Length header against a configurable limit
3. Reject requests exceeding the limit with 413 Payload Too Large

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| CORS wildcard origin | P1 | Medium | Security |
| Cache sweep timer leak | P1 | Low | Resource mgmt |
| plugin-router.ts 24KB | P1 | High | Maintainability |
| conversation-router.ts 16KB | P1 | Medium | Maintainability |
| Global mutable CLI state | P2 | Low | Testability |
| Audit-commented dead code | P2 | Low | Code quality |
| No body size limit | P3 | Low | Security |

**Estimated Total Effort**: 3-4 days for P0-P1 items
