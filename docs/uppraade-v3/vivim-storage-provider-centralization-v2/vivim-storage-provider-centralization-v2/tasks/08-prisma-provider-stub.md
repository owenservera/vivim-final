# Task 08 — Stub `PrismaStorageProvider`

**Phase**: C (New value)
**Depends on**: Task 01 (needs `StorageProvider` interface)
**Effort**: 30 min
**Files touched**:
- `frontend/src/storage/provider/prisma-storage-provider.ts` (new)
- `frontend/src/storage/provider/index.ts` (uncomment the `prisma` case)

## Context

`MemoryStorageProvider` works, but the goal of this whole pack is to enable the Prisma swap. Task 09 fills in `onboardingStore` with v1's `PrismaOnboardingStore` as proof. Before that, we need the scaffolding: a `PrismaStorageProvider` class that implements the interface, with all 24 properties stubbed to throw `NotImplementedError`.

This task is small but high-value because it:
- Lets us validate the env-driven swap mechanism end-to-end (Task 09 proves it).
- Makes migration progress visible via `/api/storage/health` (each stub reports `NotImplementedErrorProxy`).
- Gives the next 23 migrations a clear pattern to follow.

## Goal

1. Create `PrismaStorageProvider` implementing `StorageProvider`.
2. Use a `NotImplementedErrorProxy` helper for the 23 unimplemented stores (so we don't write 23 × ~5 method stubs by hand).
3. Wire `case 'prisma'` in `getStorageProvider()`.
4. Verify `VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect` boots and lists 23 stubs.

## Spec

### Part 1: Create the `NotImplementedErrorProxy` helper

Inside `prisma-storage-provider.ts` (or a separate `not-implemented-proxy.ts` if you prefer), define:

```ts
// storage/provider/not-implemented-proxy.ts
/**
 * Proxy that throws NotImplementedError on first method access.
 * Used by PrismaStorageProvider for unimplemented stores.
 *
 * The proxy duck-types as the store interface (any method call works),
 * but throws on invocation. This lets /api/storage/health detect it
 * via the `__notImplemented` marker property.
 */
export class NotImplementedErrorProxy<T extends object> {
  readonly __notImplemented = true as const;
  readonly __message: string;

  constructor(
    readonly storeName: string,
    readonly implClassName: string,
  ) {
    this.__message =
      `${implClassName} is not implemented yet. ` +
      `Store "${storeName}" cannot be used with VIVIM_STORAGE_PROVIDER=prisma. ` +
      `See ROADMAP.md for migration status.`;
  }

  private throw_(): never {
    throw new NotImplementedError(this.__message);
  }

  // The proxy handler intercepts any property access.
  // We use a Proxy to make this work for any interface.
  static create<T extends object>(storeName: string, implClassName: string): T {
    const proxy = new NotImplementedErrorProxy<T>(storeName, implClassName);
    return new Proxy(proxy, {
      get(target, prop, receiver) {
        // Allow internal markers to pass through.
        if (prop === '__notImplemented' || prop === '__message' || prop === 'storeName' || prop === 'implClassName') {
          return Reflect.get(target, prop, receiver);
        }
        // Any other property access returns a function that throws.
        return (..._args: unknown[]) => {
          target.throw_();
        };
      },
    }) as unknown as T;
  }
}

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}
```

### Part 2: Create `PrismaStorageProvider`

Create `frontend/src/storage/provider/prisma-storage-provider.ts` using `templates/prisma-storage-provider.ts.template`:

```ts
// storage/provider/prisma-storage-provider.ts
import type { StorageProvider } from './storage-provider';
import { NotImplementedErrorProxy } from './not-implemented-proxy';
// Task 09 will uncomment this:
// import { PrismaOnboardingStore } from '../impl/prisma-onboarding-store';

/**
 * Prisma-backed StorageProvider.
 *
 * STATUS: 0/24 stores migrated (Task 09 brings it to 1/24).
 * See ROADMAP.md for the migration plan.
 *
 * Each unimplemented store is a NotImplementedErrorProxy that throws on
 * first method call. /api/storage/health detects this via the
 * __notImplemented marker and reports it as `ready: false`.
 */
export class PrismaStorageProvider implements StorageProvider {
  readonly name = 'prisma' as const;

  // Phase 1 — all stubs
  readonly uiComponentStore = NotImplementedErrorProxy.create(
    'uiComponentStore', 'PrismaUiComponentStore',
  );
  readonly providerTypeStore = NotImplementedErrorProxy.create(
    'providerTypeStore', 'PrismaProviderTypeStore',
  );
  readonly primitiveStore = NotImplementedErrorProxy.create(
    'primitiveStore', 'PrismaPrimitiveStore',
  );
  readonly providerStore = NotImplementedErrorProxy.create(
    'providerStore', 'PrismaProviderStore',
  );
  readonly accountStore = NotImplementedErrorProxy.create(
    'accountStore', 'PrismaAccountStore',
  );
  readonly capabilityTierStore = NotImplementedErrorProxy.create(
    'capabilityTierStore', 'PrismaCapabilityTierStore',
  );
  readonly userLayoutStore = NotImplementedErrorProxy.create(
    'userLayoutStore', 'PrismaUserLayoutStore',
  );
  readonly canvasDefinitionStore = NotImplementedErrorProxy.create(
    'canvasDefinitionStore', 'PrismaCanvasDefinitionStore',
  );

  // Phase 2 — all stubs
  readonly workspaceStore = NotImplementedErrorProxy.create(
    'workspaceStore', 'PrismaWorkspaceStore',
  );
  readonly documentStore = NotImplementedErrorProxy.create(
    'documentStore', 'PrismaDocumentStore',
  );
  readonly mediaStore = NotImplementedErrorProxy.create(
    'mediaStore', 'PrismaMediaStore',
  );
  readonly automationStore = NotImplementedErrorProxy.create(
    'automationStore', 'PrismaAutomationStore',
  );
  readonly agentStore = NotImplementedErrorProxy.create(
    'agentStore', 'PrismaAgentStore',
  );
  readonly hitlGateStore = NotImplementedErrorProxy.create(
    'hitlGateStore', 'PrismaHitlGateStore',
  );
  readonly policyRuleStore = NotImplementedErrorProxy.create(
    'policyRuleStore', 'PrismaPolicyRuleStore',
  );
  readonly annotationStore = NotImplementedErrorProxy.create(
    'annotationStore', 'PrismaAnnotationStore',
  );
  readonly shellCommandStore = NotImplementedErrorProxy.create(
    'shellCommandStore', 'PrismaShellCommandStore',
  );

  // Phase 3 — onboardingStore filled in Task 09; rest are stubs
  readonly notificationStore = NotImplementedErrorProxy.create(
    'notificationStore', 'PrismaNotificationStore',
  );
  readonly auditStore = NotImplementedErrorProxy.create(
    'auditStore', 'PrismaAuditStore',
  );
  readonly rbacStore = NotImplementedErrorProxy.create(
    'rbacStore', 'PrismaRbacStore',
  );
  readonly templateStore = NotImplementedErrorProxy.create(
    'templateStore', 'PrismaWorkspaceTemplateStore',
  );
  readonly presenceStore = NotImplementedErrorProxy.create(
    'presenceStore', 'PrismaPresenceStore',
  );
  readonly searchIndex = NotImplementedErrorProxy.create(
    'searchIndex', 'PrismaSearchIndex',
  );
  // readonly onboardingStore = new PrismaOnboardingStore();  // Task 09
  readonly onboardingStore = NotImplementedErrorProxy.create(
    'onboardingStore', 'PrismaOnboardingStore',
  ); // placeholder until Task 09

  // Phase 4 — all stubs
  readonly documentEditStore = NotImplementedErrorProxy.create(
    'documentEditStore', 'PrismaDocumentEditStore',
  );
  readonly zLayerStore = NotImplementedErrorProxy.create(
    'zLayerStore', 'PrismaZLayerStore',
  );
  readonly drawerStore = NotImplementedErrorProxy.create(
    'drawerStore', 'PrismaDrawerStore',
  );
}
```

### Part 3: Wire `case 'prisma'` in `getStorageProvider()`

Update `frontend/src/storage/provider/index.ts`:

```ts
// At the top:
import { PrismaStorageProvider } from './prisma-storage-provider';

// In the switch:
case 'prisma':
  _provider = new PrismaStorageProvider();
  break;
```

Delete the throw that was there as a placeholder.

### Part 4: Verify

```bash
cd frontend
VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect
```

Expected: the table prints with `provider: prisma`, all 24 stores showing `impl: NotImplementedErrorProxy`, `ready: NO`, exit code 1.

```bash
VIVIM_STORAGE_PROVIDER=prisma bun run dev
curl localhost:3000/api/storage/health | jq .
```

Expected: JSON with `provider: "prisma"`, all stores showing `impl: "NotImplementedErrorProxy"`, `ready: false`, `migrationProgress: { migrated: 0, total: 24, pct: 0 }`.

```bash
VIVIM_STORAGE_PROVIDER=prisma curl localhost:3000/api/onboarding/state?userId=user:demo
```

Expected: 500 error with message like `"NotImplementedError: PrismaOnboardingStore is not implemented yet..."` (until Task 09 fills it in).

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/provider/not-implemented-proxy.ts` | new |
| `frontend/src/storage/provider/prisma-storage-provider.ts` | new |
| `frontend/src/storage/provider/index.ts` | modified (uncomment prisma case) |

## Verification

1. `bun run tsc --noEmit` — passes.
2. `VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect` exits 1 and lists 24 stubs.
3. `VIVIM_STORAGE_PROVIDER=memory bun run storage:inspect` exits 0 (unchanged behavior).
4. `VIVIM_STORAGE_PROVIDER=prisma bun run dev` boots (the app doesn't crash at startup; only when an unmigrated store is actually called).
5. `curl localhost:3000/api/storage/health` (with `=prisma`) returns 200 with the migration progress at 0%.

## Templates

- `templates/prisma-storage-provider.ts.template`

## Common pitfalls

- **Proxy `get` trap returning a function for non-function properties**: if the contract has a property that's not a method (e.g., a `readonly` config), the proxy will return a function that throws when accessed. Fix: extend the trap to return `undefined` for known non-method properties, or check `typeof target[prop]` first. For the current 24 contracts, all properties are methods, so this isn't an issue.
- **Forgetting to update the index.ts barrel**: if `PrismaStorageProvider` isn't exported from `storage/provider/index.ts`, the `case 'prisma'` import fails.
- **Coupling `NotImplementedErrorProxy` to specific contracts**: the proxy is generic (`<T extends object>`). Don't import contract types into `not-implemented-proxy.ts`.
