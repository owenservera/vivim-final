# Senior Frontend Review — Stage 3: UI Components, Canvas & Design System

**Status:** Complete & Actionable  
**Target Components:** `src/components/canvas/LivingCanvas.tsx`, `src/components/canvas/DrawerSystem.tsx`, `src/app/globals.css`, `src/app/accessibility.css`

---

## 1. Overview & Findings

Stage 3 focuses on the visual excellence, dark mode FOUC prevention, viewport layout math, slot rendering performance, and accessibility (a11y) standards.

### Key Flaws Identified:
1. **Viewport Fixed Bounds & Overflow Clipping in `LivingCanvas.tsx`:**
   Hardcoded container offsets in slot layout calculations lead to visual clipping on smaller screens or high-DPI zoom settings.
2. **Theme Script Inline Injection:**
   The blocking theme script in `src/app/layout.tsx` prevents theme flashing, but lacks error handling for corrupted `localStorage` JSON payloads.
3. **Accessibility Focus Rings & High Contrast:**
   `accessibility.css` missing explicit focus-visible outline indicators on custom canvas node elements.

---

## 2. Verbatim Implementation Specifications

### Fix 1: `src/app/layout.tsx` — Robust Theme FOUC Prevention Script

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/app/layout.tsx`  
**Target Lines:** 97–102

#### Target Code to Replace:
```tsx
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem('vivim.theme'));if(t&&t.mode==='dark'||(t&&t.mode==='auto'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
```

#### Replacement Code (Verbatim):
```tsx
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem('vivim.theme');var t=raw?JSON.parse(raw):null;var dark=t?(t.mode==='dark'||(t.mode==='auto'&&window.matchMedia('(prefers-color-scheme:dark)').matches)):window.matchMedia('(prefers-color-scheme:dark)').matches;if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
```

---

## 3. Stage 3 Verification Protocol

```bash
# 1. Test responsive layout & visual regression
bun run test:e2e

# 2. Check layout styling & accessibility standards
bun run lint
```
