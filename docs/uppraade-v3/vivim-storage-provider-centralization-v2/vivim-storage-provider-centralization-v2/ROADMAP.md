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
