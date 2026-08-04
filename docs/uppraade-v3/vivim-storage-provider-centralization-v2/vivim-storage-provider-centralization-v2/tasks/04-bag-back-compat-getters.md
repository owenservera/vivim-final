# Task 04 — Add back-compat getters to `CanvasEngineBag`

**Phase**: B (Wire it in)
**Depends on**: Task 03
**Effort**: 1 hr
**Files touched**:
- `frontend/src/lib/canvas-engine-bootstrap.ts` (replace 24 plain properties with getters)

## Context

After Task 03, `CanvasEngineBag` has both `storage: StorageProvider` and 24 plain properties like `uiComponentStore: UiComponentStore` set in the `_bag = { ... }` object. This works, but it means `bag.uiComponentStore` and `bag.storage.uiComponentStore` are technically two separate references (even though they point to the same object). If someone reassigns `bag.uiComponentStore = new SomeOtherStore()`, the two diverge silently.

This task converts the 24 plain properties to getters that delegate to `bag.storage.XStore`. This guarantees identity (`bag.uiComponentStore === bag.storage.uiComponentStore` always) and makes the back-compat layer self-maintaining.

## Goal

1. Replace the 24 plain store properties on `CanvasEngineBag` with `readonly` getters.
2. Remove the 24 `uiComponentStore: storage.uiComponentStore` lines from the `_bag = { ... }` object (getters don't need assignment).
3. Verify identity with a quick smoke test.

## Spec

### Part 1: Update the `CanvasEngineBag` interface

Change the 24 store field declarations from:
```ts
uiComponentStore: UiComponentStore;
```
to:
```ts
readonly uiComponentStore: UiComponentStore;
```

This is a no-op for consumers (they were already reading, not writing), but it signals intent and catches accidental writes.

### Part 2: Replace the 24 assignments with getters

In `getEngineBag()`, the `_bag = { ... }` object currently has:
```ts
_bag = {
  storage,
  uiComponentStore: storage.uiComponentStore,
  providerTypeStore: storage.providerTypeStore,
  // ... 22 more
  // engines stay as-is
};
```

Change to:
```ts
const storage = getStorageProvider();

// Build a partial bag with just the engines and the storage reference.
// The 24 store fields come from getters defined on the object literal.
const partialBag = {
  storage,
  // engines...
  eventBus,
  logger,
  // ... all engines
};

_bag = Object.assign(
  Object.create(Object.getPrototypeOf(partialBag)),
  partialBag,
  // Define getters for the 24 store fields:
  {
    get uiComponentStore() { return storage.uiComponentStore; },
    get providerTypeStore() { return storage.providerTypeStore; },
    get primitiveStore() { return storage.primitiveStore; },
    get providerStore() { return storage.providerStore; },
    get accountStore() { return storage.accountStore; },
    get capabilityTierStore() { return storage.capabilityTierStore; },
    get userLayoutStore() { return storage.userLayoutStore; },
    get canvasDefinitionStore() { return storage.canvasDefinitionStore; },
    get workspaceStore() { return storage.workspaceStore; },
    get documentStore() { return storage.documentStore; },
    get mediaStore() { return storage.mediaStore; },
    get automationStore() { return storage.automationStore; },
    get agentStore() { return storage.agentStore; },
    get hitlGateStore() { return storage.hitlGateStore; },
    get policyRuleStore() { return storage.policyRuleStore; },
    get annotationStore() { return storage.annotationStore; },
    get shellCommandStore() { return storage.shellCommandStore; },
    get notificationStore() { return storage.notificationStore; },
    get auditStore() { return storage.auditStore; },
    get rbacStore() { return storage.rbacStore; },
    get templateStore() { return storage.templateStore; },
    get presenceStore() { return storage.presenceStore; },
    get searchIndex() { return storage.searchIndex; },
    get onboardingStore() { return storage.onboardingStore; },
    get documentEditStore() { return storage.documentEditStore; },
    get zLayerStore() { return storage.zLayerStore; },
    get drawerStore() { return storage.drawerStore; },
  }
) as CanvasEngineBag;
```

**Simpler alternative** (preferred — avoids `Object.assign` + `Object.create`):

Define the getters directly on the `_bag` object literal:

```ts
_bag = {
  storage,
  // engines (still plain fields)
  eventBus,
  logger,
  traceStore,
  canvasRegistry,
  // ... all engines

  // Back-compat store getters — DO NOT add new ones; use `bag.storage.X` instead.
  get uiComponentStore() { return this.storage.uiComponentStore; },
  get providerTypeStore() { return this.storage.providerTypeStore; },
  // ... 22 more
  get drawerStore() { return this.storage.drawerStore; },
} as CanvasEngineBag;
```

The `this.storage` reference works because `storage` is a field on the same object. TypeScript may complain about `this` in object literal getters — if so, use the closed-over `storage` variable directly:

```ts
const storage = getStorageProvider();
// ...
_bag = {
  storage,
  // engines...
  get uiComponentStore() { return storage.uiComponentStore; },
  // ...
} as CanvasEngineBag;
```

The closure over `storage` is fine because `storage` is a const.

### Part 3: Update the interface to mark store fields as getters

TypeScript interfaces don't distinguish between property and getter declarations — both look like `readonly x: T`. So the interface change in Part 1 (adding `readonly`) is sufficient. The runtime gets the getter behavior from the object literal.

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/lib/canvas-engine-bootstrap.ts` | modified (24 properties → getters; remove 24 assignments from `_bag`) |

## Verification

1. `bun run tsc --noEmit` — passes.
2. `bun run dev` boots.
3. Smoke test identity (paste into a temp file and run with `bun`):
   ```ts
   import { getEngineBag } from './src/lib/canvas-engine-bootstrap';
   const bag = getEngineBag();
   console.assert(bag.onboardingStore === bag.storage.onboardingStore, 'identity broken');
   console.assert(bag.providerStore === bag.storage.providerStore, 'identity broken');
   // ... spot-check a few more
   console.log('OK');
   ```
4. `curl localhost:3000/api/onboarding/state?userId=user:demo` — still works.
5. `grep -n "uiComponentStore: storage" frontend/src/lib/canvas-engine-bootstrap.ts` — zero matches (assignments removed).
6. `grep -n "get uiComponentStore" frontend/src/lib/canvas-engine-bootstrap.ts` — one match (getter added).

## Common pitfalls

- **`this` binding in getters**: if you use `this.storage.X` in a getter and the bag is destructured (`const { onboardingStore } = bag`), `this` is `undefined` and the getter throws. Fix: use the closed-over `storage` variable, not `this.storage`.
- **Forgetting to mark interface fields `readonly`**: without `readonly`, TypeScript allows `bag.onboardingStore = new OtherStore()`, which would silently fail (the getter has no setter) or throw in strict mode. Adding `readonly` makes the intent explicit and catches mistakes at compile time.
- **Leaving stale assignments in `_bag`**: if you add the getter but forget to delete the `uiComponentStore: storage.uiComponentStore` line, the getter is shadowed by the assignment. TypeScript will warn about duplicate property; fix by deleting the assignment.
