# Task 06 — Add `/api/storage/health` endpoint

**Phase**: C (New value)
**Depends on**: Task 05
**Effort**: 1 hr
**Files touched**:
- `frontend/src/app/api/storage/health/route.ts` (new)

## Context

There is currently no way to ask the running app "what storage impl is each store using, and how much data is in each?". This task adds a single HTTP endpoint that answers that question. It's useful for:
- Debugging "where did my data go?" (memory vs prisma).
- Verifying migration progress (after Task 09, `onboardingStore` reports `prisma` while others still report `memory`-or-`NotImplemented`).
- The Tauri Rust supervisor could poll this endpoint as a readiness check.

## Goal

1. Add `GET /api/storage/health` that returns a JSON report.
2. The report includes: provider name, per-store impl name + ready flag + row count, and a migration progress summary.
3. The endpoint must NOT crash if a store throws (e.g., `PrismaStorageProvider`'s `NotImplementedErrorProxy`).

## Spec

### Part 1: Add a `health()` method to `StorageProvider`?

**Decision**: No. Keep `StorageProvider` pure — it's a contract for storage access, not introspection. The health endpoint uses runtime introspection (instanceof checks + duck-typing) instead.

This means the health endpoint has to know about the impl classes. We accept that coupling because:
- The endpoint is debug-only, not part of the storage abstraction.
- Adding `health()` to the interface would force every impl (including future `TestStorageProvider`) to implement it.

### Part 2: Implement the endpoint

Create `frontend/src/app/api/storage/health/route.ts` using `templates/storage-health-route.ts.template`:

```ts
// app/api/storage/health/route.ts
import { NextResponse } from 'next/server';
import { getStorageProvider } from '@/storage/provider';
import type { StorageProvider } from '@/storage/provider';

export const dynamic = 'force-dynamic';

interface StoreHealth {
  impl: string;
  ready: boolean;
  count: number | null;
  error?: string;
}

interface StorageHealthReport {
  ok: boolean;
  provider: 'memory' | 'prisma' | 'test';
  stores: Record<string, StoreHealth>;
  migrationProgress: { migrated: number; total: number; pct: number };
  generatedAt: string;
}

/** List of store names to probe — must match the StorageProvider interface. */
const STORE_NAMES = [
  'uiComponentStore', 'providerTypeStore', 'primitiveStore', 'providerStore',
  'accountStore', 'capabilityTierStore', 'userLayoutStore', 'canvasDefinitionStore',
  'workspaceStore', 'documentStore', 'mediaStore', 'automationStore',
  'agentStore', 'hitlGateStore', 'policyRuleStore', 'annotationStore',
  'shellCommandStore',
  'notificationStore', 'auditStore', 'rbacStore', 'templateStore',
  'presenceStore', 'searchIndex', 'onboardingStore',
  'documentEditStore', 'zLayerStore', 'drawerStore',
] as const;

function implName(store: unknown): string {
  if (store === null || store === undefined) return 'null';
  const ctor = (store as { constructor?: { name?: string } }).constructor;
  return ctor?.name ?? 'unknown';
}

async function probeStore(store: unknown): Promise<StoreHealth> {
  // Detect NotImplementedErrorProxy (from PrismaStorageProvider stubs)
  if (store && typeof store === 'object' && '__notImplemented' in store) {
    return {
      impl: 'NotImplementedErrorProxy',
      ready: false,
      count: null,
      error: (store as { __message?: string }).__message ?? 'not implemented',
    };
  }

  // Try to get a count. We duck-type: if the store has a `list()` or `stats()` method, call it.
  // If it has neither, count is null (we can't introspect without coupling to the contract).
  try {
    const s = store as Record<string, unknown>;
    if (typeof s.list === 'function') {
      // Most stores: call list() with no filter, count the result.
      const result = await (s.list as (filter?: unknown) => Promise<unknown[]>)(undefined);
      const count = Array.isArray(result) ? result.length : null;
      return { impl: implName(store), ready: true, count };
    }
    if (typeof s.stats === 'function') {
      // NotificationStore, AuditStore: call stats(), extract a count field if present.
      const result = await (s.stats as (userId?: string) => Promise<Record<string, unknown>>)('user:demo');
      const count = typeof result.total === 'number' ? result.total : null;
      return { impl: implName(store), ready: true, count };
    }
    if (typeof s.get === 'function' && typeof s.set === 'function') {
      // UserLayoutStore, ZLayerStore, DrawerStore: these are key-value; we can't easily count.
      return { impl: implName(store), ready: true, count: null };
    }
    return { impl: implName(store), ready: true, count: null };
  } catch (err) {
    return {
      impl: implName(store),
      ready: false,
      count: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  try {
    const provider = getStorageProvider();
    const stores: Record<string, StoreHealth> = {};

    for (const name of STORE_NAMES) {
      const store = (provider as unknown as Record<string, unknown>)[name];
      stores[name] = await probeStore(store);
    }

    const migrated = Object.values(stores).filter(
      (s) => s.impl !== 'NotImplementedErrorProxy' && s.impl !== 'null' && s.ready
    ).length;
    const total = STORE_NAMES.length;

    const report: StorageHealthReport = {
      ok: true,
      provider: provider.name,
      stores,
      migrationProgress: {
        migrated,
        total,
        pct: Number(((migrated / total) * 100).toFixed(2)),
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
```

### Part 3: Verify

Run `bun run dev`, then:

```bash
curl localhost:3000/api/storage/health | jq .
```

Expected output (with `VIVIM_STORAGE_PROVIDER=memory`):

```json
{
  "ok": true,
  "provider": "memory",
  "stores": {
    "uiComponentStore": { "impl": "MemoryUiComponentStore", "ready": true, "count": 0 },
    "onboardingStore": { "impl": "MemoryOnboardingStore", "ready": true, "count": 0 },
    ...
  },
  "migrationProgress": { "migrated": 24, "total": 24, "pct": 100 },
  "generatedAt": "2026-08-03T..."
}
```

After Task 09 (with `VIVIM_STORAGE_PROVIDER=prisma`):

```json
{
  "ok": true,
  "provider": "prisma",
  "stores": {
    "onboardingStore": { "impl": "PrismaOnboardingStore", "ready": true, "count": 3 },
    "providerStore":   { "impl": "NotImplementedErrorProxy", "ready": false, "count": null, "error": "PrismaProviderStore not implemented. See ROADMAP.md." },
    ...
  },
  "migrationProgress": { "migrated": 1, "total": 24, "pct": 4.17 },
  "generatedAt": "..."
}
```

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/app/api/storage/health/route.ts` | new |

## Verification

1. `bun run tsc --noEmit` — passes.
2. `bun run dev` boots.
3. `curl localhost:3000/api/storage/health` returns 200 with the expected shape.
4. Setting `VIVIM_STORAGE_PROVIDER=prisma` (after Task 08) and restarting → endpoint still returns 200, but most stores report `ready: false` with `impl: "NotImplementedErrorProxy"`.
5. The endpoint does NOT crash if a store's `list()` throws (verified by temporarily setting `VIVIM_STORAGE_PROVIDER=prisma` before Task 09 and confirming the endpoint returns 200 with error messages per store).

## Templates

- `templates/storage-health-route.ts.template`

## Common pitfalls

- **Calling `list()` with the wrong signature**: some stores take a `userId` first arg, others take a filter object. The duck-type in `probeStore` calls `list(undefined)` and hopes for the best. If a store throws, the `try/catch` catches it and reports `ready: false`. That's acceptable for a health endpoint.
- **Coupling to `NotImplementedErrorProxy`**: the `__notImplemented` check is a duck-type, not an `instanceof`. This is intentional — it lets us detect the proxy without importing the class (which would create a circular dep).
- **Performance**: probing 24 stores sequentially is fine for a debug endpoint. If it ever becomes a hot path, parallelize with `Promise.all`.
