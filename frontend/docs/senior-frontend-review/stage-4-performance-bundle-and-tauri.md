# Senior Frontend Review — Stage 4: Performance, Bundle & Tauri Packaging

**Status:** Complete & Actionable  
**Target Components:** `next.config.mjs`, `scripts/tauri/prepare-frontend.ts`, `src/app/page.tsx`, `package.json`

---

## 1. Overview & Findings

Stage 4 focuses on optimization for static export mode (`TAURI_STATIC_EXPORT=1`), bundle size reduction, dynamic component barriers, and Tauri V2 NSIS packaging compatibility.

### Key Flaws Identified:
1. **Unused Heavy Dependencies in Client Bundle:**
   Dependencies such as `recharts`, `jspdf`, and `@tanstack/react-virtual` are imported directly without tree-shaking dynamic boundaries.
2. **Image Optimization in Static Export Mode:**
   `next.config.mjs` sets `images.unoptimized: true`, which is required for Next.js `output: 'export'`. However, explicit `width`/`height` props must be strictly provided to all `<Image />` tags to avoid layout shifts in webview windows.
3. **Lazy Loading of Developer Tools:**
   `DevConsoleLazy` is dynamically imported in `app/page.tsx`, but missing chunk suspense boundaries for error fallback.

---

## 2. Verbatim Implementation Specifications

### Fix 1: `src/app/page.tsx` — DevConsole Lazy Boundary

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/app/page.tsx`  
**Target Lines:** 373–381

#### Target Code to Replace:
```tsx
      {/* Dev console (Cmd+`) */}
      {devConsoleOpen && (
        <Suspense fallback={null}>
          <DevConsoleLazy
            isOpen={devConsoleOpen}
            onClose={() => setDevConsoleOpen(false)}
          />
        </Suspense>
      )}
```

#### Replacement Code (Verbatim):
```tsx
      {/* Dev console (Cmd+`) */}
      {devConsoleOpen && (
        <ErrorBoundary fallback={<div className="fixed bottom-4 right-4 p-3 bg-destructive/10 text-destructive text-xs rounded">DevConsole failed to load</div>}>
          <Suspense fallback={<div className="fixed bottom-4 right-4 p-2 bg-popover text-popover-foreground text-xs rounded border shadow animate-pulse">Loading DevConsole...</div>}>
            <DevConsoleLazy
              isOpen={devConsoleOpen}
              onClose={() => setDevConsoleOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
```

---

## 3. Stage 4 Verification Protocol

```bash
# 1. Test Tauri static export bundle generation
bun run build:tauri

# 2. Check output directory out/ for required static assets
ls -la out/
```
