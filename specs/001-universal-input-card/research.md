# Research: Universal Atomic TextEntryBox + Pluggable Add-On System

**Date**: 2026-07-27
**Spec**: `specs/001-universal-input-card/spec.md`

## Design Decisions

### 1. ComposerShell replaces only the input area of Composer.tsx

**Decision**: `ComposerShell` is an internal sub-component of `Composer`, replacing the textarea + send button region only. `Composer.tsx` retains WebSocket streaming, message history, and error state management.

**Rationale**: Minimal refactor. The existing `Composer.tsx` already handles WS streaming and message lifecycle. Replacing only the input area preserves all existing behavior and avoids a full rewrite.

**Alternatives considered**:
- Full Composer rewrite: rejected — high risk, no benefit for this feature
- Inline all add-ons in Composer: rejected — defeats pluggability goal

### 2. Add-on registration via BUILTIN_ADDONS array

**Decision**: Add-ons are registered in a static `BUILTIN_ADDONS` array with `{key, position, Component, label, icon}`. The gear menu iterates this array to render toggles. Position determines render slot ('top', 'bottom', 'inline').

**Rationale**: Simple, no DI framework needed. The array is small (<10 items). Future dynamic registration can be layered on top.

**Alternatives considered**:
- Plugin registry with async loading: overengineered for current needs
- Context-based registration: harder to debug

### 3. Add-on config persisted to localStorage per instanceId

**Decision**: Each shell instance stores its enabled add-ons under `vivim:composer-addons:{instanceId}`. On mount, reads localStorage; on toggle, writes immediately.

**Rationale**: No backend dependency. InstanceId ensures isolation between multiple composers on the same canvas. localStorage catches corruption gracefully (falls back to defaults).

**Alternatives considered**:
- Backend DB storage: overkill for UI toggle state
- URL params: lost on reload

### 4. CSS variables + inline styles (no Tailwind)

**Decision**: All new components use `style={{}}` with CSS variables (`--bg`, `--accent`, `--text`, `--border`).

**Rationale**: Mandated by FR-008 and constitution (frontend conventions). Consistent with existing vivim-final components.

**Alternatives considered**:
- Tailwind classes: violates FR-008
- CSS modules: additional build complexity

### 5. ContentPart normalization to legacy format

**Decision**: `ComposerShell` normalizes backend `ContentPart` blocks to `{kind, content, index}` for `MessageBlock.tsx` compatibility.

**Rationale**: FR-009 requirement. The backend returns structured ContentPart blocks; MessageBlock expects the legacy flat format. Normalization in ComposerShell keeps both systems working.

**Alternatives considered**:
- Rewrite MessageBlock: out of scope
- Normalize in backend: would break other consumers

### 6. ML prerouter classify() called on every submit

**Decision**: `classify()` from `frontend/src/ml/prerouter.ts` is called on submit before sending.

**Rationale**: FR-010 requirement. The prerouter classifies the input text to determine if it's a capability invocation, a search query, or a chat message. Result is available for the add-on system.

**Dependency**: `frontend/src/ml/prerouter.ts` — exists and is already imported in capability flows.

## Dependency Check

| Dependency | Status | Location |
|-----------|--------|----------|
| `classify()` prerouter | ✅ exists | `frontend/src/ml/prerouter.ts:23` |
| `ZLayerId` type | ✅ exists | `frontend/src/shared/z-layer.ts` |
| `WorkspaceTaxonomy` types | ✅ exists | `frontend/src/shared/workspace.ts` |
| `ContentPart` type | ✅ exists | Backend API response format |
| `MessageBlock.tsx` | ✅ exists | `frontend/src/components/canvas/MessageBlock.tsx` |
| `Composer.tsx` | ✅ exists | `frontend/src/components/canvas/Composer.tsx` |
