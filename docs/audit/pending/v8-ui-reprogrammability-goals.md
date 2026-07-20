# V8: Central UI Reprogrammability Engine

## Goal
Transform the V7 "Living Canvas" into a **fully reprogrammable UI system** where every component (side panels, widgets, overlays, drawers, menus, z-layers, connection lines) is hot-swappable and reconfigurable via unified CLI/SDK/API, with a composable design language for shared yet unique properties.

## Vision
> "One system to redesign them all" — The V8 Central UI Engine enables complete workspace metamorphosis via natural language or programmatic intent, while maintaining backend truth-sync and Constitution compliance.

---

## Priority Decisions

### G1: Central Reprogrammability Engine (Core)
- **What**: Single `UIEngine` registry governing ALL UI components
- **CLI**: `/vivim ui list|get|create|update|delete|extend|apply`
- **SDK**: `uiEngine.register()`, `uiEngine.get()`, `uiEngine.setProperty()`, `uiEngine.extendSpec()`
- **Frontend**: `window.vivim.ui` exposed to sandboxed CanvasDefinitions
- **Registration**: Every component (panel, widget, overlay, drawer, menu, z-layer, connection line) exports `ComponentSpec`

### G2: UI Design Language (composable, modular, expandable)
- **Schema**: `{ properties, features, actions, variants, defaultSlot, inheritanceChain }`
- **Inheritance**: `component → categoryDefaults → tierDefaults → systemDefaults`
- **Shared Traits**:
  - `position`: slot, layout rect, z-index, anchor points
  - `layout`: w, h, min/max constraints, resizable axes
  - `visibility`: showWhen, hideWhen, animate transitions
  - `interactivity`: focusable, draggable, contextMenu
  - `styling`: theme tokens, css vars, dark/light mode variants
  - `lifecycle`: onMount, onUpdate, onUnmount hooks (capability slugs)
  - `permissions`: RBAC scope, confirmation gates
  - `validation`: Zod schemas for inputs, deep merge rules

### G3: All UI Fully Reprogrammable
Components to make hot-swappable:
- **Panels**: AuditDashboard, RbacManager, TemplatesGallery, DrawerSystem, NotificationsCenter, OnboardingTour, WorkspaceSwitcher, VCardMenu
- **Widgets**: AgentCard, AutomationCard, DocCard, MediaCard, ShellCard
- **Overlays**: CommandPalette, AgentOverlay, QuickActionsMenu
- **Core**: LivingCanvas, CanvasNode, SandboxedNode, ConnectionLayer, ObservabilityHUD
- **Design flow**: Export spec → modify JSON → POST `/api/ui/blueprint` → `ui:reprogrammed` WS → hot-swap

### G4: Backend Truth-Sync
- HTTP-backed impls of `storage/contracts/*.ts` when `VIVIM_BACKEND_URL` is set
- Contracts unchanged; only swap `memory-*` for `http-*` variants
- No second source of truth in prod

### G5: Plugin Marketplace + Live Author
- Plugin Gallery: browse/install/enable/disable/uninstall
- Author Mode: live edit html/css/scriptUrl and hot-publish

### G6: Agent Canvas Architect
- Agent can redesign UI via `/api/interpret` with HITL confirmation
- Mutations undoable via CommandStack, logged to AuditDashboard

---

## Key Contracts (from V7 + additions)

```ts
// Extend ComponentSpec for full reprogrammability
interface UIComponentSpec extends ComponentSpec {
  // Inheritance
  extends?: string;           // base component id (if extending)
  properties: UIProperties;   // theme, layout, visibility, etc.
  features: string[];         // capability slugs this component supports
  actions: UIAction[];        // per-component action definitions
  variants: Record<string, UIVariant>; // named variants
}

// Property trait system
interface UIProperties {
  position?: { slot?: string; layout?: CanvasLayout; anchor?: 'left'|'right'|'top'|'bottom' };
  layout?: { resizable?: boolean; minWidth?: number; maxWidth?: number };
  visibility?: { showWhen?: string; hideWhen?: string; animation?: string };
  interactivity?: { focusable?: boolean; draggable?: boolean; contextMenu?: boolean };
  styling?: { themeToken?: string; cssVars?: Record<string, string> };
  lifecycle?: { onMount?: string; onUpdate?: string; onUnmount?: string }; // capability slugs
  permissions?: { rbacScope?: string[]; requiresConfirmation?: boolean };
  validation?: { inputSchema?: Record<string, unknown>; outputSchema?: Record<string, unknown> };
}

// Reprogramming API (NEW endpoints)
// GET  /api/ui/component/[id]/spec     — read current component spec
// GET  /api/ui/blueprint               — read full UI layout/theme
// POST /api/ui/blueprint               — apply reprogrammed spec (returns confirmation token if needed)
```

---

## Validation Checkpoints
- [ ] All UI components export ComponentSpec via WS registry
- [ ] `/vivim ui list` shows all registered components
- [ ] `/vivim ui extend <id> --json patch.json` returns new versioned spec
- [ ] POST `/api/ui/blueprint` hot-swaps without page reload
- [ ] Agent can "redesign workspace to dark theme" via NL
- [ ] Cross-surface verification passes for all UI capabilities
- [ ] WCAG 2.1 AA compliance on reprogrammed components
- [ ] Zod ^3.23 pinned (fix V7's ^4.0.2 dependency)

---

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| State loss on reprogram | Versioned specs + backend persistence |
| Security in sandboxed edits | P8 `allowInlineScript:false`, CSP, no inline scripts |
| Performance with 1k+ components | QuadTree culling + React windowing |
| Breaking existing V7 components | Preserve all comments; extend ComponentSpec gradually |

---

## Questions (if any unresolved)
None at this time. Plan is actionable.

## Next Steps (per Build Order)
1. Pin zod ^3.23
2. Create `shared/ui-language.ts` (property traits + inheritance)
3. Build `src/engines/ui-engine.ts` (registry + CLI/SDK/API)
4. Register all current UI components
5. Add backend-sync mode
6. Implement Plugin Gallery
7. Wire Agent Architect
8. Add `/api/ui/blueprint` endpoints
9. Cross-surface verification
10. Tests + A11Y

---

*Derived from V7 source: `src/shared/canvas-types.ts`, `src/sdk/canvas/`, `src/shared/universal-registry.ts`, `src/shared/vcard.ts`, `src/components/canvas/LivingCanvas.tsx`*