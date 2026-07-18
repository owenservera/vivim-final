# PRD-C5: Data-Driven Seeding

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-16
**Part of:** [PRD-C1: Unified Infinite-Canvas Surface](prd-canvas-unified-surface.md)

## 1. Problem

The backend `ResolvedCapability` has UI fields (`resultComponent`, `uiPosition`, etc.) but no per-slot override map. The frontend `UIComponentRegistry` has no server-provided slot manifest. Swaps can't be discovered or seeded from the backend.

## 2. Goals

- **G1 — `uiSlots` contract.** Extend `ResolvedCapability` with `uiSlots: { [slotId]: { component?: string; sandbox?: string[] } }`.
- **G2 — Populate from DB.** `ProviderCapability.ui_component_override` (or new column) populates `uiSlots` in the capability resolution pipeline.
- **G3 — Frontend apply.** On capability load, frontend reads `uiSlots` and calls `nodeTypes` registration for each entry.
- **G4 — Resolution chain.** `uiSlots` overrides are layered: global defaults → plan tier → provider overrides.

## 3. Design

### 3.1 Backend contract extension

```typescript
// src/engines/capability-resolution.ts (extended)
export interface ResolvedCapability {
  // ... existing fields
  uiSlots?: {
    [slotId: string]: {
      component?: string  // catalog key → resolves to a React component
      sandbox?: string[]  // P8: capability slugs this renderer may touch
    }
  }
}
```

### 3.2 DB column (optional, for persistence)

```sql
ALTER TABLE provider_capability ADD COLUMN ui_component_override JSONB;
-- Format: { "chat.bubble": { "component": "claude-bubble", "sandbox": ["claude.*"] } }
```

### 3.3 Frontend application

```tsx
// On capability load
const capabilities = await fetchCapabilities(conversationId)
for (const cap of capabilities) {
  if (cap.uiSlots) {
    for (const [slotId, claim] of Object.entries(cap.uiSlots)) {
      applyNodeTypesClaim(slotId, cap.slug, claim)
    }
  }
}
```

## 4. Acceptance

- `GET /api/capabilities` returns `uiSlots` map per capability
- Frontend applies `uiSlots` → nodeTypes on load
- A provider can override a slot by setting `uiSlots['chat.bubble'] = { component: 'my-bubble' }`
- Resolution chain works: global < plan < provider
