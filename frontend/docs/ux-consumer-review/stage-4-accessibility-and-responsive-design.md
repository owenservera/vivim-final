# Consumer UX Review — Stage 4: Accessibility & Mobile Touch Adaptability

**Target Components:** `src/app/accessibility.css`, `src/components/canvas/MobileNav.tsx`, `src/components/canvas/TabBar.tsx`

---

## 1. UX Audit & Accessibility Analysis

### Current UX Standards Gap:
1. **Touch Target Size (< 44x44px):**  
   Several interactive icons in `TabBar.tsx` and `MobileNav.tsx` have bounding boxes below 36px, leading to mis-taps on touch devices.
2. **Contrast & Focus Outline Visibility:**  
   High-contrast mode and visible focus rings need explicit `outline: 2px solid var(--ring)` styling when navigating via keyboard or screen reader.

---

## 2. Verbatim Implementation Specifications

### Fix 1: `src/app/accessibility.css` — Touch Target & Focus Standard

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/app/accessibility.css`  
**Target Action:** Append minimum touch target and visible focus ring utilities.

```css
/* Verbatim Consumer Accessibility Rules */
@media (pointer: coarse) {
  button, a, input, select, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
}

:focus-visible {
  outline: 2px solid var(--primary, #3b82f6) !important;
  outline-offset: 2px !important;
}
```

---

## 3. Verification Protocol

```bash
# Verify css styling & build
bun run build
```
