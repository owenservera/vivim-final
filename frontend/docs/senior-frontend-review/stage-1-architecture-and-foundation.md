# Senior Frontend Review — Stage 1: Architecture & Foundation

**Status:** Complete & Actionable  
**Target Components:** `next.config.mjs`, `src/app/page.tsx`, `src/storage/impl/prisma-onboarding-store.ts`, `tsconfig.json`

---

## 1. Overview & Architectural Findings

Stage 1 focuses on the core build system, type checking strictness, Prisma schema alignment, and root App Router page handlers.

### Key Flaws Identified:
1. **Disabled Typechecking in Next.js Build (`next.config.mjs` line 19):**
   `ignoreBuildErrors: true` was introduced as a temporary workaround during an upgrade, allowing invalid TypeScript code to bypass `next build` and land in production static exports.
2. **NO-OP Event Handler in Root Palette (`src/app/page.tsx` lines 390-407):**
   The `PanelPalette` component's `onSelect` callback contains commented-out placeholder logic. Selecting a panel via `Cmd+Shift+P` closes the palette but fails to open/toggle the panel in the active SSOA layer.
3. **Orphan Prisma Schema & Storage Mismatch (`frontend/prisma/schema.prisma` vs `src/storage/impl/prisma-onboarding-store.ts`):**
   `frontend/prisma/schema.prisma` contains dummy models (`Post`, `User`) while `prisma-onboarding-store.ts` expects a `UserOnboarding` model that exists only in the root application schema (`../prisma/schema.prisma`).

---

## 2. Verbatim Implementation Specifications

### Fix 1: `src/app/page.tsx` — PanelPalette Handler

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/app/page.tsx`  
**Target Lines:** 390–407

#### Target Code to Replace:
```tsx
      {/* Panel palette (Cmd+Shift+P) */}
      <PanelPalette
        open={panelPaletteOpen}
        onOpenChange={setPanelPaletteOpen}
        onSelect={(panelId) => {
          const ss = sessionRef.current;
          const layerId = ss.activeLayer;
          const layer = ss.layers[layerId];
          if (layer) {
            if (layer.openPanels.includes(panelId)) {
              // If already open, just focus/blur close — here we just close it
              // In a full impl, this would focus the panel
            } else {
              // Open the panel on the active layer
            }
          }
          setPanelPaletteOpen(false);
        }}
      />
```

#### Replacement Code (Verbatim):
```tsx
      {/* Panel palette (Cmd+Shift+P) */}
      <PanelPalette
        open={panelPaletteOpen}
        onOpenChange={setPanelPaletteOpen}
        onSelect={(panelId) => {
          const ss = sessionRef.current;
          const layerId = ss.activeLayer;
          dispatchRef.current({ type: 'PANEL_TOGGLE', layerId, panelId });
          setPanelPaletteOpen(false);
        }}
      />
```

---

### Fix 2: `next.config.mjs` — Enforce Build Typechecking & Clean Exports

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/next.config.mjs`  
**Target Lines:** 15–20

#### Target Code to Replace:
```javascript
  typescript: {
    // TODO(session 3): remove this once frontend typecheck is clean.
    // Currently ignored because the WP-10 upgrade left ~30 frontend type
    // errors that don't block the build but should be fixed.
    ignoreBuildErrors: true,
  },
```

#### Replacement Code (Verbatim):
```javascript
  typescript: {
    // Enforce strict type checking during builds
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
```

---

### Fix 3: `src/storage/impl/prisma-onboarding-store.ts` — Prisma Model Type Definition

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/storage/impl/prisma-onboarding-store.ts`  
**Target Lines:** 37–40

#### Target Code to Replace:
```typescript
interface PrismaLike {
  userOnboarding: PrismaDelegate
}
```

#### Replacement Code (Verbatim):
```typescript
export interface PrismaLike {
  userOnboarding: PrismaDelegate
  [key: string]: unknown
}
```

---

## 3. Stage 1 Verification Protocol

After applying the 3 fixes above, execute the following commands in `frontend/`:

```bash
# 1. Verify route-sync and unit tests
bun test tests/unit/ tests/route-sync.test.ts

# 2. Test dual-mode Next.js build
bun run build

# 3. Test static export for Tauri V2
bun run build:tauri
```
