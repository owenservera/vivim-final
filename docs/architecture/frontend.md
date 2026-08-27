# Architecture — Frontend

> React UI, canvas system, and capability slot architecture.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Styling | CSS variables + inline styles (NOT Tailwind) |
| Components | Radix UI primitives |
| State | React hooks + WebSocket |
| Testing | Bun test + Playwright E2E |

**Location:** `frontend/` (NOT `web/ui/`)

---

## Design System

### CSS Variables

All components use CSS custom properties for theming:

```css
var(--bg)      /* Background color */
var(--text)    /* Text color */
var(--border)  /* Border color */
var(--accent)  /* Accent/highlight color */
```

**Rule:** Use CSS variables, not Tailwind classes. The design system is inline-style based.

### UI Slots

The UI is composed of **swappable capability-global slots** resolved through a `UIComponentRegistry`:

| Slot ID | Location | Purpose |
|---------|----------|---------|
| `chat.composer` | Chat area | Message input |
| `chat.actionBar` | Below message | Action buttons |
| `chat.sidebar` | Left panel | Conversation list |
| `capabilities.grid` | Capabilities page | Capability browser |
| `health.dashboard` | Health page | Provider health cards |

Any slot can be hot-swapped at runtime per provider/capability.

---

## Key Components

### Chat UX

| Component | File | Purpose |
|-----------|------|---------|
| `Composer.tsx` | `frontend/src/components/chat/` | Message input with provider selector |
| `MessageBlock.tsx` | `frontend/src/components/chat/` | Renders individual response blocks |
| `ConversationList.tsx` | `frontend/src/components/chat/` | Sidebar conversation list |
| `LatencyBreakdown.tsx` | `frontend/src/components/chat/` | Response time visualization |

### Capability System

| Component | File | Purpose |
|-----------|------|---------|
| `CapabilityCatalog.tsx` | `frontend/src/components/canvas/` | Searchable capability grid |

### Dev Tools

| Component | File | Purpose |
|-----------|------|---------|
| `DevConsole.tsx` | `frontend/src/components/canvas/` | WS event firehose + NL inject |
| `CommandPalette.tsx` | `frontend/src/components/ui/` | Ctrl+K command palette |

### Admin

| Component | File | Purpose |
|-----------|------|---------|
| `HealthDashboard.tsx` | `frontend/src/components/canvas/` | Provider health cards |
| `ProviderManager.tsx` | `frontend/src/components/canvas/` | Account CRUD modal |
| `WorkspaceSettings.tsx` | `frontend/src/components/canvas/` | Fleet/chrome config |

---

## Canvas System

The canvas is a live-config surface for visual programming and capability composition:

```
frontend/src/canvas/       # Canvas core
frontend/src/features/     # Feature modules (onboarding, provider-setup-wizard)
```

### Canvas Layer Mounting

`CanvasLayerMounter` engine handles dynamic layer injection into the canvas.

---

## Storage Contracts

Frontend storage follows the same contract pattern as the backend:

```
frontend/src/storage/contracts/   # Interfaces
frontend/src/storage/impl/        # Implementations (memory, localStorage, etc.)
```

---

## WebSocket Streaming

Real-time response streaming uses RAF-batched (60fps) WebSocket updates:

```typescript
// Pending blocks accumulated in a ref
// Flushed to DOM via requestAnimationFrame
pendingBlocksRef.current.push(block)
requestAnimationFrame(flushBlocks)
```

This prevents React re-render overhead from individual stream chunks.

---

## Building

```bash
cd frontend

# Development
bun run dev          # Port 3000

# Production
bun run build        # Static export to out/
bun run build:tauri  # Tauri-optimized build

# Type check
bun run typecheck

# Tests
bun run test         # Unit + integration
bun run test:e2e     # Playwright E2E
```

---

## File Organization

```
frontend/src/
  app/           # Next.js App Router (layout, page, api/)
  canvas/        # Canvas live-config
  components/    # React components (canvas/, chat/, memory/, ui/)
  engines/       # Frontend engines (canvas, workspace, plugin, rbac, presence)
  features/      # Feature modules (onboarding, provider-setup-wizard)
  hooks/         # React hooks
  registry/      # CapabilityRegistry
  sdk/           # Frontend SDK
  storage/       # Storage contracts + memory impls
  ui/            # Slot system (slots.ts, registry.ts, context.tsx, defaults/)
  actions/       # ActionRegistry + auto-populate
  api/           # API client
  types/         # TypeScript types
```

---

See [OVERVIEW.md](OVERVIEW.md) for the high-level mental model.
