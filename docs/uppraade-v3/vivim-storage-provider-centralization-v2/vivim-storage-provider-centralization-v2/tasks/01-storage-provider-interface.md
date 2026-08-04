# Task 01 — Define `StorageProvider` interface

**Phase**: A (Define the contract)
**Depends on**: —
**Effort**: 30 min
**Files touched**:
- `frontend/src/storage/provider/storage-provider.ts` (new)
- `frontend/src/storage/contracts/annotation-store.ts` (new — extracted from `engines/annotation-engine.ts`)

## Context

There is no `StorageProvider` type today. Each consumer (the bootstrap, API routes, engines) imports the specific store contract it needs. This means there's no single type that says "this object gives you every store" — which is what we need to enable provider swapping.

`AnnotationStore` is also currently declared inside `engines/annotation-engine.ts` instead of in `storage/contracts/`. This pack moves it for consistency with the other 23 contracts.

## Goal

1. Create `frontend/src/storage/provider/storage-provider.ts` exporting the `StorageProvider` interface.
2. Create `frontend/src/storage/contracts/annotation-store.ts` (extracted from `engines/annotation-engine.ts`).
3. Update `frontend/src/storage/contracts/index.ts` to export the new annotation contract.
4. Update `frontend/src/engines/annotation-engine.ts` to import the contract from its new location (re-export for back-compat).

Nothing in production uses `StorageProvider` yet — this task is pure type definition.

## Spec

### Part 1: Create `storage/provider/storage-provider.ts`

Use `templates/storage-provider.ts.template` as a starting point. The interface must:

- Have a `readonly name: 'memory' | 'prisma' | 'test'` property (used by `/api/storage/health`).
- Have a `readonly` property for each of the 24 store contracts, typed as the contract interface.
- Have a `readonly stores: ReadonlyArray<{ name: string; impl: string; ready: boolean }>` getter? **No** — that's runtime introspection, which belongs on the impl, not the interface. Keep the interface pure.

The interface shape:

```ts
import type { UiComponentStore } from '../contracts/ui-component-store';
// ... 23 more imports
import type { AnnotationStore } from '../contracts/annotation-store';

export interface StorageProvider {
  readonly name: 'memory' | 'prisma' | 'test';

  // Phase 1 — core canvas (8 stores)
  readonly uiComponentStore: UiComponentStore;
  readonly providerTypeStore: ProviderTypeStore;
  readonly primitiveStore: PrimitiveStore;
  readonly providerStore: ProviderStore;
  readonly accountStore: AccountStore;
  readonly capabilityTierStore: CapabilityTierStore;
  readonly userLayoutStore: UserLayoutStore;
  readonly canvasDefinitionStore: CanvasDefinitionStore;

  // Phase 2 — workspace OS (8 stores, AnnotationStore extracted in this task)
  readonly workspaceStore: WorkspaceStore;
  readonly documentStore: DocumentStore;
  readonly mediaStore: MediaStore;
  readonly automationStore: AutomationStore;
  readonly agentStore: AgentStore;
  readonly hitlGateStore: HitlGateStore;
  readonly policyRuleStore: PolicyRuleStore;
  readonly annotationStore: AnnotationStore;
  readonly shellCommandStore: ShellCommandStore;

  // Phase 3 — UX enhancement (7 stores)
  readonly notificationStore: NotificationStore;
  readonly auditStore: AuditStore;
  readonly rbacStore: RbacStore;
  readonly templateStore: WorkspaceTemplateStore;
  readonly presenceStore: PresenceStore;
  readonly searchIndex: SearchIndex;
  readonly onboardingStore: OnboardingStore;

  // Phase 4 — doc suite (3 stores)
  readonly documentEditStore: DocumentEditStore;
  readonly zLayerStore: ZLayerStore;
  readonly drawerStore: DrawerStore;
}
```

### Part 2: Extract `AnnotationStore` contract

Read `frontend/src/engines/annotation-engine.ts` and find the `AnnotationStore` interface declaration (likely near the `Annotation` type). Move it to a new file `frontend/src/storage/contracts/annotation-store.ts`:

```ts
// storage/contracts/annotation-store.ts
import type { Annotation } from '../../engines/annotation-engine';

export interface AnnotationStore {
  get(id: string): Promise<Annotation | null>;
  list(filter?: { targetKind?: string; targetId?: string }): Promise<Annotation[]>;
  create(input: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation>;
  update(id: string, patch: Partial<Annotation>): Promise<Annotation>;
  remove(id: string): Promise<boolean>;
}
```

Update `frontend/src/storage/contracts/index.ts` to add:
```ts
export * from './annotation-store';
```

Update `frontend/src/engines/annotation-engine.ts`:
```ts
// Replace the inline AnnotationStore interface declaration with:
export type { AnnotationStore } from '../storage/contracts/annotation-store';
```

(Re-export keeps existing imports of `AnnotationStore` from `engines/annotation-engine` working.)

### Part 3: Barrel

Create `frontend/src/storage/provider/index.ts` (will be expanded in Task 05). For now, just:
```ts
export * from './storage-provider';
```

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/provider/storage-provider.ts` | new |
| `frontend/src/storage/provider/index.ts` | new (barrel) |
| `frontend/src/storage/contracts/annotation-store.ts` | new (extracted) |
| `frontend/src/storage/contracts/index.ts` | modified (add annotation export) |
| `frontend/src/engines/annotation-engine.ts` | modified (import AnnotationStore from contracts, re-export for back-compat) |

## Verification

1. `cd frontend && bun run tsc --noEmit` — passes with zero errors.
2. `bun run lint` — no new warnings (the ESLint rule from Task 03 doesn't exist yet; ignore).
3. `grep -r "StorageProvider" frontend/src/` — only matches in `storage/provider/`.
4. `grep -r "AnnotationStore" frontend/src/` — matches in `storage/contracts/annotation-store.ts`, `storage/contracts/index.ts`, `engines/annotation-engine.ts` (re-export), and the existing `MemoryAnnotationStore` inline class in `lib/canvas-engine-bootstrap.ts` (will be moved in Task 02).

## Templates

- `templates/storage-provider.ts.template`
