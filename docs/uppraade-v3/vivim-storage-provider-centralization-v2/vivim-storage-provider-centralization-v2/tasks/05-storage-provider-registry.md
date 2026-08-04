# Task 05 — Implement `getStorageProvider()` singleton

**Phase**: B (Wire it in)
**Depends on**: Task 02
**Effort**: 30 min
**Files touched**:
- `frontend/src/storage/provider/index.ts` (replace stub from Task 03 with real impl)
- `.env.example` (document `VIVIM_STORAGE_PROVIDER`)

## Context

Task 03 added a temporary stub `getStorageProvider()` that always returns `MemoryStorageProvider`. This task replaces it with the real env-driven singleton that selects between `memory`, `prisma`, and `test` impls based on `VIVIM_STORAGE_PROVIDER`.

## Goal

1. Implement `getStorageProvider()` with env-driven selection.
2. Memoize at module level (process singleton).
3. Document the env var in `.env.example`.
4. Throw a clear error for unknown values.

## Spec

### Part 1: Replace the stub

Update `frontend/src/storage/provider/index.ts`. Use `templates/storage-provider-registry.ts.template`:

```ts
// storage/provider/index.ts
export * from './storage-provider';
export * from './memory-storage-provider';
export * from './prisma-storage-provider';  // added in Task 08; for now, comment out

import { MemoryStorageProvider } from './memory-storage-provider';
// import { PrismaStorageProvider } from './prisma-storage-provider';  // Task 08
import type { StorageProvider } from './storage-provider';

let _provider: StorageProvider | null = null;

/**
 * Process-singleton accessor for the storage layer.
 *
 * Impl is selected by `VIVIM_STORAGE_PROVIDER` env var:
 *  - 'memory' (default) — in-memory stores, lost on restart
 *  - 'prisma'            — Prisma-backed stores (see PrismaStorageProvider for migration status)
 *  - 'test'              — reserved for a future deterministic-seed provider
 *
 * Calling this multiple times returns the same instance.
 */
export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;

  const name = (process.env.VIVIM_STORAGE_PROVIDER ?? 'memory').toLowerCase();

  switch (name) {
    case 'memory':
      _provider = new MemoryStorageProvider();
      break;
    // case 'prisma':
    //   _provider = new PrismaStorageProvider();
    //   break;
    case 'prisma':
      throw new Error(
        'VIVIM_STORAGE_PROVIDER=prisma is not available yet. ' +
        'Implement PrismaStorageProvider (see tasks/08-prisma-provider-stub.md).'
      );
    case 'test':
      throw new Error(
        'VIVIM_STORAGE_PROVIDER=test is reserved for a future deterministic-seed provider. ' +
        'Use "memory" for now.'
      );
    default:
      throw new Error(
        `Unknown VIVIM_STORAGE_PROVIDER: "${name}". Valid values: memory, prisma, test.`
      );
  }

  return _provider;
}

/** Test-only: reset the singleton. Used by unit tests to get a fresh provider. */
export function __resetStorageProviderForTests(): void {
  _provider = null;
}
```

**After Task 08** (which creates `PrismaStorageProvider`), uncomment the `case 'prisma'` branch and remove the throw.

### Part 2: Document the env var

Append to `.env.example` (the root one — `frontend/.env.example` if separate; check both):

```bash
# ─── Storage provider ────────────────────────────────────────────────
# Which StorageProvider impl to use.
#  - memory (default): in-memory stores, lost on restart. Use for dev.
#  - prisma:           Prisma-backed stores. Requires DATABASE_URL.
#                      Migration in progress — see ROADMAP.md for status.
#  - test:             reserved for future deterministic-seed provider.
VIVIM_STORAGE_PROVIDER=memory
```

If `frontend/.env.example` doesn't exist, create it with just this block (and a comment pointing to the root `.env.example` for the rest).

### Part 3: Verify the singleton invariant

Run this snippet (paste into a temp file):

```ts
import { getStorageProvider, __resetStorageProviderForTests } from './src/storage/provider';

__resetStorageProviderForTests();
const a = getStorageProvider();
const b = getStorageProvider();
console.assert(a === b, 'singleton broken');
console.log('OK, name =', a.name);

// Test env-var selection:
process.env.VIVIM_STORAGE_PROVIDER = 'memory';
__resetStorageProviderForTests();
console.assert(getStorageProvider().name === 'memory');

// process.env.VIVIM_STORAGE_PROVIDER = 'prisma';
// __resetStorageProviderForTests();
// try { getStorageProvider(); console.error('should have thrown'); } catch (e) { console.log('OK throws:', (e as Error).message); }

process.env.VIVIM_STORAGE_PROVIDER = 'bogus';
__resetStorageProviderForTests();
try { getStorageProvider(); console.error('should have thrown'); } catch (e) { console.log('OK throws:', (e as Error).message); }
```

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/provider/index.ts` | modified (replace stub) |
| `.env.example` (root) and/or `frontend/.env.example` | modified (add `VIVIM_STORAGE_PROVIDER`) |

## Verification

1. `bun run tsc --noEmit` — passes.
2. The smoke test above prints `OK, name = memory` and `OK throws: ...` for `bogus`.
3. `VIVIM_STORAGE_PROVIDER=prisma bun run dev` — fails fast with the clear error message (until Task 08).
4. `grep -n "VIVIM_STORAGE_PROVIDER" .env.example` — one match.
5. `bun run dev` (no env var) — boots fine, uses `memory`.

## Templates

- `templates/storage-provider-registry.ts.template`

## Common pitfalls

- **Reading env at module load**: don't do `const provider = new MemoryStorageProvider()` at the top of the file — that runs even if no one calls `getStorageProvider()`, breaking the `__resetStorageProviderForTests` escape hatch. Always lazy-init inside the function.
- **Lowercasing the env value**: `VIVIM_STORAGE_PROVIDER=MEMORY` should work the same as `=memory`. The `.toLowerCase()` handles this.
- **Forgetting to memoize**: without `if (_provider) return _provider`, every call creates a new provider with fresh state — the app would lose data between requests.
