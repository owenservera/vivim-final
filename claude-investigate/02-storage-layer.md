# Investigation Report: Storage Layer (Prisma, Contracts, Implementations)

## Area Overview
- **Files Scanned**: 59 contracts, 71 implementations, `prisma/schema.prisma` (3,897 lines)
- **Priority**: HIGH — Data integrity layer, 196 Prisma models

---

## Finding 1: P0 — Prisma Schema 3,897 Lines (Single File)

**Location**: `prisma/schema.prisma`

**Issue**: The schema contains 196 models in a single 3,891-line file. The file header acknowledges this as a known issue (ADR-014) but it's deferred. This makes:
- Schema changes error-prone (merge conflicts)
- Understanding relationships difficult
- CI/CD schema validation slow

**Resolution**:
1. Split into domain-scoped schema files: `provider.prisma`, `conversation.prisma`, `memory.prisma`, etc.
2. Use Prisma's multi-file schema support (available since v5.1)
3. Keep `schema.prisma` as the entry point that imports all partial schemas
4. Add a comment convention for bounded context (already partially done)

---

## Finding 2: P0 — `db.ts` Loose Type Escape Hatch

**Location**: `src/storage/db.ts:16`

```typescript
export type PrismaLoose = any // eslint-disable-line @typescript-eslint/no-explicit-any
```

**Issue**: This is an intentional escape hatch used by 71 store implementations to bypass Prisma's type system. Every `as any` cast through `db.loose` is a potential runtime error that TypeScript can't catch.

**Resolution**:
1. Create typed model accessors for each model (e.g., `db.providerDef` instead of `db.loose.providerDefinition`)
2. Use Prisma's generated types directly in store contracts
3. Remove `PrismaLoose` and replace with explicit typed getters

---

## Finding 3: P1 — Store Factory Returns Empty Class

**Location**: `src/storage/store-factory.ts:13-35`

```typescript
export class StoreFactory {
  private backend: StoreBackend
  constructor(private opts: StoreFactoryOptions) {
    this.backend = opts.backend
  }
  getBackend(): StoreBackend { return this.backend }
  getDb(): CapStoreDb { return this.opts.db }
  isPostgres(): boolean { return this.backend === 'postgres' }
  isSQLite(): boolean { return this.backend === 'sqlite' }
}
```

**Issue**: The `StoreFactory` class provides no actual factory methods. It only exposes getters. The `StoreBackend` type suggests multi-database support but the codebase is SQLite-only (schema uses `provider = "sqlite"`).

**Resolution**:
1. Either implement actual factory methods or remove the class entirely
2. If multi-database is a future goal, document it explicitly
3. Remove the dead `postgres`/`mysql` types if not planned

---

## Finding 4: P1 — `prisma.ts` Fire-and-Forget WAL Init

**Location**: `src/storage/prisma.ts:73-76`

```typescript
if (!walApplied) {
  initPrismaWal(client).catch(() => {})
}
```

**Issue**: WAL mode initialization is fire-and-forget. If it fails, the first query may run without WAL mode, causing performance degradation or corruption under concurrent access.

**Resolution**:
1. Make `getPrisma()` async and await WAL init
2. Or, apply WAL pragmas directly in `getPrisma()` without delegation
3. Log the error if WAL init fails (currently swallowed)

---

## Finding 5: P1 — Large Store Implementations

**Location**: Multiple files exceeding 15KB:
- `agentic-store-impl.ts` (35.9 KB)
- `memory-intelligence-store-impl.ts` (28.7 KB)
- `provider-store-impl.ts` (21.0 KB)
- `conversation-store-impl.ts` (15.4 KB)

**Issue**: These files are doing too much — they combine multiple concerns (CRUD, complex queries, data transformation). This makes them hard to test and maintain.

**Resolution**:
1. Split large store impls by concern (e.g., `agentic-store-impl/agent.ts`, `agentic-store-impl/policy.ts`)
2. Extract complex query logic into separate query modules
3. Add unit tests for each concern

---

## Finding 6: P2 — `db.ts` Catch-All Error Swallowing

**Location**: `src/storage/db.ts:267`

```typescript
.catch(() => {})
// [audit] log the error with context here
```

**Issue**: The `// [audit]` comment indicates this was flagged but not fixed. Silent error swallowing in database operations can hide critical issues.

**Resolution**:
1. Log the error with context using `getLogger()`
2. Consider if the operation should actually fail
3. Remove the `[audit]` comment after fixing

---

## Finding 7: P2 — `agentic-store-impl.ts` `as never` Cast

**Location**: `src/storage/impl/agentic-store-impl.ts:114`

```typescript
await this.nodes.updateNode(agentId, {
  dataJson: JSON.stringify(data),
  contentHash: undefined,
} as never)
```

**Issue**: The `as never` cast bypasses TypeScript's type checking entirely. This hides potential type mismatches between the update payload and the actual schema.

**Resolution**:
1. Update the `updateNode` method signature to accept partial updates
2. Or create a proper update type that allows `undefined` for optional fields
3. Remove the `as never` cast

---

## Finding 8: P3 — `agentic-store-impl.ts` In-Memory Filtering

**Location**: `src/storage/impl/agentic-store-impl.ts:80-85`

```typescript
async listAgents(opts: { status?: string } = {}): Promise<unknown[]> {
  const rows = await this.nodes.listNodes({ type: 'cap-store.agent' })
  return rows
    .map((r) => parseJson(r.dataJson, null))
    .filter((d: any) => !opts.status || d?.status === opts.status)
}
```

**Issue**: Filtering is done in-memory after loading all records. This doesn't scale and bypasses database indexing.

**Resolution**:
1. Add a `status` filter to `listNodes()` method
2. Or create a specialized query for filtered agent lists
3. Add pagination support

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| 3,897-line schema file | P0 | High | Maintainability |
| Loose type escape hatch | P0 | Medium | Type safety |
| Empty store factory | P1 | Low | Dead code |
| Fire-and-forget WAL init | P1 | Low | Data integrity |
| Large store implementations | P1 | High | Testability |
| Silent error swallowing | P2 | Low | Debuggability |
| `as never` type bypass | P2 | Low | Type safety |
| In-memory filtering | P3 | Medium | Performance |

**Estimated Total Effort**: 5-7 days for P0-P1 items
