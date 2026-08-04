# 01 — Audit: Current Storage Layer

## Inventory

The vivim-final frontend has **24 storage contracts** in `frontend/src/storage/contracts/`, each with a corresponding in-memory impl in `frontend/src/storage/impl/`. They were added in four phases:

### Phase 1 (8 stores) — core canvas
| Contract | Memory impl | Purpose |
|---|---|---|
| `UiComponentStore` | `MemoryUiComponentStore` | Registered UI component definitions |
| `ProviderTypeStore` | `MemoryProviderTypeStore` | Provider type registry (ChatGPT, Claude, etc.) |
| `PrimitiveStore` | `MemoryPrimitiveStore` | Canvas primitive nodes |
| `ProviderStore` | `MemoryProviderStore` | Provider instances (user accounts) |
| `AccountStore` | `MemoryAccountStore` | User accounts |
| `CapabilityTierStore` | `MemoryCapabilityTierStore` | Capability tier definitions |
| `UserLayoutStore` | `MemoryUserLayoutStore` | Per-user layout preferences |
| `CanvasDefinitionStore` | `MemoryCanvasDefinitionStore` | Canvas definitions (templates) |

### Phase 2 (8 stores) — workspace OS
| Contract | Memory impl | Purpose |
|---|---|---|
| `WorkspaceStore` | `MemoryWorkspaceStore` | Workspaces |
| `DocumentStore` | `MemoryDocumentStore` | Documents |
| `MediaStore` | `MemoryMediaStore` | Media assets |
| `AutomationStore` | `MemoryAutomationStore` | Automation definitions |
| `AgentStore` (+ `HitlGateStore` + `PolicyRuleStore`) | `MemoryAgentStore` (+ Hitl + Policy) | Agents + HITL gates + policy rules (3 contracts in one file) |
| `ShellCommandStore` | `MemoryShellCommandStore` | Shell command catalog |
| `AnnotationStore` | `MemoryAnnotationStore` (defined inline in `canvas-engine-bootstrap.ts`, not in `storage/impl/`) | Annotations |

### Phase 3 (7 stores) — UX enhancement
| Contract | Memory impl | Purpose |
|---|---|---|
| `NotificationStore` | `MemoryNotificationStore` | In-app notifications |
| `AuditStore` | `MemoryAuditStore` | Audit log entries |
| `RbacStore` | `MemoryRbacStore` | RBAC roles + memberships |
| `WorkspaceTemplateStore` | `MemoryWorkspaceTemplateStore` | Workspace templates |
| `PresenceStore` | `MemoryPresenceStore` | Real-time presence |
| `SearchIndex` | `MemorySearchIndex` | Search index |
| `OnboardingStore` | `MemoryOnboardingStore` (+ `PrismaOnboardingStore` from v1, but not wired) | Onboarding tour state |

### Phase 4 (3 stores) — doc suite
| Contract | Memory impl | Purpose |
|---|---|---|
| `DocumentEditStore` | `MemoryDocumentEditStore` | Document edit operations (undo/redo stack) |
| `ZLayerStore` | `MemoryZLayerStore` | Z-layer state |
| `DrawerStore` | `MemoryDrawerStore` | Drawer panel state |

**Total: 24 contracts.** (AnnotationStore is the 24th — it lives inline in `canvas-engine-bootstrap.ts` instead of its own file, which is one of the smells this pack fixes.)

## How stores are acquired today

### 1. The bootstrap file owns everything

`frontend/src/lib/canvas-engine-bootstrap.ts` (378 lines) is the **single owner** of all 24 store instances. It:

1. Imports all 24 memory classes directly:
   ```ts
   import {
     MemoryAccountStore,
     MemoryAgentStore,
     // ... 22 more
   } from '../storage/impl';
   ```

2. Instantiates each one inline:
   ```ts
   const uiComponentStore = new MemoryUiComponentStore();
   const providerTypeStore = new MemoryProviderTypeStore();
   // ... 22 more
   ```

3. Types each one as its **concrete class** on the `CanvasEngineBag` interface:
   ```ts
   export interface CanvasEngineBag {
     uiComponentStore: MemoryUiComponentStore;
     providerTypeStore: MemoryProviderTypeStore;
     // ... 22 more
   }
   ```

4. Returns the bag from a process-singleton `getEngineBag()`.

### 2. Engines consume the bag, but read stores via contract

Engines (e.g., `NotificationEngine`) declare their store dependency as the **contract interface**, not the memory class:

```ts
// engines/notification-engine.ts
import type { NotificationStore } from '../storage/contracts/notification-store';

export interface NotificationEngineDeps {
  notificationStore: NotificationStore;  // contract, not MemoryNotificationStore
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}
```

This is good — engines are already impl-agnostic. The bootstrap then passes the memory impl in:

```ts
const notificationEngine = new NotificationEngine({
  notificationStore,  // typed as MemoryNotificationStore, but accepted because it satisfies the contract
  eventBus,
  logger,
});
```

### 3. API routes consume the bag directly

```ts
// app/api/onboarding/state/route.ts
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET(req: Request) {
  const bag = getEngineBag();
  const state = await bag.onboardingStore.get(userId);
  // ...
}
```

API routes reach into the bag for the store. They type the store as the memory class (via the bag's type), but they only call contract methods — so they're effectively contract-consuming too.

## Smells in the current design

### Smell 1: No swap mechanism, despite the comment claiming one

`canvas-engine-bootstrap.ts` line 6 says:
> *"Production swaps the memory impls for Prisma impls (still via the same contracts)."*

But there is no mechanism to do this. To swap `MemoryOnboardingStore` for `PrismaOnboardingStore`, you'd have to:

1. Edit the import in `canvas-engine-bootstrap.ts`.
2. Edit the `const onboardingStore = new MemoryOnboardingStore()` line.
3. Edit the `onboardingStore: MemoryOnboardingStore` type on `CanvasEngineBag`.

Three edits per store × 24 stores = 72 edits to fully migrate. And the type change on `CanvasEngineBag` would ripple to every consumer that destructures `bag.onboardingStore` if they relied on memory-specific methods (which they shouldn't, but TypeScript will complain).

v1 already proved this painful: Task 09 was supposed to swap `MemoryOnboardingStore` for `PrismaOnboardingStore`, and the only way to do it was a hardcoded `if (process.env.NODE_ENV === 'production')` check. That doesn't scale.

### Smell 2: `AnnotationStore` is defined inline in the bootstrap

`MemoryAnnotationStore` is defined as a private class inside `canvas-engine-bootstrap.ts` (lines 71–101) instead of in its own file under `storage/impl/`. This was probably an oversight during Phase 2. It means:

- The contract `AnnotationStore` is imported from `engines/annotation-engine.ts` (where it's declared) instead of `storage/contracts/`.
- The impl can't be swapped without editing the bootstrap file.
- The impl can't be tested in isolation.

### Smell 3: The `CanvasEngineBag` interface is 64 lines of store declarations

Lines 103–167 of `canvas-engine-bootstrap.ts` are the `CanvasEngineBag` interface, and ~50 of those lines are store declarations. Every time a store is added, this interface grows. Every consumer that destructures the bag has TypeScript re-check all 50 lines.

### Smell 4: No way to inspect storage health

There is no endpoint or CLI that answers "what impl is each store using right now?" or "how many rows are in each store?". To debug a storage issue today, you have to:
1. Read `canvas-engine-bootstrap.ts` to figure out which impl is wired.
2. Read the impl file to figure out its in-memory shape.
3. Add a `console.log` somewhere and hope you catch the right request.

This is unacceptable for a local-first desktop app where the user's data is at stake.

### Smell 5: No migration path from memory to Prisma

Even if every store had a `PrismaXStore` impl tomorrow, there's no way to move existing in-memory data into Prisma. The app would lose all state on the swap. A `storage:migrate` CLI that reads from the memory provider and writes to the Prisma provider (per-store, with a progress bar) is needed — but it can't exist until there's a provider abstraction to call it against.

## What doesn't smell (and shouldn't be touched)

- **The contracts** (`storage/contracts/*-store.ts`) are well-designed: each is a small interface with 4–10 methods, no leaks of impl details. Don't touch them.
- **The memory impls** (`storage/impl/memory-*-store.ts`) are correct and well-tested. Don't touch them either — this pack wraps them, doesn't rewrite them.
- **The engine pattern** (consume contract via deps) is right. Don't touch it.
- **The `getEngineBag()` singleton** is right (process-singleton, memoized). The pack keeps this pattern; it just changes what the bag contains.
- **The API route pattern** (call `getEngineBag()`, destructure store, call methods) is right. The pack keeps this pattern via back-compat getters.

## Summary

The storage layer's contracts and impls are sound. The problem is the **wiring layer** in `canvas-engine-bootstrap.ts`: it's a 378-line file that hardcodes 24 concrete classes, types them as concretes on a public interface, and offers no swap mechanism. This pack inserts one indirection (`StorageProvider`) between the bootstrap and the impls, which collapses the wiring to ~10 lines and makes the swap trivial.
