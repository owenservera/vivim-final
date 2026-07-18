# Parallel Agent Execution Plan — 2026-07-16

**Context:** [Production Readiness Audit](./2026-07-16-production-readiness.md) — 232 items, 25 categories, 4 deep dives.  
**Strategy:** 1 Phase-1 agent (schema) + 6 Phase-2 agents (true parallel, zero file conflicts).  
**Safety constraint:** No two agents touch the same file. File ownership is exclusive per agent.

---

## File Ownership Map

```
prisma/schema.prisma              → A only
src/storage/contracts/*           → A only
src/storage/impl/*                → A (consumed by all via contracts)
src/executor/*                    → C only
src/engines/chrome-governor.ts    → C only
src/engines/composer-typing.ts    → C only
src/engines/provider-selectors.ts → C only
src/engines/conversation-manager.ts → C only
src/server/index.ts               → G only (wiring)
web/ui/src/**                     → B only
src/canvas/**                     → B only
shared/canvas-types.ts            → B only
shared/ui-component.ts            → B (read-only, E reads)
shared/conceptual-model.ts        → B (read-only, D reads)
src/engines/plugin-system.ts      → D only
src/engines/plugin-hot-reload.ts  → D only
src/engines/provider-registrar.ts → D only
seeds/providers/*.json            → D only
seeds/conceptual-model/seed.ts    → D only (component seeds)
src/engines/knowledge-*.ts        → E only
src/engines/memory-*.ts           → E only
src/engines/semantic-search.ts    → E only
src/engines/conversation-organizer.ts → E only
seeds/adapters/*                  → E only
src/engines/workflow-*.ts         → F only
src/automation/**                 → F only
src/engines/execution-policy.ts   → F only
src/engines/autonomous-execution.ts → F only
src/engines/encryption.ts         → G only
src/engines/db-encryption.ts      → G only
src/engines/lock-manager.ts       → G only
src/engines/idempotency-guard.ts  → G only
src/engines/retry-engine.ts       → G only
src/engines/export.ts             → G only
src/engines/sync.ts               → G only
src/engines/backup-scheduler.ts   → G only
src/engines/logger.ts             → G only
src/engines/kernel/**             → G only
src/errors.ts                     → G only
tests/unit/engines/               → each agent owns their test dir
docs/                             → B (canvas docs), G (architecture docs)
```

---

## PHASE 1 — Schema & Storage Hardening [Agent A]

**Runs first. No other agent starts until A completes.**  
All Phase 2 agents read the updated schema as input.

### Pre-Read Files (estimated ~25K tokens)

| File | Purpose |
|---|---|
| `prisma/schema.prisma` (2635 lines) | Full schema — all 54 tables |
| `src/storage/db.ts` | CapStoreDb wrapper, pragma config, singleton |
| `src/storage/prisma.ts` | PrismaClient singleton, WAL init |
| `src/storage/store-factory.ts` | Backend selection |
| `prisma/views_002.sql` | Post-migration SQL views |
| `prisma/migrations/*/migration.sql` (all 14) | Existing migration history |
| `migrations/001_baseline.sql` | Orphaned raw SQL baseline |
| `src/config.ts` | Storage config flags |
| `src/engines/db-encryption.ts` | Encryption engine (read for wiring plan) |
| `src/engines/encryption.ts` | Encryption engine |
| `src/engines/backup-scheduler.ts` | Backup schedule types |

### Audit Items Owned

**§18 Database & Storage (all 10):** 18.1–18.10  
**Deep Dive B (all 20):** B.1–B.20

### Implementation Steps

1. **Consolidate migrations.** Remove `migrations/001_baseline.sql`. Add a Prisma migration that subsumes any missing DDL. Verify `prisma migrate deploy` produces the full schema.

2. **Add WAL checkpoint management.** In `configurePrisma()`, add periodic `PRAGMA wal_checkpoint(TRUNCATE)` call on a 60s interval. Expose `checkpointNow()` for shutdown.

3. **Add integrity check at boot.** In `createServerWithEngines`, after `configureDbPragmas(db)`, run `PRAGMA integrity_check` and log/fail fast on corruption.

4. **Add periodic optimize.** Schedule `PRAGMA optimize` daily via `BackupScheduler` or a simple `setInterval` with a `lastOptimized` timestamp in `SchemaMeta`.

5. **Add FTS5 virtual table.** Create `conversation_message_fts` covering `content` column. Add triggers to keep FTS in sync on INSERT/UPDATE/DELETE. Add `searchMessages(query)` to `CapStoreDb`.

6. **Resolve denormalization:**
   - `ProviderDefinition.capabilitiesJson` → mark as deprecated in schema comment. Add a `readCapabilities()` helper on `CapStoreDb` that queries `ProviderCapability` rows.
   - `ConversationMessage.blocksJson` → mark as deprecated. The `StreamBlock` table is the source of truth. Add a `getBlocks(messageId)` that queries `StreamBlock` and assembles `ContentBlock[]`.

7. **Add soft-delete columns.** Add `deletedAt BigInt?` to `Conversation`, `ConversationMessage`, `Project`, `Topic`. Add `isDeleted Int @default(0)` to `ProviderAccount`. Update list queries to filter `deletedAt IS NULL`. Add `trash` state to `Conversation.state`.

8. **Add `backup_entry` table.** Model: `id, scheduleId, filePath, sizeBytes, checksum, status, startedAt, completedAt, error`. Wire `BackupScheduler` to write rows.

9. **Fix NULL unique constraint.** On `ConfigEntry`, make `scopeId` non-nullable with default `'global'` so the `@@unique([engineId, scopeType, scopeId])` constraint works correctly in SQLite.

10. **Add configurable WAL tuning.** Read `CAP_STORE_MMAP_SIZE` and `CAP_STORE_CACHE_SIZE` env vars to override hardcoded 256MB/-64MB defaults.

11. **Fix encryption wiring.** Read `config.storage.encryptDb`. If true, construct `DbEncryptionEngine` + `EncryptionEngine` at bootstrap and inject into `CapStoreDb` as an optional encryption layer for `providerStateJson`, `WorkflowCredential.valueEncrypted`, and conversation content fields.

12. **Pre-migration backup.** Before `prisma migrate deploy`, run `VACUUM INTO 'backup-${timestamp}.db'` and verify the backup file exists with matching page count.

13. **Write tests.** `tests/unit/storage/db-integrity.test.ts` (integrity check, FTS search, soft delete), `tests/unit/storage/backup.test.ts`, `tests/unit/storage/encryption.test.ts`.

### Output Files

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `prisma/migrations/YYYYMMDDHHMMSS_production_hardening/migration.sql` |
| Modify | `src/storage/db.ts` |
| Create | `tests/unit/storage/db-integrity.test.ts` |
| Create | `tests/unit/storage/backup.test.ts` |
| Create | `tests/unit/storage/encryption.test.ts` |
| Delete | `migrations/001_baseline.sql` (absorb into Prisma migration) |

### Verification

- `bun run prisma:migrate:prod` succeeds on clean DB
- `bun run typecheck` passes
- `bun test tests/unit/storage/` all pass
- `PRAGMA integrity_check` returns `ok` at boot
- FTS search returns correct results for known queries

---

## PHASE 2 — Six Parallel Agents

**All six start simultaneously after Agent A completes.**  
**Zero file conflicts — each agent owns exclusive files.**

---

## Agent B: Canvas & UI Production

### Pre-Read Files (~18K tokens)

| File | Purpose |
|---|---|
| `shared/canvas-types.ts` | Canvas types: PrimitiveKind, LayerCategory, CanvasLayout, LayerBinding, CanvasDefinition, SandboxPolicy, LayerHost |
| `shared/ui-component.ts` | UiComponent types, UiComponentScope, row helpers |
| `shared/conceptual-model.ts` | ProviderType, Primitive, RegionRect, row helpers |
| `web/ui/src/features/canvas/CanvasSurface.tsx` | Main canvas renderer |
| `web/ui/src/features/canvas/SandboxedLayer.tsx` | Iframe sandbox renderer |
| `web/ui/src/features/canvas/BrowserLayerHost.tsx` | Layer host component |
| `web/ui/src/features/canvas/useZoomLevel.ts` | Zoom state |
| `web/ui/src/features/canvas/useCanvasEvents.ts` | Event bus subscriptions |
| `web/ui/src/features/canvas/useNodeTypes.tsx` | Node type registry |
| `web/ui/src/features/canvas/ZoomNode.tsx` | Zoom wrapper |
| `web/ui/src/features/canvas/ResultSlot.tsx` | Result rendering |
| `web/ui/src/features/canvas/StreamingSlot.tsx` | Streaming block rendering |
| `web/ui/src/features/canvas/useStreamBlocks.ts` | Stream block fetch hook |
| `web/ui/src/ui/registry.ts` | UIComponentRegistry |
| `web/ui/src/ui/slots.ts` | Slot definitions |
| `web/ui/src/ui/ui-component-renderer.tsx` | DB-loaded component renderer |
| `web/ui/src/ui/useSlot.ts` | Slot resolution hook |
| `web/ui/src/ui/defaults/` | System default components |
| `web/ui/src/App.tsx` | App shell |
| `src/canvas/canvas-engine.ts` | Canvas orchestrator |
| `src/canvas/types.ts` | Canvas engine types |
| `src/canvas/layer-mounter.ts` | Layer mount/dismount logic |
| `src/canvas/schema.ts` | Sandbox schema |
| `src/canvas/capability-bridge.ts` | Sandbox bridge |
| `src/engines/conceptual-model-service.ts` | 4-tier resolution |
| `src/engines/canvas-layer-mounter.ts` | Event-bus mounter |
| `docs/prd-canvas-unified-surface.md` | Canvas PRD |

### Audit Items Owned

**§1 Canvas & UI (14 items):** 1.1–1.14  
**§3 Component Library (11 items):** 3.6–3.11 (system defaults, preview, search, authoring, hot-swap, rollback)  
**§8 Sandbox Safety (9 items):** 8.1–8.9  
**§16 Frontend (11 items):** 16.1–16.11  
**§24 First-Run (4 items):** 24.1–24.4  
**§25 Accessibility (3 items):** 25.1–25.3

### Implementation Steps

1. **Add z-axis to all layout types.** Add `z: number` to `RegionRect` in `shared/conceptual-model.ts`, `CanvasLayout` in `shared/canvas-types.ts`, and `LayerDefinition.layout` in `src/engines/canvas-layer-mounter.ts`. Default `z: 0`. Backfill existing components.

2. **Add depth-sorting to canvas renderer.** In `CanvasSurface.tsx`, sort mounted layers by `z` before render. Use CSS `z-index` or Three.js CSS3DRenderer for true 3D perspective. Add perspective transform on viewport container.

3. **Add layer CRUD.** Create `POST/PUT/DELETE /api/canvas/layers` routes. A layer has: `id, name, z, visible, locked, backgroundColor, defaultComponents[]`. Persist to a new `canvas_layer` JSON column on `WorkspaceMode`.

4. **Add layer-scoped spawning.** When spawning a component, require `layerId`. The spawned component inherits the layer's z and renders inside it. On layer dismiss, dismiss all child components.

5. **Add drag-to-reposition.** In `BrowserLayerHost.tsx`, make every layer header draggable. On drag end, update `CanvasLayout.x/y` via `PATCH /api/canvas/layers/:id/layout`. Emit `canvas:layer:moved` event.

6. **Add resize handles.** Add 8-point resize handles to every layer. On resize, update `CanvasLayout.w/h`.

7. **Add minimap.** Create `MinimapNode.tsx` — renders a scaled-down view of all layers as colored rectangles. Click to jump to layer. Positioned in bottom-right corner.

8. **Add undo/redo.** Create `useCanvasHistory.ts` hook with a command pattern stack: `{undo: () => void, redo: () => void}[]`. Push commands on spawn, dismiss, move, resize. Wire Ctrl+Z / Ctrl+Shift+Z.

9. **Add error boundaries.** Wrap `SandboxedLayer`, `BrowserLayerHost`, and each `UiComponent` iframe in React error boundaries. On crash, show error state with "Reload Component" button. Emit `canvas:layer:error` event.

10. **Add loading/empty states.** Show skeleton while layer mounts. Show "Empty layer — drag components here" when layer has no components. Show "Welcome to VIVIM" on first run with a "Create Workspace" CTA.

11. **Sandbox hardening:**
    - Default CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'` (allow inline because UiComponent.html uses inline scripts — fix the `allowInlineScript: false` type contradiction)
    - Per-component capability allowlist: when `SandboxBridge` receives a capability call, check `layer.sandbox.allowCapabilities` before forwarding
    - Watchdog timer: if iframe doesn't respond to a `ping` postMessage within 5s, kill and reload the iframe
    - Audit sandbox violations: write to `SandboxAudit` table on CSP violation, capability deny, or crash

12. **Populate system default components.** In `web/ui/src/ui/defaults/`, create one default per primitive kind: `DefaultChat.tsx`, `DefaultProjects.tsx`, `DefaultKnowledge.tsx`, `DefaultAgents.tsx`, `DefaultProviders.tsx`, `DefaultWorkspace.tsx`, `DefaultSettings.tsx`. Register in `UIComponentRegistry` as fallback when `fromSystemDefault: true`.

13. **Hot-swap UI components at runtime.** When `POST /api/conceptual/resolve` returns a different `UiComponent` for a slot, the frontend `useSlot` hook must re-render with the new component without page reload. Subscribe to `config:changed` event filtered by component resolution changes.

14. **Add keyboard shortcuts.** Create `useKeyboardShortcuts.ts` reading from `UnifiedCapability.ui.shortcut`. Register global keydown handler. Show shortcut overlay (press `?`).

15. **Add dark/light theme.** Create `ThemeProvider.tsx` with CSS variable switching. Persist preference to `UserPreference` table. Every `UiComponent` iframe receives the current theme via postMessage.

16. **Add first-run wizard.** On first launch (`WorkspaceMode` row doesn't exist), show guided flow: Welcome → Install Providers → Set Up Workspace → Import Conversations → Done. Each step is a layer on the canvas.

17. **Write tests.** `tests/unit/canvas/layer-crud.test.ts`, `tests/unit/canvas/sandbox-safety.test.ts`, `tests/unit/canvas/undo-redo.test.ts`.

### Output Files

| Action | File |
|---|---|
| Modify | `shared/canvas-types.ts` |
| Modify | `shared/conceptual-model.ts` |
| Modify | `web/ui/src/features/canvas/CanvasSurface.tsx` |
| Modify | `web/ui/src/features/canvas/SandboxedLayer.tsx` |
| Modify | `web/ui/src/features/canvas/BrowserLayerHost.tsx` |
| Create | `web/ui/src/features/canvas/MinimapNode.tsx` |
| Create | `web/ui/src/features/canvas/useCanvasHistory.ts` |
| Create | `web/ui/src/features/canvas/useKeyboardShortcuts.ts` |
| Create | `web/ui/src/features/canvas/ErrorBoundary.tsx` |
| Create | `web/ui/src/features/canvas/LoadingSkeleton.tsx` |
| Create | `web/ui/src/features/canvas/WelcomeOverlay.tsx` |
| Create | `web/ui/src/features/canvas/FirstRunWizard.tsx` |
| Create | `web/ui/src/features/canvas/ThemeProvider.tsx` |
| Create | `web/ui/src/ui/defaults/DefaultChat.tsx` |
| Create | `web/ui/src/ui/defaults/DefaultProjects.tsx` |
| Create | `web/ui/src/ui/defaults/DefaultKnowledge.tsx` |
| Create | `web/ui/src/ui/defaults/DefaultAgents.tsx` |
| Create | `web/ui/src/ui/defaults/DefaultProviders.tsx` |
| Create | `web/ui/src/ui/defaults/DefaultWorkspace.tsx` |
| Create | `web/ui/src/ui/defaults/DefaultSettings.tsx` |
| Create | `tests/unit/canvas/layer-crud.test.ts` |
| Create | `tests/unit/canvas/sandbox-safety.test.ts` |
| Create | `tests/unit/canvas/undo-redo.test.ts` |

### Verification

- Canvas renders with z-depth (layers overlap correctly)
- Drag/resize/minimap all functional
- Ctrl+Z undoes last action, Ctrl+Shift+Z redoes
- Error in one iframe doesn't crash canvas
- First run shows welcome wizard, second run goes straight to canvas
- Theme toggle switches dark/light across all layers
- `bun run typecheck` passes, `bun test tests/unit/canvas/` all pass

---

## Agent C: Chrome Harness Consolidation

### Pre-Read Files (~22K tokens)

| File | Purpose |
|---|---|
| `src/executor/fleet-supervisor.ts` (488 lines) | Fleet lifecycle, spawn, health, circuit breaker |
| `src/executor/cdp-transport.ts` (581 lines) | CDP transport, session mgmt, capture streaming |
| `src/executor/launcher.ts` (204 lines) | Chrome launch, port allocation, kill |
| `src/executor/chrome-instance-profile.ts` (206 lines) | Channel/mode profiles, binary resolution, args |
| `src/executor/profile-allocator.ts` (176 lines) | Profile directory mgmt |
| `src/executor/slave-states.ts` (94 lines) | State machine, transitions, backoff |
| `src/executor/cdp.ts` (273 lines) | BunCdpClient WebSocket client |
| `src/executor/cdp-types.ts` | CDP type definitions |
| `src/executor/port-reaper.ts` | Port cleanup |
| `src/engines/chrome-governor.ts` (1021 lines) | Governor, CDPProxy, HealthMonitor, TraceLog |
| `src/engines/composer-typing.ts` (223 lines) | Composer typing strategies |
| `src/engines/provider-selectors.ts` (120 lines) | Hardcoded selectors |
| `src/engines/conversation-manager.ts` (980 lines) | 8-step send pipeline |
| `src/server/index.ts` (lines 200-350, bootstrap wiring) | How governor is wired |

### Audit Items Owned

**§13 Chrome/CDP (10 items):** 13.1–13.10  
**Deep Dive A (17 items):** A.1–A.17  
**§11 items touching send:** 11.4, 11.5, 11.7, 11.11

### Implementation Steps

1. **Consolidate to single fleet authority.** Remove `HealthMonitor` class from `chrome-governor.ts`. Remove `CircuitBreaker` interface + free functions from `chrome-governor.ts`. The `FleetSupervisor` is the sole owner of: instance lifecycle, health probes, circuit breaker state. `ChromeGovernor` delegates all fleet ops to `FleetSupervisor` through the `FleetSupervisorContract` interface.

2. **Fix the `slaves` getter.** Replace the derived-map getter with a `Map<string, ChromeSlave>` that is updated by event: when `FleetSupervisor` spawns/kills an instance, emit an event that `ChromeGovernor` listens to for updating its own map. Or simpler: just call `this.fleetSupervisor.getInstance(slaveId)` on every access (it's O(1) map lookup).

3. **Fix `HealthMonitor` stale reference.** Remove `HealthMonitor` from governor entirely. The fleet's `startHealthProbe()` is the single health probe loop. Governor's `getHealth()` queries `FleetSupervisor` directly.

4. **Fix `seedAccounts()` and `reapOrphanedPorts()`.** Either implement them (seed accounts from `ProviderRegistrar` output, call `portReaper.reap()`) or remove the stubs. Don't emit noop events.

5. **Fix concurrent send gap.** After `submit` completes, immediately call `this.transport.capture()` — the mutex is already held by `CDPProxy.executeHarnessPlan()`. Remove the separate `capture()` mutex acquire/release and make it part of the same harness execution.

6. **Add CDP error classification.** Create `classifyCdpError(err: Error): CdpErrorType` that returns: `'timeout' | 'protocol_error' | 'chrome_crash' | 'page_navigation' | 'dialog_blocking' | 'rate_limited' | 'unknown'`. Store classification on `TraceEntry`. Wire `RetryEngine` to use classified errors for retry strategy selection.

7. **Add dead instance cleanup.** In `FleetSupervisor`, add a `pruneDeadInstances()` method that removes instances with status `error` or `crashed` older than 5 minutes. Call on health probe cycle.

8. **Per-provider DOM selectors from DB.** Read `ProviderEndpoint.selectorsJson` and `sendMethod` at resolve time. Replace hardcoded `COMPOSER_SELECTORS` and `SEND_BUTTON_SELECTORS` maps with DB-driven lookups. The hardcoded maps become seed data, written to `ProviderEndpoint` rows for each provider.

9. **Add per-provider capture DOM selectors.** Add `captureDomSelectorsJson` to `ProviderEndpoint` or `ProviderStreamConfig`. The `CdpTransportImpl.capture()` DOM fallback should use these instead of hardcoded `div.font-claude-response`.

10. **Fix `allocatePort()` on governor.** Remove it entirely — port allocation is a `FleetSupervisor` concern.

11. **Single `ProfileAllocator` instance.** Pass the governor's `ProfileAllocator` into `FleetSupervisor` constructor instead of creating a new one. Or have `FleetSupervisor` create it and expose it for governor to use.

12. **Fix user-agent version.** Generate user-agent dynamically from the actual Chrome binary version. Run `chrome --version` at launch and parse the version string.

13. **Composer type resolution from DB.** Replace `composerTypeForProvider()` hardcoded switch with a lookup from `ProviderEndpoint.composerType`. Seed the correct composer types for all known providers.

14. **Fix `BunCdpClient` reconnect bound.** Add `maxReconnectAttempts` (default 10) and `maxReconnectTimeMs` (default 60_000). After exceeding, emit `session-lost` event and stop retrying.

15. **Write tests.** `tests/unit/executor/fleet-supervisor.test.ts`, `tests/unit/executor/cdp-error-classification.test.ts`, `tests/integration/harness/send-pipeline.test.ts`.

### Output Files

| Action | File |
|---|---|
| Modify | `src/engines/chrome-governor.ts` |
| Modify | `src/executor/fleet-supervisor.ts` |
| Modify | `src/executor/cdp-transport.ts` |
| Modify | `src/executor/cdp.ts` |
| Modify | `src/executor/chrome-instance-profile.ts` |
| Modify | `src/engines/conversation-manager.ts` |
| Modify | `src/engines/composer-typing.ts` |
| Modify | `src/engines/provider-selectors.ts` |
| Modify | `src/server/index.ts` (bootstrap wiring changes) |
| Create | `src/executor/cdp-error-classifier.ts` |
| Create | `tests/unit/executor/fleet-supervisor.test.ts` |
| Create | `tests/unit/executor/cdp-error-classification.test.ts` |
| Create | `tests/integration/harness/send-pipeline.test.ts` |

### Verification

- Single health probe loop (not two competing ones)
- Single circuit breaker per slave (not two unsynchronized ones)
- `governor.getSlave(id)` returns up-to-date instance from fleet
- CDP errors classified correctly (test each type)
- Per-provider selectors read from DB, not hardcoded maps
- Send pipeline doesn't leak between submit and capture
- `bun run typecheck` passes, all harness tests pass

---

## Agent D: Plugin & Provider System

### Pre-Read Files (~15K tokens)

| File | Purpose |
|---|---|
| `src/engines/plugin-system.ts` | ProviderPlugin interface, PluginManager |
| `src/engines/plugin-hot-reload.ts` | File watcher, hot-reload |
| `src/engines/provider-registrar.ts` | JSON manifest seeding |
| `seeds/providers/chatgpt.json` | Example provider manifest |
| `seeds/providers/claude.json` | Example provider manifest |
| `seeds/providers/gemini.json` | Example provider manifest |
| `seeds/conceptual-model/seed.ts` | Family + primitive + component seed data |
| `src/storage/contracts/provider-store.ts` | ProviderStore interface |
| `src/storage/impl/provider-store-impl.ts` | ProviderStore implementation |
| `src/storage/contracts/provider-type-store.ts` | ProviderTypeStore interface |
| `src/storage/impl/provider-type-store-impl.ts` | ProviderTypeStore implementation |
| `src/storage/impl/primitive-store-impl.ts` | PrimitiveStore implementation |
| `src/storage/impl/ui-component-store-impl.ts` | UiComponentStore implementation |
| `src/schema/provider-manifest.ts` | ProviderManifest Zod schema |
| `src/server/index.ts` (lines 230-270, seeding) | Bootstrap seeding call |
| `shared/conceptual-model.ts` | ProviderTypeRow, PrimitiveRow |
| `shared/ui-component.ts` | UiComponentRow |
| `prisma/schema.prisma` (L1-L1b tables) | PluginRegistry, ProviderType, Primitive, UiComponent |

### Audit Items Owned

**§2 Plugin System (13 items):** 2.1–2.13  
**§3 items touching seed data (5 items):** 3.1–3.5

### Implementation Steps

1. **Define plugin packaging format.** Create `.vivim-plugin` specification: a tar.gz archive containing `manifest.json` (provider definition + capabilities + models + endpoints + parsers + stream-config), `components/` directory (one folder per primitive with `index.html`, `style.css`, `script.js`), `icon.png`. Document format in `docs/plugins/format.md`.

2. **Add plugin install API.** Create `POST /api/plugins/install` accepting multipart file upload. Flow: (a) extract archive, (b) verify manifest against `ProviderManifestSchema`, (c) compute SHA-256 hash of all files, (d) write to `PluginRegistry` table, (e) run `ProviderRegistrar.registerManifest()` to upsert provider + capabilities, (f) upsert `UiComponent` rows from `components/`, (g) upsert `ProviderStreamConfig` + `ProviderParser` + `ProviderEndpoint` from manifest, (h) emit `plugin:installed` event.

3. **Add plugin uninstall API.** `DELETE /api/plugins/:id`. Cascade delete: `PluginRegistry` → find `ProviderDefinition` by `pluginId` → cascade delete all related rows (use the relations defined in schema). Verify all rows removed before returning success. Emit `plugin:uninstalled`.

4. **Add plugin upgrade API.** `POST /api/plugins/:id/upgrade`. Accept new archive. Compare version. Run migration hook if `manifest.migrationScript` exists. Preserve user data (accounts, conversations, custom component overrides). Update `PluginRegistry.version` + `updatedAt`.

5. **Add plugin integrity verification.** Before executing any plugin code (parser, component script, stream config), verify the stored hash against the current files. If mismatch, refuse to load and emit `plugin:integrity_failed` event. Show error in UI.

6. **Add plugin disable/enable.** `POST /api/plugins/:id/toggle`. Set `isActive` to 0/1. When disabled: hide all `UiComponent` rows for the provider from resolution, mark `ProviderDefinition.isActive = 0`, stop health probes for the provider's slaves. When re-enabled: reverse all.

7. **Add plugin dependency resolution.** Add `dependsOnJson` to `PluginRegistry`. On install, verify all listed plugin IDs exist and are active. On uninstall, warn if other plugins depend on this one.

8. **Add plugin conflict detection.** On install, check if any `ProviderCapability.globalCapabilityId` already exists from another plugin. If conflict, reject install with `conflicting_plugins: [...]` in error.

9. **Populate component seed data.** In `seeds/conceptual-model/seed.ts`, add `UiComponent` seed rows for:
   - `ai-chat` family: composer, message bubble, sidebar, model picker (provider-global, variant: null)
   - `ai-chat` provider-specific: ChatGPT canvas viewer (`variant: 'chatgpt'`), Claude artifacts viewer (`variant: 'claude'`), Gemini inline images (`variant: 'gemini'`)
   - `email` family: composer (to/cc/subject), inbox thread list, attachment viewer
   - `messenger` family: chat bubble, contact list, typing indicator

10. **Wire plugin hot-reload for production.** Replace `fs.watch` with atomic swap: when a new plugin archive is detected, extract to a staging directory, verify, then `rename()` the staging dir over the active dir. This prevents partial reads during extraction.

11. **Add plugin hooks.** Extend `ProviderPlugin` interface with `onUninstall()`, `onUpgrade(fromVersion: string)`, `onHealthCheck(): Promise<HealthStatus>`.

12. **Write tests.** `tests/unit/plugins/install.test.ts`, `tests/unit/plugins/uninstall-cleanup.test.ts`, `tests/unit/plugins/integrity.test.ts`, `tests/integration/providers/plugin-lifecycle.test.ts`.

### Output Files

| Action | File |
|---|---|
| Create | `src/server/plugin-router.ts` |
| Modify | `src/engines/plugin-system.ts` |
| Modify | `src/engines/plugin-hot-reload.ts` |
| Modify | `src/engines/provider-registrar.ts` |
| Modify | `seeds/conceptual-model/seed.ts` |
| Modify | `src/server/index.ts` (mount plugin router) |
| Create | `docs/plugins/format.md` |
| Create | `tests/unit/plugins/install.test.ts` |
| Create | `tests/unit/plugins/uninstall-cleanup.test.ts` |
| Create | `tests/unit/plugins/integrity.test.ts` |
| Create | `tests/integration/providers/plugin-lifecycle.test.ts` |

### Verification

- Install a `.vivim-plugin` archive → provider appears in DB with all capabilities, components, selectors
- Uninstall → all rows cascade-deleted, no orphans
- Tampered plugin → integrity check fails, plugin not loaded
- Disable plugin → provider hidden, conversations preserved
- Upgrade plugin → new version active, old data intact
- `bun run typecheck` passes, all plugin tests pass

---

## Agent E: Memory & Import Pipeline

### Pre-Read Files (~20K tokens)

| File | Purpose |
|---|---|
| `src/engines/knowledge-ingestion.ts` (328 lines) | Import engine |
| `src/engines/knowledge-extractor.ts` | Entity/decision/pattern extraction |
| `src/engines/memory-engine.ts` (382 lines) | Episodic/semantic/procedural memory |
| `src/engines/memory-indexer.ts` | Message indexing |
| `src/engines/semantic-search.ts` | Vector search (noop embedding) |
| `src/engines/conversation-organizer.ts` (115 lines) | Project/topic organization |
| `src/engines/cross-conversation-synthesis.ts` | Cross-conversation synthesis |
| `src/storage/contracts/knowledge-ingestion-store.ts` | Import store contract |
| `src/storage/contracts/conversation-store.ts` | Conversation store |
| `src/storage/impl/knowledge-ingestion-store-impl.ts` | Import store impl |
| `src/storage/impl/episodic-memory-store-impl.ts` | Episodic memory store |
| `src/storage/impl/semantic-memory-store-impl.ts` | Semantic memory store |
| `src/storage/impl/procedural-memory-store-impl.ts` | Procedural memory store |
| `src/storage/impl/semantic-search-store-impl.ts` | Search store impl |
| `src/engines/local-model-adapter.ts` | Local model runner |
| `prisma/schema.prisma` (L12 Memory, L16 Sovereign, L4 conversations, 002 upgrade tables) | Memory schema |
| `shared/stream-blocks.ts` | ContentBlock types |

### Audit Items Owned

**§4 Memory & Import (13 items):** 4.1–4.13  
**§5 Memory Unification (10 items):** 5.1–5.10  
**Deep Dive C (5 items):** C.1–C.5

### Implementation Steps

1. **Create ChatGPT import adapter.** `seeds/adapters/chatgpt.ts` — parse `conversations.json`: (a) stream-read the JSON array in chunks using a streaming JSON parser, (b) walk the `mapping` tree starting from `current_node` to build message sequence, (c) map `content.parts` to `ContentBlock[]` (text → text block, code → code block, image → image block), (d) create `Conversation` + `ConversationMessage` + `ContentUnit` + `StreamBlock` rows, (e) run dedup via SHA-256 of `(title, create_time, message_count)`.

2. **Create Claude import adapter.** `seeds/adapters/claude.ts` — parse Claude's export format (JSON array of conversation objects with `chat_messages` array).

3. **Create Gemini import adapter.** `seeds/adapters/gemini.ts` — parse Google Takeout Gemini JSON.

4. **Replace `readFileSync` with streaming parser.** In `KnowledgeIngestionEngine.ingest()`, use `Bun.file(path).stream()` + incremental JSON parse. Never load the entire file into memory.

5. **Implement deduplication.** Before creating a conversation, compute `dedupKey = hash(title + source + messageCount + firstMessageContent)`. Check `ImportJob.resultJson` for existing imports with matching dedup keys. Skip if found. Track `duplicatesSkipped` count.

6. **Populate `ContentUnit` during import.** For each message's content parts: code blocks → `ContentUnit(unitType: 'code')`, images → `ContentUnit(unitType: 'image')`, thinking → `ContentUnit(unitType: 'thinking')`, tool_use → `ContentUnit(unitType: 'tool_use')`. Each unit gets `qualityScore` from the source metadata if available.

7. **Add incremental progress events.** Emit `knowledge:import_progress` event every 50 conversations: `{jobId, imported: 150, total: 532, stage: 'importing'}`. Frontend `useImportProgress` hook displays a progress bar.

8. **Add import resume.** Before starting import, check `ImportJob` for the same file path with status `'pending'` or `'failed'`. If found, resume from the last successfully imported conversation. Track `lastImportedConversationIndex` in `ImportJob.configJson`.

9. **Add import preview.** `POST /api/knowledge/import/preview` — reads file, extracts title + message count for first 20 conversations, returns summary. User reviews before committing to full import.

10. **Wire real embedding model.** Replace `noopEmbedding` with `LocalModelAdapter.embed()`. The `LocalModelAdapter` already wraps local model execution — add an `embed(text: string): Promise<number[]>` method. Wire into `SemanticSearchEngine` constructor. If no local model available, fall back to a simple TF-IDF vectorizer (`src/engines/nlcl/tfidf.ts` already exists) for keyword-based search.

11. **Unified memory search API.** Create `MemoryEngine.searchUnified(query: string, opts?: {types?: ('episodic'|'semantic'|'procedural'|'entity'|'decision'|'pattern')[], limit?: number})`. Searches across all memory types, ranks by relevance (embedding similarity if available, keyword match otherwise), returns unified results with type tags.

12. **Auto-populate `MemoryLink`.** In `MemoryIndexer`, after indexing a conversation: link entities mentioned in the same message (`MessageEntity` rows), link decisions to their source conversation, link extracted patterns to entities. Write `MemoryLink` rows with `strength` based on co-occurrence count.

13. **Populate `MemoryAccess` audit log.** On every `recall()` or `searchUnified()` call, write a `MemoryAccess` row: `memoryType, memoryId, accessReason, queryText, resultRank, wasUsed, latencyMs`.

14. **Populate `ReflectionLog`.** Add `MemoryEngine.reflect()` method called periodically (daily, or after import). Uses the LLM (via `ProviderLLMExecutor` or `LocalModelAdapter`) to: summarize recent learnings, update entity confidence, suggest memory links. Writes `ReflectionLog` rows.

15. **Fix `ConversationOrganizer.autoAssignTopic()`.** Instead of searching by ULID, search by the conversation's first message content. Use `SemanticSearchEngine.search()` with the message text.

16. **Write tests.** `tests/unit/memory/chatgpt-import.test.ts`, `tests/unit/memory/dedup.test.ts`, `tests/unit/memory/unified-search.test.ts`, `tests/integration/memory/import-pipeline.test.ts`.

### Output Files

| Action | File |
|---|---|
| Create | `seeds/adapters/chatgpt.ts` |
| Create | `seeds/adapters/claude.ts` |
| Create | `seeds/adapters/gemini.ts` |
| Create | `seeds/adapters/generic.ts` |
| Modify | `src/engines/knowledge-ingestion.ts` |
| Modify | `src/engines/memory-engine.ts` |
| Modify | `src/engines/memory-indexer.ts` |
| Modify | `src/engines/semantic-search.ts` |
| Modify | `src/engines/conversation-organizer.ts` |
| Modify | `src/engines/local-model-adapter.ts` |
| Create | `tests/unit/memory/chatgpt-import.test.ts` |
| Create | `tests/unit/memory/dedup.test.ts` |
| Create | `tests/unit/memory/unified-search.test.ts` |
| Create | `tests/integration/memory/import-pipeline.test.ts` |

### Verification

- Import a real ChatGPT export → conversations appear in DB with correct message ordering
- Re-import same file → zero duplicates, `duplicatesSkipped` matches expected count
- `ContentUnit` rows populated with code blocks, images, tool_use
- `MemoryEngine.searchUnified("machine learning")` returns results across episodic, semantic, entity types
- `MemoryLink` rows auto-populated after import
- `bun run typecheck` passes, all memory tests pass

---

## Agent F: Automation Production

### Pre-Read Files (~18K tokens)

| File | Purpose |
|---|---|
| `src/engines/workflow-engine.ts` (515 lines) | Workflow execution |
| `src/automation/scheduler.ts` (238 lines) | Time/event scheduling |
| `src/engines/workflow-compiler.ts` | Harness DAG compiler |
| `src/engines/workflow-templates/newsletter.ts` | Example template |
| `src/engines/execution-policy.ts` | Policy engine |
| `src/engines/autonomous-execution.ts` | Autonomous task execution |
| `src/engines/autonomous-replay.ts` | Task replay |
| `src/engines/agentic-loop.ts` | Agentic loop engine |
| `src/storage/contracts/autonomous-store.ts` | Autonomous store contract |
| `src/storage/impl/workflow-store-impl.ts` | Workflow store |
| `src/storage/impl/automation-store-impl.ts` | Automation store |
| `src/storage/impl/autonomous-store-impl.ts` | Autonomous store |
| `src/storage/impl/policy-store-impl.ts` | Policy store |
| `prisma/schema.prisma` (L9 Harness, Workflow, L15 Agent Loop, L19 Autonomous) | Schema for all automation tables |
| `src/engines/safe-eval.ts` | Safe expression evaluator |

### Audit Items Owned

**§6 Automation (15 items):** 6.1–6.15  
**§21 Autonomous (5 items):** 21.1–21.5  
**Deep Dive D (6 items):** D.1–D.6

### Implementation Steps

1. **Implement real cron parser.** Replace `parseCronNextMs()` stub with a 5-field cron parser supporting: `* * * * *`, `*/N`, `N-M`, `N,M,O`, day-of-week names. Use `cron-parser` npm package or implement a minimal parser. Return next fire time in ms.

2. **Implement event triggers.** In `AutomationScheduler`, subscribe to `CapabilityEventBus`. When an event's `type` matches a schedule's `scheduleValue` (event pattern), fire the schedule. Event patterns support wildcards: `conversation:*` matches all conversation events.

3. **Register `AutomationRunner` implementation.** Create `CapabilityRunner` that maps `action` string to `UnifiedCapability.handler`. Wire into `AutomationScheduler` at bootstrap. Schedules with `action: 'cap:conversation:summarize'` call the corresponding capability.

4. **Add conditional branching to workflow engine.** Implement `WorkflowEngine.evaluateCondition(condition: string, nodeOutput: Record<string, unknown>): boolean`. Use `safe-eval.ts` to evaluate the condition expression against `$result` (bound to node output). Skip edges whose condition evaluates to false.

5. **Add workflow trigger binding.** Create `workflow_trigger` table: `id, workflowId, eventPattern, isActive`. On matching `CapabilityEventBus` event, create a `WorkflowExecution` and start it. Wire into `AutomationScheduler` event handling.

6. **Add persistent retry queue.** Create `workflow_retry_queue` table: `id, nodeExecutionId, attempt, nextRetryAt, maxAttempts, backoffMs, status`. On node failure with `retry_config.maxRetries > 0`, insert a retry row with `nextRetryAt = now + backoffDelay(attempt)`. Background poller picks up due retries and re-executes the node. After `maxAttempts`, mark `dead_letter`.

7. **Add per-node timeout.** Read `timeoutMs` from `WorkflowNode.config`. In `executeNode()`, wrap execution in `Promise.race([execute(), timeout(timeoutMs)])`. On timeout, mark node `failed` with error `'timeout'`.

8. **Add parallel node execution.** In `WorkflowEngine.execute()`, after topological sort, group nodes by "depth" (max distance from root). Execute all nodes at the same depth in parallel via `Promise.all`. Nodes at depth N+1 wait for all at depth N.

9. **Add result propagation.** In `executeNode()`, after successful execution, store output on `WorkflowExecution.variables[nodeId]`. Before executing downstream nodes, resolve `$prev`, `$node.<id>`, `$var.<name>` references in their config against the variables map.

10. **Add workflow versioning.** On workflow edit, create a `WorkflowVersion` row: `id, workflowId, version, definitionJson, createdAt`. Running executions reference the version they started with. New executions use the latest version.

11. **Add human-in-loop for workflows.** When a node's `config.requiresApproval === true`, create a `HitlGate`, pause execution, emit `workflow:approval_needed` event. Frontend shows approval dialog. On resolution, resume execution from the paused node. If gate expires, mark node `failed`.

12. **Seed default policy rules.** Add `PolicyRule` seed rows: `{name: 'read_only', condition: 'op_classification == "read"', classification: 'safe'}`, `{name: 'delete_requires_approval', condition: 'op_classification == "destroy"', classification: 'needs_approval'}`, `{name: 'send_allowed', condition: 'op_classification == "send"', classification: 'safe', maxOccurrences: 100, windowMs: 3600000}`.

13. **Add workflow template library.** Create `src/engines/workflow-templates/` with: `daily-digest.ts` (summarize today's conversations), `cleanup-inactive.ts` (archive conversations inactive > 90 days), `reindex-memory.ts` (re-run memory indexer on all conversations), `health-report.ts` (generate health digest and save).

14. **Wire `WorkflowWebhook` router.** Create `POST /api/webhooks/:path` endpoint that looks up `WorkflowWebhook` by path, creates `WorkflowExecution`, and runs the workflow. Verify `secret` if set.

15. **Wire `WorkflowCredential` injection.** In `executeNode()`, if node config references `$credential.<name>`, resolve from `WorkflowCredential` table (decrypting via `EncryptionEngine`). Pass as masked parameter to the node execution.

16. **Fix autonomous API availability.** Remove the try/catch wrapper around `AutonomousExecutionEngine` + `ExecutionPolicyEngine` construction in bootstrap. If either fails, the server should fail to start (fail-fast), not silently degrade.

17. **Implement `AgenticLoopEngine` planning.** Replace stub `plan()` with: decompose goal into steps using `IntentDecomposer`, classify each step via `PolicyEngine`, create `AutonomousTask` with `AutonomousStep[]`, execute step by step with HITL gates on `needs_approval` steps.

18. **Write tests.** `tests/unit/automation/cron-parser.test.ts`, `tests/unit/automation/workflow-condition.test.ts`, `tests/unit/automation/workflow-retry.test.ts`, `tests/integration/automation/event-trigger.test.ts`, `tests/integration/automation/human-in-loop.test.ts`.

### Output Files

| Action | File |
|---|---|
| Modify | `src/automation/scheduler.ts` |
| Modify | `src/engines/workflow-engine.ts` |
| Modify | `src/engines/execution-policy.ts` |
| Modify | `src/engines/autonomous-execution.ts` |
| Modify | `src/engines/agentic-loop.ts` |
| Create | `src/engines/workflow-templates/daily-digest.ts` |
| Create | `src/engines/workflow-templates/cleanup-inactive.ts` |
| Create | `src/engines/workflow-templates/reindex-memory.ts` |
| Create | `src/engines/workflow-templates/health-report.ts` |
| Create | `src/server/webhook-router.ts` |
| Modify | `prisma/schema.prisma` (workflow_retry_queue, workflow_version, workflow_trigger tables) |
| Create | `tests/unit/automation/cron-parser.test.ts` |
| Create | `tests/unit/automation/workflow-condition.test.ts` |
| Create | `tests/unit/automation/workflow-retry.test.ts` |
| Create | `tests/integration/automation/event-trigger.test.ts` |
| Create | `tests/integration/automation/human-in-loop.test.ts` |

### Verification

- Cron schedule fires at correct time (±1s)
- Event trigger fires on matching `CapabilityEventBus` event
- Conditional edge only traversed when condition evaluates true
- Failed node retries with backoff, eventually dead-letters
- Parallel nodes execute concurrently (measured wall time < sum of durations)
- Human-in-loop pauses execution until resolved
- `bun run typecheck` passes, all automation tests pass

---

## Agent G: Reliability, Security & Data Portability

### Pre-Read Files (~22K tokens)

| File | Purpose |
|---|---|
| `src/engines/encryption.ts` | Encryption engine |
| `src/engines/db-encryption.ts` | DB encryption engine |
| `src/engines/lock-manager.ts` | Conversation locking |
| `src/engines/idempotency-guard.ts` | Duplicate request guard |
| `src/engines/retry-engine.ts` | Retry with backoff |
| `src/engines/export.ts` | Data export |
| `src/engines/sync.ts` | Cross-device sync |
| `src/engines/backup-scheduler.ts` | Scheduled backups |
| `src/engines/logger.ts` | Logger engine |
| `src/engines/kernel/kernel-context.ts` | Kernel interface |
| `src/engines/kernel/kernel-bootstrap.ts` | Kernel wiring |
| `src/engines/kernel/kernel-registry.ts` | Engine registration |
| `src/engines/telemetry-aggregator.ts` | Daily summaries |
| `src/engines/telemetry-audit.ts` | Network call audit |
| `src/engines/health-digest.ts` | Daily digest generation |
| `src/engines/observability/index.ts` | Observability exports |
| `src/errors.ts` | Error hierarchy |
| `src/config.ts` | Config, auth, CORS |
| `src/server/index.ts` (full file, 851 lines) | Bootstrap wiring |
| `src/server/auth-gate.ts` | Auth middleware |
| `src/server/websocket.ts` | WebSocket handler |
| `src/alerting/alerter.ts` | Alert dispatch |

### Audit Items Owned

**§9 Data Portability (11 items):** 9.1–9.11  
**§10 Performance (10 items):** 10.1–10.10  
**§11 Reliability (remaining items):** 11.1–11.3, 11.6, 11.8–11.10  
**§12 Security (10 items):** 12.1–12.10  
**§20 Observability (8 items):** 20.1–20.8  
**§22 Cross-cutting (9 items):** 22.1–22.9  
**§23 Migration (4 items):** 23.1–23.4

### Implementation Steps

1. **Structured logging.** Replace all `console.log('[tag] message')` calls with a `Logger` class that produces JSON-formatted output: `{ts, level, engine, message, traceId?, ...data}`. Read `CAP_STORE_LOG_LEVEL` from config. Write to stdout and optionally to `CAP_STORE_LOG_FILE`. Add a `withTrace(traceId)` method for correlation.

2. **Wire `LockManager` into `ConversationManager`.** Before `sendInternal()`, acquire a lock on `conversationId`. Release in finally. If lock is held, queue the send (return 202 Accepted with `Retry-After`). The `LockManager` already exists — just wire it.

3. **Wire `IdempotencyGuard` into API.** Accept `Idempotency-Key` header on `POST` endpoints. Check if key was already used (store in memory with TTL). If duplicate, return the cached response. If new, execute and cache.

4. **Add global request timeout.** On `Bun.serve`, set `idleTimeout: 120` (2 min). Add per-route timeout middleware: wrap handler in `Promise.race([handler, timeout(routeTimeoutMs)])`.

5. **Wire encryption at rest.** In `createServerWithEngines`, if `config.storage.encryptDb`: (a) construct `EncryptionEngine` with key from `CAP_STORE_ENCRYPTION_KEY` env var or OS keychain, (b) construct `DbEncryptionEngine`, (c) inject into `CapStoreDb` as a middleware that encrypts/decrypts `providerStateJson`, `WorkflowCredential.valueEncrypted`, and `ConversationMessage.content` transparently.

6. **Encrypt Chrome profile directories.** Profile directories on disk contain unencrypted cookies. Add an optional profile encryption layer: before launching Chrome, decrypt profile to temp dir. After Chrome stops, re-encrypt and write back. This is expensive (profile dirs can be GB-scale). Alternative: use OS-level encryption (Windows EFS, macOS FileVault) and document it.

7. **Configurable CORS.** Read `CAP_STORE_CORS_ORIGIN` env var, split by comma. Default to `http://localhost:5175`. In production (local app), allow only localhost origins by default.

8. **Add user identity.** Add a local user profile: on first run, prompt for name + password (optional). Store hashed password in `UserPreference` (key: `auth.password_hash`). Derive encryption key from password. Add `POST /api/auth/login` and `POST /api/auth/logout`.

9. **Complete export flow.** Add `ExportEngine.exportFull()` that includes: conversations + messages + ContentUnits, memory (all types), entities + decisions + patterns, UiComponent rows, PluginRegistry, ConfigEntry, WorkspaceMode, UserPreference, projects + topics. Write as a single `.vivim-export` JSON file with manifest + checksum.

10. **Add import-from-export flow.** `POST /api/export/import` — reads `.vivim-export` file, verifies checksum, reconstructs DB row by row. Handles ID conflicts (skip existing, or prompt user).

11. **Implement backup scheduler.** `BackupScheduler` already exists with `BackupScheduleConfig`. Wire it: (a) read config, (b) schedule periodic backups via `setInterval` or cron, (c) on each tick: run `VACUUM INTO 'backups/backup-${iso}.db'`, compute SHA-256, write `BackupEntry` row, (d) enforce retention: delete backups older than `retentionDays`.

12. **Implement sync engine.** `SyncEngine.sync()` → basic implementation: export since last sync timestamp, send to peer via WebSocket or HTTP, peer imports. Track sync state in `SyncLog` rows. Conflict resolution: last-write-wins with user notification. For v1, file-based sync is sufficient (export to shared folder, peer imports).

13. **Add kernel instrumentation.** In every engine constructor, register with `KernelRegistry`. In every public method that does I/O, wrap with `kernel.span(name, async () => { ... })`. Spans auto-record to `KernelSpan` table with timing. Add `GET /api/kernel/spans` for debugging.

14. **Add startup time measurement.** In `createServerWithEngines`, wrap each bootstrap phase in `performance.mark()` / `performance.measure()`. Log all phase timings. Expose on `/readyz` as `phases: {seedProviders: 123ms, seedConceptual: 45ms, constructEngines: 89ms, ...}`.

15. **Add progressive readiness.** Change `/readyz` to return per-engine status: `{canvas: 'ready', chromeGovernor: 'starting', memoryIndexer: 'not_available'}`. Frontend polls `/readyz` and shows available layers as they come online. Don't block UI on slow engines.

16. **Add lazy engine init.** Don't construct `KnowledgeIngestionEngine`, `SemanticSearchEngine`, `CrossConversationSynthesizer`, `ExportEngine` at boot. Construct on first API call to their routes. Cache the instance after construction.

17. **Add graceful shutdown for in-flight ops.** In `onShutdown`, before killing Chrome: (a) stop accepting new requests (set `isShuttingDown = true`), (b) wait for in-flight `ConversationManager.send()` calls to complete (track with `activeSends` counter), (c) timeout after 30s and force-kill, (d) run `PRAGMA wal_checkpoint(TRUNCATE)`, (e) disconnect CDP, kill Chrome.

18. **Add crash recovery.** On boot, check for `activeSends` in `SchemaMeta` (key: `active_send_count`). If > 0, the previous run crashed mid-send. Log warning. Check for orphaned conversation messages (created but no `StreamBlock` rows). Mark conversations as `state: 'interrupted'` so user knows.

19. **Add telemetry consent.** On first run, prompt: "VIVIM collects anonymous usage data to improve. Allow?" Store response in `UserPreference` (key: `telemetry.consent`). If denied, disable `TelemetryAggregator` and `TelemetryAudit`. Never send data off-machine.

20. **Remove dead dependency `alasql`.** Search codebase for `alasql` imports. If none found (likely), remove from `package.json` and `bun.lock`.

21. **Add feature flags.** Extend `ConfigManager` with `getFeatureFlag(key): boolean`. Flags: `canvas.3d`, `memory.reflection`, `automation.event_triggers`, `sync.enabled`. All default `false` until stable. Toggle via `POST /api/config/features`.

22. **Add app version upgrade flow.** In `VersionManager`: (a) detect current version from `package.json`, (b) compare with stored version in `SchemaMeta`, (c) if different, run upgrade steps (migrations, data transforms, plugin re-verification), (d) write new version, (e) emit `system:upgraded` event.

23. **Write tests.** `tests/unit/reliability/lock-manager.test.ts`, `tests/unit/reliability/idempotency.test.ts`, `tests/unit/reliability/encryption.test.ts`, `tests/unit/reliability/export-full.test.ts`, `tests/unit/reliability/shutdown.test.ts`, `tests/unit/observability/kernel-spans.test.ts`, `tests/integration/portability/export-import.test.ts`.

### Output Files

| Action | File |
|---|---|
| Modify | `src/engines/logger.ts` |
| Modify | `src/engines/encryption.ts` |
| Modify | `src/engines/db-encryption.ts` |
| Modify | `src/engines/export.ts` |
| Modify | `src/engines/sync.ts` |
| Modify | `src/engines/backup-scheduler.ts` |
| Modify | `src/engines/lock-manager.ts` |
| Modify | `src/engines/idempotency-guard.ts` |
| Modify | `src/engines/kernel/kernel-bootstrap.ts` |
| Modify | `src/server/index.ts` |
| Modify | `src/server/auth-gate.ts` |
| Modify | `src/errors.ts` |
| Modify | `prisma/schema.prisma` (backup_entry table) |
| Create | `docs/architecture/security-model.md` |
| Create | `tests/unit/reliability/lock-manager.test.ts` |
| Create | `tests/unit/reliability/idempotency.test.ts` |
| Create | `tests/unit/reliability/encryption.test.ts` |
| Create | `tests/unit/reliability/export-full.test.ts` |
| Create | `tests/unit/reliability/shutdown.test.ts` |
| Create | `tests/unit/observability/kernel-spans.test.ts` |
| Create | `tests/integration/portability/export-import.test.ts` |

### Verification

- JSON-formatted logs with trace IDs
- Concurrent sends to same conversation queued, not interleaved
- Duplicate POST with same `Idempotency-Key` returns cached response
- Export → import roundtrip produces identical DB state
- Backup file created on schedule, verified by checksum
- Kill process during send → restart → conversation marked `interrupted`
- `/readyz` returns per-engine status with timings
- `bun run typecheck` passes, all reliability tests pass

---

## Execution Order

```
Phase 1 (sequential — runs alone):
  Agent A: Schema & Storage Hardening
  ↓ completes
Phase 2 (parallel — all 6 start simultaneously):
  Agent B: Canvas & UI Production        ┐
  Agent C: Chrome Harness Consolidation   │
  Agent D: Plugin & Provider System       ├── ZERO file conflicts
  Agent E: Memory & Import Pipeline       │
  Agent F: Automation Production          │
  Agent G: Reliability & Security         ┘
```

**Total parallel workstreams:** 7 (1 sequential + 6 parallel)  
**Total output files:** ~100 (creates + modifies)  
**Total new test files:** ~30  
**Estimated total token budget per agent:** 30K–50K (pre-read) + 50K–100K (implementation)  

---

## Shared Read-Only Files (all agents read these)

| File | Read by |
|---|---|
| `prisma/schema.prisma` | A (modify), B, C, D, E, F, G (read) |
| `src/server/index.ts` | C, D, G (modify different sections) |
| `src/config.ts` | A, C, G |
| `src/errors.ts` | G (modify), all (read) |
| `src/ids.ts` | all (read-only) |
| `src/index.ts` | all (read-only barrel) |
| `shared/*.ts` | B, D, E (read, only B modifies canvas types) |
| `AGENTS.md` | all (read-only conventions) |
