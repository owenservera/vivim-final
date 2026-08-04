# Task 03 — Refactor `canvas-engine-bootstrap.ts` to consume `StorageProvider`

**Phase**: B (Wire it in)
**Depends on**: Task 02
**Effort**: 1–2 hr
**Files touched**:
- `frontend/src/lib/canvas-engine-bootstrap.ts` (heavy refactor)
- `frontend/eslint.config.mjs` (add `no-restricted-imports` rule)

## Context

`canvas-engine-bootstrap.ts` currently instantiates all 24 stores inline. This task replaces those 24 `new MemoryXStore()` calls with one `getStorageProvider()` call, and threads the resulting `storage` object through to the engines. Task 04 then adds back-compat getters so existing `bag.XStore` access keeps working.

This is the highest-risk task in the pack because it touches the central wiring file. The parity test in Task 10 is the safety net.

## Goal

1. Import `getStorageProvider` (will be implemented in Task 05 — for now, import it from a stub path or use `MemoryStorageProvider` directly with a TODO comment).
2. Replace the 24 `const XStore = new MemoryXStore()` lines with `const storage = getStorageProvider();`.
3. Update the engine constructors to take `storage.XStore` instead of the local variable.
4. Add the `storage: StorageProvider` field to `CanvasEngineBag`.
5. Add an ESLint rule forbidding direct imports of `storage/impl/*` outside the provider.

## Spec

### Part 1: Add a temporary `getStorageProvider` stub

Since Task 05 hasn't been done yet, create a minimal stub at the bottom of `frontend/src/storage/provider/index.ts` (it will be replaced by Task 05):

```ts
// storage/provider/index.ts
export * from './storage-provider';
export * from './memory-storage-provider';

import { MemoryStorageProvider } from './memory-storage-provider';
import type { StorageProvider } from './storage-provider';

let _provider: StorageProvider | null = null;

/** TEMPORARY STUB — Task 05 replaces this with env-driven selection. */
export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;
  _provider = new MemoryStorageProvider();
  return _provider;
}
```

### Part 2: Refactor `canvas-engine-bootstrap.ts`

Use `templates/canvas-engine-bootstrap.ts.template` as a reference. The refactor:

1. **Delete the 24 memory class imports** (lines 38–66 of the current file). Replace with:
   ```ts
   import { getStorageProvider, type StorageProvider } from '../storage/provider';
   ```

2. **Delete the 24 `const XStore = new MemoryXStore()` lines** (Phase 1 stores ~lines 194–201; Phase 2 ~204–212; Phase 3 ~250–256; Phase 4 ~290–292). Replace with:
   ```ts
   const storage = getStorageProvider();
   ```

3. **Update the `CanvasEngineBag` interface** to add `storage: StorageProvider` as the first field. **Keep** the 24 typed store fields for now (Task 04 converts them to getters). The interface now looks like:
   ```ts
   export interface CanvasEngineBag {
     storage: StorageProvider;
     // Phase 1
     uiComponentStore: MemoryUiComponentStore;  // ← these will become getters in Task 04
     // ... 23 more
   }
   ```
   
   **Problem**: The interface still references `MemoryXStore` types, which we deleted from the imports. Two options:
   - **Option A**: Re-import them as type-only: `import type { MemoryUiComponentStore, ... } from '../storage/impl';`. Keeps the interface compiling but re-introduces the impl dependency in the type. Acceptable as a transitional step — Task 04 removes it.
   - **Option B**: Change the interface field types to the contract: `uiComponentStore: UiComponentStore`. This is the better long-term shape but requires importing all 24 contracts.
   
   **Use Option B** — it's the right shape and Task 04 doesn't change it. Import all 24 contracts:
   ```ts
   import type {
     UiComponentStore, ProviderTypeStore, /* ... 22 more */
   } from '../storage/contracts';
   ```

4. **Update engine constructors** to take `storage.XStore` instead of the local variable:
   ```ts
   // Before:
   const documentEngine = new DocumentEngine({ documentStore, eventBus, logger });
   // After:
   const documentEngine = new DocumentEngine({ documentStore: storage.documentStore, eventBus, logger });
   ```

   This is mechanical: search-and-replace `documentStore` → `storage.documentStore` in the engine constructor calls (but NOT in the `CanvasEngineBag` interface or the `_bag = { ... }` return object — those will be handled in Task 04).

5. **Update the `_bag = { ... }` return object** to include `storage`:
   ```ts
   _bag = {
     storage,
     // ... existing 24 store fields now reference storage.XStore:
     uiComponentStore: storage.uiComponentStore,
     providerTypeStore: storage.providerTypeStore,
     // ... 22 more
     // engines stay as-is
   };
   ```

6. **Delete the inline `MemoryAnnotationStore` class** (already done in Task 02, but double-check).

### Part 3: ESLint rule

Update `frontend/eslint.config.mjs` (or `.eslintrc.json` — check which exists) to add:

```js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/storage/impl/*'],
        message: 'Use StorageProvider (from "@/storage/provider") instead of importing impls directly. Exception: files inside storage/provider/ and lib/canvas-engine-bootstrap.ts may import impls.',
        allowTypeImports: false,
      }],
    }],
  },
  // Per-file overrides to allow the exceptions:
  overrides: [
    {
      files: ['src/storage/provider/**', 'src/lib/canvas-engine-bootstrap.ts'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
}
```

After this rule is in place, `bun run lint` should pass (the bootstrap is exempted; no other file imports from `storage/impl/` today — verify with `grep -r "storage/impl" frontend/src/ | grep -v "storage/provider" | grep -v "canvas-engine-bootstrap"`).

### Part 4: Verify

Run `bun run dev` and exercise a few API routes (`/api/onboarding/state`, `/api/notification/list`, `/api/audit/list`). They should all work — the bag still exposes `onboardingStore` etc. as direct fields (Task 04 will turn them into getters, but for now they're plain properties set to `storage.XStore`).

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/provider/index.ts` | modified (add stub `getStorageProvider`) |
| `frontend/src/lib/canvas-engine-bootstrap.ts` | heavy refactor |
| `frontend/eslint.config.mjs` | modified (add `no-restricted-imports` rule) |

## Verification

1. `bun run tsc --noEmit` — passes.
2. `bun run lint` — passes.
3. `bun run dev` boots without errors.
4. `curl localhost:3000/api/onboarding/state?userId=user:demo` — returns `{"ok":true,"state":null}` (or the existing state).
5. `curl localhost:3000/api/notification/list?userId=user:demo` — returns `{"ok":true,"notifications":[...]}`.
6. `grep -n "new Memory" frontend/src/lib/canvas-engine-bootstrap.ts` — zero matches (all 24 instantiations removed).
7. `grep -n "getStorageProvider" frontend/src/lib/canvas-engine-bootstrap.ts` — one match.

## Templates

- `templates/canvas-engine-bootstrap.ts.template`

## Common pitfalls

- **Forgetting to update engine constructor calls**: if you leave `documentEngine = new DocumentEngine({ documentStore, ... })` but `documentStore` no longer exists as a local variable, you'll get a TypeScript error. The fix is `documentStore: storage.documentStore`.
- **Breaking the `MemoryDocumentEditStore` dependency**: this store takes `documentStore` in its constructor. Inside the provider, this is handled (Task 02). But if the bootstrap directly references `documentEditStore` somewhere, it now goes through `storage.documentEditStore` which already has the dependency wired.
- **Losing the `MemoryAnnotationStore` extraction**: if Task 02 wasn't done, the inline class is still there and `storage.annotationStore` doesn't exist. Re-do Task 02 first.
