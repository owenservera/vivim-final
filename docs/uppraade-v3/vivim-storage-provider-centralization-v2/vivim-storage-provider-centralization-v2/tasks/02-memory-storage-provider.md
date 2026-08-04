# Task 02 — Implement `MemoryStorageProvider`

**Phase**: A (Define the contract)
**Depends on**: Task 01
**Effort**: 1 hr
**Files touched**:
- `frontend/src/storage/provider/memory-storage-provider.ts` (new)
- `frontend/src/storage/impl/memory-annotation-store.ts` (new — extracted from `canvas-engine-bootstrap.ts`)
- `frontend/src/storage/impl/index.ts` (add export)
- `frontend/src/lib/canvas-engine-bootstrap.ts` (delete inline `MemoryAnnotationStore` class; import from impl)

## Context

The `StorageProvider` interface exists (Task 01) but has no impl. `MemoryStorageProvider` is the default impl — it wraps the 24 existing `MemoryXStore` classes without changing their behavior. This task also extracts the inline `MemoryAnnotationStore` from `canvas-engine-bootstrap.ts` into its own file, so the provider can instantiate it like every other store.

## Goal

1. Extract `MemoryAnnotationStore` from `canvas-engine-bootstrap.ts` lines 71–101 into `frontend/src/storage/impl/memory-annotation-store.ts`.
2. Implement `MemoryStorageProvider` that instantiates all 24 memory classes in its constructor.
3. Export `MemoryAnnotationStore` from `storage/impl/index.ts`.
4. Update `canvas-engine-bootstrap.ts` to import `MemoryAnnotationStore` from `storage/impl` instead of defining it inline.

Nothing in production uses `MemoryStorageProvider` yet — this task is pure impl.

## Spec

### Part 1: Extract `MemoryAnnotationStore`

Create `frontend/src/storage/impl/memory-annotation-store.ts` with the exact code from `canvas-engine-bootstrap.ts` lines 71–101, adapted to be a standalone file:

```ts
// storage/impl/memory-annotation-store.ts
import type { Annotation } from '../../engines/annotation-engine';
import type { AnnotationStore } from '../contracts/annotation-store';

export class MemoryAnnotationStore implements AnnotationStore {
  private rows = new Map<string, Annotation>();

  async get(id: string): Promise<Annotation | null> {
    return this.rows.get(id) ?? null;
  }

  async list(filter?: { targetKind?: string; targetId?: string }): Promise<Annotation[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.targetKind && r.targetKind !== filter.targetKind) return false;
      if (filter?.targetId && r.targetId !== filter.targetId) return false;
      return true;
    });
  }

  async create(input: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation> {
    const now = Date.now();
    const id = `ann:${input.slug}:${now.toString(36)}`;
    const row: Annotation = { ...input, id, createdAt: now, updatedAt: now };
    this.rows.set(id, row);
    return row;
  }

  async update(id: string, patch: Partial<Annotation>): Promise<Annotation> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Annotation not found: ${id}`);
    const updated: Annotation = { ...existing, ...patch, id, updatedAt: Date.now() };
    this.rows.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}
```

Update `frontend/src/storage/impl/index.ts` to add:
```ts
export { MemoryAnnotationStore } from './memory-annotation-store';
```

Update `frontend/src/lib/canvas-engine-bootstrap.ts`:
- Delete lines 71–101 (the inline `MemoryAnnotationStore` class).
- Add `MemoryAnnotationStore` to the import from `'../storage/impl'`:
  ```ts
  // existing imports...
  MemoryAnnotationStore,
  // ...
  ```

The `annotationStore = new MemoryAnnotationStore()` line in `getEngineBag()` (around line 211) should still work — it now imports the class instead of defining it locally.

### Part 2: Implement `MemoryStorageProvider`

Create `frontend/src/storage/provider/memory-storage-provider.ts` using `templates/memory-storage-provider.ts.template`:

```ts
// storage/provider/memory-storage-provider.ts
import type { StorageProvider } from './storage-provider';
import {
  MemoryUiComponentStore,
  MemoryProviderTypeStore,
  MemoryPrimitiveStore,
  MemoryProviderStore,
  MemoryAccountStore,
  MemoryCapabilityTierStore,
  MemoryUserLayoutStore,
  MemoryCanvasDefinitionStore,
  MemoryWorkspaceStore,
  MemoryDocumentStore,
  MemoryMediaStore,
  MemoryAutomationStore,
  MemoryAgentStore,
  MemoryHitlGateStore,
  MemoryPolicyRuleStore,
  MemoryAnnotationStore,
  MemoryShellCommandStore,
  MemoryNotificationStore,
  MemoryAuditStore,
  MemoryRbacStore,
  MemoryWorkspaceTemplateStore,
  MemoryPresenceStore,
  MemorySearchIndex,
  MemoryOnboardingStore,
  MemoryDocumentEditStore,
  MemoryZLayerStore,
  MemoryDrawerStore,
} from '../impl';

export class MemoryStorageProvider implements StorageProvider {
  readonly name = 'memory' as const;

  // Phase 1
  readonly uiComponentStore = new MemoryUiComponentStore();
  readonly providerTypeStore = new MemoryProviderTypeStore();
  readonly primitiveStore = new MemoryPrimitiveStore();
  readonly providerStore = new MemoryProviderStore();
  readonly accountStore = new MemoryAccountStore();
  readonly capabilityTierStore = new MemoryCapabilityTierStore();
  readonly userLayoutStore = new MemoryUserLayoutStore();
  readonly canvasDefinitionStore = new MemoryCanvasDefinitionStore();

  // Phase 2
  readonly workspaceStore = new MemoryWorkspaceStore();
  readonly documentStore = new MemoryDocumentStore();
  readonly mediaStore = new MemoryMediaStore();
  readonly automationStore = new MemoryAutomationStore();
  readonly agentStore = new MemoryAgentStore();
  readonly hitlGateStore = new MemoryHitlGateStore();
  readonly policyRuleStore = new MemoryPolicyRuleStore();
  readonly annotationStore = new MemoryAnnotationStore();
  readonly shellCommandStore = new MemoryShellCommandStore();

  // Phase 3
  readonly notificationStore = new MemoryNotificationStore();
  readonly auditStore = new MemoryAuditStore();
  readonly rbacStore = new MemoryRbacStore();
  readonly templateStore = new MemoryWorkspaceTemplateStore();
  readonly presenceStore = new MemoryPresenceStore();
  readonly searchIndex = new MemorySearchIndex();
  readonly onboardingStore = new MemoryOnboardingStore();

  // Phase 4
  readonly documentEditStore = new MemoryDocumentEditStore();
  readonly zLayerStore = new MemoryZLayerStore();
  readonly drawerStore = new MemoryDrawerStore();
}
```

**Notes**:
- All properties are `readonly` and initialized as class fields. This means each `MemoryStorageProvider` instance creates one of each store. Don't share instances across providers.
- The `MemoryDocumentEditStore` constructor takes a `documentStore` argument (see `storage/impl/memory-document-edit-store.ts`). For the provider, we need to pass our own `documentStore`:

  ```ts
  // At the top of the class body, before the Phase 4 properties:
  // (we can't reference `this.documentStore` in a field initializer, so use a getter or a private field)

  private readonly _documentEditStore = new MemoryDocumentEditStore(this.documentStore);
  readonly documentEditStore = this._documentEditStore;
  ```

  Actually, field initializers run in declaration order, so `this.documentStore` IS available if `documentStore` is declared before `documentEditStore`. Verify by reading the `MemoryDocumentEditStore` constructor — if it takes the doc store, declare `documentStore` first.

  If field order matters and creates a TypeScript error, use a constructor:
  ```ts
  readonly documentEditStore: MemoryDocumentEditStore;
  constructor() {
    this.documentEditStore = new MemoryDocumentEditStore(this.documentStore);
  }
  ```

### Part 3: Verify the impl

Run `cd frontend && bun run tsc --noEmit`. Fix any type errors. Common issues:
- `MemoryDocumentEditStore` constructor signature (see above).
- `MemoryAgentStore` constructor (it should be no-arg; if it takes args, check the v1/v2 contract).

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/provider/memory-storage-provider.ts` | new |
| `frontend/src/storage/impl/memory-annotation-store.ts` | new (extracted) |
| `frontend/src/storage/impl/index.ts` | modified (add annotation export) |
| `frontend/src/lib/canvas-engine-bootstrap.ts` | modified (delete inline class; import from impl) |

## Verification

1. `bun run tsc --noEmit` — passes with zero errors.
2. Quick smoke test (paste into a temp file and run with `bun`):
   ```ts
   import { MemoryStorageProvider } from './src/storage/provider/memory-storage-provider';
   const p = new MemoryStorageProvider();
   console.log(p.name); // 'memory'
   console.log(typeof p.onboardingStore.get); // 'function'
   console.log(typeof p.annotationStore.create); // 'function'
   ```
3. `grep -n "class MemoryAnnotationStore" frontend/src/lib/canvas-engine-bootstrap.ts` — no matches (the class is gone).
4. `grep -n "MemoryAnnotationStore" frontend/src/storage/impl/index.ts` — one match (the export).

## Templates

- `templates/memory-storage-provider.ts.template`
