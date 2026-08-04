# 02 — Design Decisions

This doc explains *why* each design choice was made. If you disagree with a decision, raise it before implementing; do not silently diverge.

## Decision 1: One `StorageProvider` interface, not one per domain

**Choice**: A single `StorageProvider` interface exposes all 24 stores as properties.

```ts
interface StorageProvider {
  readonly name: 'memory' | 'prisma' | 'test';
  readonly uiComponentStore: UiComponentStore;
  readonly providerTypeStore: ProviderTypeStore;
  // ... 22 more
  readonly annotationStore: AnnotationStore;
}
```

**Alternatives considered**:
- *Per-domain providers* (e.g., `CanvasStorageProvider`, `WorkspaceStorageProvider`, `UxStorageProvider`). Rejected: adds a naming layer without removing the wiring problem. The bootstrap still has to instantiate 3 providers instead of 24 stores — marginal win.
- *Per-store factory methods* (e.g., `provider.getStore<OnboardingStore>()`). Rejected: loses type safety (you'd have to cast), and adds a method call per access. Property access is faster and TypeScript-friendlier.
- *Service locator pattern* (`provider.resolve('OnboardingStore')`). Rejected: stringly-typed, breaks refactoring, no IDE autocomplete.

**Why this won**: One object, one type, one import. Property access is fast and type-safe. The 24-property interface is verbose but explicit — you can see at a glance what storage the app needs. Adding a 25th store is a one-line addition to the interface + one-line addition to each impl.

## Decision 2: `MemoryStorageProvider` wraps the existing memory classes, doesn't rewrite them

**Choice**: `MemoryStorageProvider` is a thin class that instantiates the 24 existing `MemoryXStore` classes in its constructor and exposes them as properties. No behavior change, no new logic.

```ts
class MemoryStorageProvider implements StorageProvider {
  readonly name = 'memory' as const;
  readonly uiComponentStore = new MemoryUiComponentStore();
  readonly providerTypeStore = new MemoryProviderTypeStore();
  // ... 22 more
}
```

**Alternatives considered**:
- *Rewrite the memory impls as methods on `MemoryStorageProvider`*. Rejected: would force a rewrite of all 24 impls + break the existing tests + make the file 1000+ lines.
- *Make `MemoryStorageProvider` a factory that returns a new instance per call*. Rejected: would break the singleton invariant — the whole point of the memory impls is that they share state across requests.

**Why this won**: Zero-risk migration. The existing memory classes keep working unchanged. If a bug is found in `MemoryOnboardingStore`, it's still in `MemoryOnboardingStore` — same file, same tests, same fix path.

## Decision 3: Back-compat getters on `CanvasEngineBag`, not a breaking change

**Choice**: After this pack, `CanvasEngineBag` exposes `storage: StorageProvider` as the primary accessor, AND keeps `bag.onboardingStore`, `bag.providerStore`, etc. as getters that delegate to `bag.storage.onboardingStore`. Existing code that destructures `bag.onboardingStore` keeps working unchanged.

```ts
interface CanvasEngineBag {
  storage: StorageProvider;
  // Back-compat getters — DO NOT add new ones; use `bag.storage.X` instead.
  readonly onboardingStore: OnboardingStore;
  readonly providerStore: ProviderStore;
  // ... 22 more
}

// In getEngineBag():
const storage = getStorageProvider();
_bag = {
  storage,
  get onboardingStore() { return storage.onboardingStore; },
  get providerStore() { return storage.providerStore; },
  // ... 22 more
};
```

**Alternatives considered**:
- *Breaking change: remove the 24 fields, force consumers to use `bag.storage.X`*. Rejected: would touch ~80 API route files + ~24 engine constructors in one PR. Too risky, too noisy.
- *Keep the 24 fields as plain properties, set them once in the constructor*. Rejected: then `bag.onboardingStore` and `bag.storage.onboardingStore` could diverge if someone reassigns one. Getters guarantee they're always the same object.
- *Proxy the bag with a `Proxy` object that forwards unknown property access to `storage`*. Rejected: too clever, breaks TypeScript autocomplete, hard to debug.

**Why this won**: Getters give us type-safe back-compat + guarantee identity (`bag.onboardingStore === bag.storage.onboardingStore` always). The migration can happen incrementally — consumers move to `bag.storage.X` over time, and once they're all migrated, the getters can be removed in a future pack.

## Decision 4: `getStorageProvider()` is a process-singleton, env-driven

**Choice**: A `getStorageProvider()` function in `storage/provider/index.ts` memoizes the provider at module level. The impl is selected by `VIVIM_STORAGE_PROVIDER` env var (default `'memory'`).

```ts
let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;
  const name = process.env.VIVIM_STORAGE_PROVIDER ?? 'memory';
  switch (name) {
    case 'memory': _provider = new MemoryStorageProvider(); break;
    case 'prisma': _provider = new PrismaStorageProvider(); break;
    case 'test':   _provider = new TestStorageProvider();   break;
    default: throw new Error(`Unknown VIVIM_STORAGE_PROVIDER: ${name}`);
  }
  return _provider;
}
```

**Alternatives considered**:
- *Pass the provider explicitly through every function call*. Rejected: would touch every API route + every engine. The whole point of the existing `getEngineBag()` singleton is to avoid this.
- *Per-request provider (resets on every API call)*. Rejected: defeats the purpose of in-memory state. The memory impls rely on process-level singleton state.
- *Configurable at runtime via an API endpoint*. Rejected: too dangerous. Swapping providers mid-process would lose all in-memory state. Env-var-at-startup is the right granularity.

**Why this won**: Matches the existing `getEngineBag()` pattern (process-singleton, memoized). Env-var selection is the standard pattern for impl swapping in Node.js. The `test` value is reserved for a future deterministic-seed provider (not in this pack, but the door is open).

## Decision 5: `PrismaStorageProvider` is a stub that throws `NotImplementedError`

**Choice**: Task 08 creates `PrismaStorageProvider` with all 24 properties throwing `NotImplementedError` on first access. Task 09 fills in `onboardingStore` with the v1 `PrismaOnboardingStore` as proof. The remaining 23 stores stay stubs.

```ts
class PrismaStorageProvider implements StorageProvider {
  readonly name = 'prisma' as const;
  readonly onboardingStore: OnboardingStore = new PrismaOnboardingStore();
  readonly providerStore: ProviderStore = new NotImplementedErrorProxy('providerStore', 'PrismaProviderStore');
  // ... 22 more, all NotImplementedErrorProxy
}
```

**Alternatives considered**:
- *Don't create the stub until all 24 Prisma impls are written*. Rejected: that's a 24-PR effort with no early validation. The stub lets us validate the swap mechanism end-to-end with one store.
- *Make the stub return `MemoryStorageProvider`'s impls as a fallback*. Rejected: dangerous — the user thinks they're on Prisma but data is in memory. Better to fail loudly per-store.
- *Use `null` for unimplemented stores*. Rejected: TypeScript would force every consumer to null-check. `NotImplementedErrorProxy` throws on first method call, which is the right granularity (you only crash if you actually use that store).

**Why this won**: The stub makes migration progress visible (`/api/storage/health` can report "1/24 migrated"), unblocks the swap mechanism test, and gives a clear error message naming the missing store + linking to the roadmap. The proxy pattern means we don't have to write 23 × ~5 method stubs by hand.

## Decision 6: New `/api/storage/health` endpoint, not a CLI-only feature

**Choice**: Task 06 adds `GET /api/storage/health` that returns:

```json
{
  "ok": true,
  "provider": "memory",
  "stores": {
    "onboardingStore": { "impl": "MemoryOnboardingStore", "ready": true, "count": 3 },
    "providerStore":   { "impl": "MemoryProviderStore",   "ready": true, "count": 6 },
    // ... 22 more
  },
  "migrationProgress": { "migrated": 1, "total": 24, "pct": 4.17 }
}
```

**Alternatives considered**:
- *CLI only (`bun run storage:inspect`)*. Rejected: the desktop app's user can't run a CLI. They need a URL they can hit from the browser to diagnose "where's my data?".
- *Tauri command (Rust → JS)*. Rejected: too much ceremony for a debug endpoint. HTTP is universal.
- *SSE stream that updates live*. Rejected: counts change too slowly to justify streaming. Polling every 5s is fine.

**Why this won**: HTTP endpoint works in dev (Next.js) and in the Tauri shell (the backend serves it on `:9420`). The Tauri Rust supervisor can also hit it for health checks. The CLI (Task 07) reuses the same logic for terminal debugging.

## Decision 7: CLI lives in `frontend/src/cli/commands/`, not at repo root

**Choice**: Task 07 creates `frontend/src/cli/commands/storage-inspect.ts`. It's wired as a `bun run storage:inspect` script in `frontend/package.json`.

**Alternatives considered**:
- *Repo-root script in `scripts/`*. Rejected: the existing `scripts/` dir at repo root is for Tauri/installer scripts (PowerShell, NSIS). Mixing Node CLIs there is messy.
- *Standalone bin in `frontend/bin/`*. Rejected: would need a separate tsconfig + path setup. Using `bun run` from `frontend/` reuses the existing Next.js TypeScript config.

**Why this won**: Matches the existing pattern (`frontend/src/cli/commands/shell.ts` already exists and is wired the same way). `bun run storage:inspect` works from `frontend/` with zero config.

## Decision 8: `AnnotationStore` moves out of `canvas-engine-bootstrap.ts` into its own files

**Choice**: As part of Task 02, the inline `MemoryAnnotationStore` class (currently in `canvas-engine-bootstrap.ts` lines 71–101) moves to `frontend/src/storage/impl/memory-annotation-store.ts`. Its contract already exists in `engines/annotation-engine.ts` — Task 02 also extracts that to `storage/contracts/annotation-store.ts` for consistency with the other 23 contracts.

**Alternatives considered**:
- *Leave it inline*. Rejected: it's the only store not in `storage/impl/`, which is the inconsistency this pack is fixing. Plus, the provider needs to instantiate it, which is impossible if it's a private class in another file.
- *Move only the impl, leave the contract in `engines/`*. Rejected: the contract should live with the other 23 contracts. Engines importing from `storage/contracts/annotation-store` is more consistent than engines importing from `engines/annotation-engine` for the contract.

**Why this won**: Removes a 30-line private class from the bootstrap file, makes AnnotationStore testable in isolation, and lets `MemoryStorageProvider` instantiate it like every other store.

## Decision 9: ESLint rule forbids direct imports of `storage/impl/*` outside the provider

**Choice**: Task 03 adds an ESLint rule (`no-restricted-imports`) that forbids importing from `storage/impl/*` anywhere except `storage/provider/*` and `lib/canvas-engine-bootstrap.ts`.

```js
// eslint.config.mjs
'no-restricted-imports': ['error', {
  patterns: [
    { group: ['../storage/impl/*', '@/storage/impl/*'],
      message: 'Use StorageProvider instead. Import from "@/storage/provider" and call getStorageProvider().',
      allowExceptions: ['storage/provider/**', 'lib/canvas-engine-bootstrap.ts']
    }
  ]
}]
```

**Alternatives considered**:
- *No rule, rely on code review*. Rejected: one bad import undoes the entire centralization. The rule is the enforcement.
- *TS `paths` mapping that redirects `storage/impl/*` to throw*. Rejected: too clever, breaks IDE go-to-definition, surprises people.
- *Move impls to a separate package*. Rejected: overkill for a single repo.

**Why this won**: Lint rules are the standard way to enforce architectural constraints in TypeScript. The rule is local to `eslint.config.mjs` and easy to extend.

## Decision 10: Parity test asserts identity, not equality

**Choice**: Task 10's parity test asserts that `bag.onboardingStore === bag.storage.onboardingStore` (same reference), not just that they return the same data. Identity is stronger than equality and catches the case where two impls are accidentally instantiated.

```ts
// storage-provider.parity.test.ts
test('bag.XStore is the same object as storage.XStore', () => {
  const bag = getEngineBag();
  const storage = getStorageProvider();
  expect(bag.onboardingStore).toBe(storage.onboardingStore);
  expect(bag.providerStore).toBe(storage.providerStore);
  // ... 22 more
});
```

**Alternatives considered**:
- *Test that they return equal data*. Rejected: would require setting up test data in both, and misses the bug where two instances exist.
- *No parity test, rely on manual review*. Rejected: this is the one test that catches the most common mistake (forgetting to wire a getter).

**Why this won**: Identity is the strongest possible assertion. It catches every wiring mistake with one line per store. The test is fast (no I/O, no data setup) and deterministic.
