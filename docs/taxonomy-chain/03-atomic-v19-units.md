# Atomic-v19: Full Frontend=Backend Wiring — Implementation Units

**Status:** DESIGN
**Purpose:** Wire the taxonomy chain into the runtime so every capability is generated from a single source of truth.

---

## Unit 19.1: Taxonomy Chain Pipeline

**File:** `scripts/taxonomy-gen/lib/taxonomy-model.ts` + new files
**Effort:** L
**Depends on:** taxonomy-gen Round 1+2 complete

### What

Extend the taxonomy generation pipeline with Round 3 (UI slot mapping) and Round 4 (cross-surface binding) so the final `pool.taxonomy.json` contains fully unified nodes.

### Changes

1. **Extend `TaxonomyNodeSchema`** in `taxonomy-model.ts`:
   - Add UI fields: `ui_component`, `ui_label`, `ui_icon`, `ui_position`, `ui_order`, `ui_group`, `ui_layer_depth`, `ui_priority`, `interaction_mode`, `ui_states_json`, `ui_visibility_rule`, `ui_input_schema`, `result_component`, `result_layout`
   - Add cross-surface fields: `id` (cap: format), `cliCommand`, `apiEndpoint`, `mcpToolName`, `uiAction`, `workflowNodeType`, `surfaces`, `isAsync`, `requiresConfirmation`

2. **Create `ui-slot-mapper.ts`**:
   - `mapCapabilityToUI(node: TaxonomyNode): UIMapping | null`
   - Maps capability kind + category → slot metadata
   - Uses default tables defined in `01-ui-slot-mapping.md`

3. **Create `cross-surface-binder.ts`**:
   - `bindCrossSurface(node: TaxonomyNode): CrossSurfaceBindings | null`
   - Generates CLI/API/MCP/UI specs from slug
   - Uses generation rules defined in `02-cross-surface-binding.md`

4. **Update `merge.ts`**:
   - After collecting all nodes, run Round 3+4 on each capability node
   - Include enriched nodes in final pool output

### Acceptance Criteria

- [ ] `pool.taxonomy.json` contains capability nodes with all UI fields populated
- [ ] Every capability node has `id` in `cap:<category>:<action>` format
- [ ] Every capability node has `cliCommand`, `apiEndpoint`, `mcpToolName`
- [ ] `bun run taxonomy-gen merge` produces enriched pool
- [ ] `bun run typecheck` passes

---

## Unit 19.2: Capability Bootstrap from Taxonomy

**File:** `src/engines/capability-bootstrap-generated.ts` (new)
**Effort:** M
**Depends on:** 19.1

### What

Replace the hand-written `capability-bootstrap.ts` with a generated version that reads from the taxonomy pool. The existing file is kept for backward compatibility; the generated version is the new default.

### Changes

1. **Create `capability-bootstrap-generated.ts`**:
   - Reads `pool.taxonomy.json`
   - For each capability node, creates `makeCapability` call
   - Maps slugs to handler functions via a handler map
   - Exports `registerGeneratedCapabilities(registry, services)`

2. **Create handler map** in `src/engines/handlers/`:
   - One file per category: `conversation.ts`, `chrome.ts`, `memory.ts`, etc.
   - Each file maps slugs to service method calls
   - Handlers are the "last mile" — real code, not generated

3. **Update server bootstrap** (`src/server/index.ts`):
   - Import `registerGeneratedCapabilities` instead of `registerDefaultCapabilities`
   - Fall back to old bootstrap if generated version fails

### Acceptance Criteria

- [ ] `registerGeneratedCapabilities` registers all capabilities from pool
- [ ] Each capability's handler correctly calls the backend service
- [ ] `bun run devops runtime-test discover` shows all generated capabilities
- [ ] `bun run typecheck` passes
- [ ] Existing tests still pass

---

## Unit 19.3: Frontend Slot Auto-Population

**File:** `web/ui/src/ui/auto-populate.ts` (new)
**Effort:** M
**Depends on:** 19.2

### What

At frontend boot time, query the backend for all capabilities and apply slot overrides to the `UIComponentRegistry` based on the `ui_component` and `ui_position` columns from the `CapabilityTaxonomy` table.

### Changes

1. **Create `auto-populate.ts`**:
   - Fetches `/api/capabilities?surface=ui` on boot
   - For each capability with `ui_component` set:
     - Look up the component in the catalog
     - Call `UIComponentRegistry.register(slot, slug, component, { sandbox })`
   - Subscribe to capability changes (WebSocket) for live updates

2. **Update `ChatPage.tsx`** (or equivalent surface):
   - Call `autoPopulate()` on mount
   - Pass `providerSlug` and `capabilitySlug` to slot resolution

3. **Update `web/ui/src/ui/defaults/`**:
   - Ensure every `ui_component` value from the taxonomy has a corresponding component in the catalog
   - Create missing default components as needed

### Acceptance Criteria

- [ ] Frontend loads and applies slot overrides from DB
- [ ] Each capability's `ui_component` resolves to a real React component
- [ ] Hot-swap works: changing `ui_component` in DB updates UI without rebuild
- [ ] No console errors on boot
- [ ] `bun run typecheck` passes

---

## Unit 19.4: Cross-Surface Verification

**File:** `scripts/verify-cross-surface.ts` (new)
**Effort:** S
**Depends on:** 19.2, 19.3

### What

Verify that every registered capability resolves correctly across all surfaces (CLI, API, MCP, UI).

### Changes

1. **Create `verify-cross-surface.ts`**:
   - List all capabilities from the registry
   - For each capability:
     - CLI: verify `cliCommand.name` is non-empty
     - API: verify `apiEndpoint` returns 200
     - MCP: verify tool appears in MCP server tool list
     - UI: verify slot resolves in `UIComponentRegistry`
   - Output verification report

2. **Add to devops workflow**:
   - `bun run devops verify-cross-surface`
   - Run after any taxonomy chain change
   - Block PR merge if verification fails

### Acceptance Criteria

- [x] All capabilities pass cross-surface verification
- [x] Report shows 0 failures
- [x] Command integrated into devops gate (`bun run devops verify-cross-surface`)
- [x] Verifier also surfaced + fixed two real bugs: undefined apiEndpoint paths (missing `category`) and UI slot ids not matching `SLOT_IDS` (frontend=backend invariant)
