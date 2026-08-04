# Task 10 — Parity test + migration roadmap

**Phase**: E (Roadmap + verification)
**Depends on**: Task 04 (getters exist), Task 09 (one store migrated as proof)
**Effort**: 1–2 hr
**Files touched**:
- `frontend/src/storage/__tests__/storage-provider.parity.test.ts` (new)
- `ROADMAP.md` (new, at the pack root)

## Context

The pack is functionally complete after Task 09, but two things are missing:
1. An automated test that asserts the back-compat getters are wired correctly (Task 04 was manual verification only).
2. A document that tells the next engineer which store to migrate next, in what order, and why.

This task adds both.

## Goal

1. Write a parity test that asserts `bag.XStore === bag.storage.XStore` for all 24 stores.
2. Write a parity test that asserts `getStorageProvider()` is a process singleton.
3. Write `ROADMAP.md` listing the remaining 23 stores in priority order with complexity estimates.

## Spec

### Part 1: Parity test

Create `frontend/src/storage/__tests__/storage-provider.parity.test.ts`:

```ts
// storage/__tests__/storage-provider.parity.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { getEngineBag } from '../../lib/canvas-engine-bootstrap';
import {
  getStorageProvider,
  __resetStorageProviderForTests,
} from '../provider';

describe('StorageProvider parity', () => {
  beforeEach(() => {
    __resetStorageProviderForTests();
  });

  describe('singleton invariant', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getStorageProvider();
      const b = getStorageProvider();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after __resetStorageProviderForTests', () => {
      const a = getStorageProvider();
      __resetStorageProviderForTests();
      const b = getStorageProvider();
      expect(a).not.toBe(b);
    });
  });

  describe('bag.XStore is the same object as storage.XStore (identity)', () => {
    // This is the critical test: it catches every wiring mistake in Task 04.
    // If a getter returns the wrong store, this test fails.

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

    for (const name of STORE_NAMES) {
      it(`bag.${name} === storage.${name}`, () => {
        const bag = getEngineBag();
        const storage = getStorageProvider();
        const bagStore = (bag as unknown as Record<string, unknown>)[name];
        const storageStore = (storage as unknown as Record<string, unknown>)[name];
        expect(bagStore).toBe(storageStore);
      });
    }
  });

  describe('provider name reflects env var', () => {
    it('defaults to memory', () => {
      delete process.env.VIVIM_STORAGE_PROVIDER;
      __resetStorageProviderForTests();
      expect(getStorageProvider().name).toBe('memory');
    });

    it('selects memory when VIVIM_STORAGE_PROVIDER=memory', () => {
      process.env.VIVIM_STORAGE_PROVIDER = 'memory';
      __resetStorageProviderForTests();
      expect(getStorageProvider().name).toBe('memory');
    });

    it('selects prisma when VIVIM_STORAGE_PROVIDER=prisma', () => {
      process.env.VIVIM_STORAGE_PROVIDER = 'prisma';
      __resetStorageProviderForTests();
      expect(getStorageProvider().name).toBe('prisma');
    });

    it('throws for unknown values', () => {
      process.env.VIVIM_STORAGE_PROVIDER = 'bogus';
      __resetStorageProviderForTests();
      expect(() => getStorageProvider()).toThrow(/Unknown VIVIM_STORAGE_PROVIDER/);
    });
  });
});
```

**Run the test**:

```bash
cd frontend
bun test src/storage/__tests__/storage-provider.parity.test.ts
```

Expected: all 30 tests pass (1 singleton + 1 reset + 24 identity + 4 env-var).

### Part 2: Migration roadmap

Create `ROADMAP.md` at the pack root (i.e., `download/packs/vivim-storage-provider-centralization-v2/ROADMAP.md` — this is included in the pack, not in the vivim-final repo). The roadmap lists the remaining 23 stores in priority order.

Use this prioritization rubric:
- **Priority 1 (user data)**: stores that hold user-visible state the user would notice losing (workspaces, documents, providers, accounts).
- **Priority 2 (config state)**: stores that hold user-configurable settings (user-layout, capability-tier, shell-command, templates).
- **Priority 3 (transient state)**: stores that hold ephemeral state where loss is acceptable (notifications, presence, audit, search-index).
- **Priority 4 (engine internal)**: stores that hold engine-internal state where migration is complex (document-edit, z-layer, drawer, automation, agent, hitl-gate, policy-rule, annotation, media).

Within each priority, order by complexity (lower complexity first — early wins build momentum).

The roadmap doc (full content):

```markdown
# Storage Migration Roadmap

Status after vivim-storage-provider-centralization-v2: **1/24 stores migrated** (`onboardingStore`).

This roadmap lists the remaining 23 stores in priority order. Each entry has:
- **Priority**: 1 (user data) / 2 (config) / 3 (transient) / 4 (engine internal)
- **Complexity**: S (< 1 hr) / M (1–3 hr) / L (3–8 hr) / XL (1+ day)
- **Contract**: link to the contract file
- **Prisma model**: the model name to add to `schema.prisma`
- **Dependencies**: other stores that must be migrated first
- **Notes**: gotchas, design decisions, or open questions

## Priority 1 — User data (migrate first)

| # | Store | Complexity | Prisma model | Deps | Notes |
|---|---|---|---|---|---|
| 2 | `accountStore` | M | `Account` | — | Foundation for multi-user. |
| 3 | `providerStore` | M | `Provider` | accountStore | Stores user's provider instances (ChatGPT login, etc.). |
| 4 | `workspaceStore` | M | `Workspace` | accountStore | User's workspaces. |
| 5 | `documentStore` | L | `Document` | workspaceStore | Documents belong to workspaces. JSON content. |
| 6 | `mediaStore` | L | `Media` | workspaceStore | Stores binary blobs — decide: Prisma `Bytes` or filesystem + path reference. Recommend filesystem + path. |

## Priority 2 — Config state

| # | Store | Complexity | Prisma model | Deps | Notes |
|---|---|---|---|---|---|
| 7 | `userLayoutStore` | S | `UserLayout` | accountStore | Per-user layout prefs. Simple key-value. |
| 8 | `capabilityTierStore` | S | `CapabilityTier` | — | Static-ish catalog. Could be seed data, not Prisma. |
| 9 | `providerTypeStore` | S | `ProviderType` | — | Static catalog (ChatGPT, Claude, etc.). Seed data. |
| 10 | `uiComponentStore` | M | `UiComponent` | — | Registered UI components. JSON spec. |
| 11 | `canvasDefinitionStore` | M | `CanvasDefinition` | — | Canvas templates. JSON. |
| 12 | `primitiveStore` | M | `Primitive` | canvasDefinitionStore | Canvas primitive nodes. JSON. |
| 13 | `templateStore` | M | `WorkspaceTemplate` | workspaceStore | Workspace templates. JSON. |
| 14 | `shellCommandStore` | S | `ShellCommand` | — | Shell command catalog. Mostly static. |

## Priority 3 — Transient state (migrate last, or skip)

| # | Store | Complexity | Prisma model | Deps | Notes |
|---|---|---|---|---|---|
| 15 | `notificationStore` | M | `Notification` | accountStore | User notifications. TTL recommended. |
| 16 | `auditStore` | M | `AuditEntry` | accountStore | Audit log. Append-only. |
| 17 | `presenceStore` | S | `Presence` | accountStore | Real-time presence. Consider Redis instead of Prisma. |
| 18 | `searchIndex` | XL | — | documentStore, mediaStore, automationStore, agentStore, workspaceStore, providerStore | Search index. **Don't use Prisma** — use SQLite FTS5 or a dedicated search engine. Keep as `MemorySearchIndex` or move to FTS. |

## Priority 4 — Engine internal (complex)

| # | Store | Complexity | Prisma model | Deps | Notes |
|---|---|---|---|---|---|
| 19 | `annotationStore` | M | `Annotation` | documentStore | Annotations on documents/canvas nodes. |
| 20 | `automationStore` | L | `Automation` + `AutomationRun` | workspaceStore | Automation definitions + run history. Two models. |
| 21 | `agentStore` | L | `Agent` | workspaceStore | Agent definitions. |
| 22 | `hitlGateStore` | M | `HitlGate` | agentStore | HITL gates. Belongs to agents. |
| 23 | `policyRuleStore` | M | `PolicyRule` | agentStore | Policy rules. Belongs to agents. |
| 24 | `documentEditStore` | XL | `DocumentEditSession` + `DocumentEditOp` | documentStore | Edit history (undo/redo stack). High write volume — consider event sourcing. |
| 25 | `zLayerStore` | S | `ZLayer` | workspaceStore | Z-layer state. Small. |
| 26 | `drawerStore` | S | `Drawer` | workspaceStore | Drawer panel state. Small. |

## Recommended migration order (top 5)

1. `accountStore` (P1, M) — unblocks all other user-data migrations.
2. `providerStore` (P1, M) — second-most-important user data.
3. `workspaceStore` (P1, M) — unblocks document/media.
4. `userLayoutStore` (P2, S) — quick win, validates the pattern on a simple store.
5. `notificationStore` (P3, M) — high user-visible value, moderate complexity.

## Migration template (per store)

For each migration, follow this checklist (mirrors v1-Task-09 and v2-Task-09):

1. Add the Prisma model to `frontend/prisma/schema.prisma`.
2. Run `bun x prisma migrate dev --name <model_name>`.
3. Create `frontend/src/storage/impl/prisma-<name>-store.ts` implementing the contract.
4. Export it from `frontend/src/storage/impl/index.ts`.
5. In `frontend/src/storage/provider/prisma-storage-provider.ts`, replace the `NotImplementedErrorProxy` for that store with `new PrismaXStore()`.
6. Run `bun run storage:inspect` — confirm the store now reports `ready: true`.
7. Run `VIVIM_STORAGE_PROVIDER=prisma bun run dev` and exercise the relevant API routes.
8. Run the parity test (`bun test src/storage/__tests__/storage-provider.parity.test.ts`) — should still pass.
9. Update `ROADMAP.md` — increment the migrated count.

## When all 24 are migrated

- Delete `MemoryStorageProvider` (or keep for tests).
- Delete the back-compat getters from `CanvasEngineBag` (Task 04's cleanup).
- Delete `MemoryXStore` files (or keep for tests).
- Make `VIVIM_STORAGE_PROVIDER=prisma` the default in `.env.example`.
- Remove the `no-restricted-imports` ESLint exemption for `canvas-engine-bootstrap.ts` (it should no longer import impls directly).
```

### Part 3: Run the full verification

Run `verification/acceptance-checklist.md` end-to-end. All checks should pass.

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/__tests__/storage-provider.parity.test.ts` | new |
| `ROADMAP.md` (in the pack, not the repo) | new |

## Verification

1. `bun test src/storage/__tests__/storage-provider.parity.test.ts` — all 30 tests pass.
2. `ROADMAP.md` exists in the pack and lists all 23 remaining stores.
3. `verification/acceptance-checklist.md` passes end-to-end.

## Common pitfalls

- **Test isolation**: the `__resetStorageProviderForTests` call in `beforeEach` is critical — without it, tests share state and the singleton test passes for the wrong reason. Always reset.
- **Env var leakage**: tests that set `process.env.VIVIM_STORAGE_PROVIDER` must clean up (or use `beforeEach` to reset). The `delete process.env.VIVIM_STORAGE_PROVIDER` in the "defaults to memory" test handles this for that one test; for the others, the `beforeEach` reset is enough because `getStorageProvider()` reads env at call time.
- **Running the test with `VIVIM_STORAGE_PROVIDER=prisma`**: if you have `=prisma` set in your shell, the singleton test fails (the second call returns the prisma provider, not memory). Always run tests with a clean env: `unset VIVIM_STORAGE_PROVIDER; bun test ...`.
