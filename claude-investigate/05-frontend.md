# Investigation Report: Frontend Layer (219 TSX components, 23 dirs)

## Area Overview
- **Framework**: Next.js 16 + React 19 + Tailwind 4 + Radix UI
- **Location**: `frontend/src/` (NOT `web/ui/`)
- **Components**: 219 TSX files across `app/`, `components/`, `canvas/`, `ui/`, `features/`, etc.

---

## Finding 1: P1 — Oversized Components (>20KB)

**Files exceeding 20 KB**:
| File | Size |
|------|------|
| `guided-landing` | 40.4 KB |
| `LivingCanvas` | 35.9 KB |
| `ReprogramModal` | 34.5 KB |
| `sidebar` | 21.1 KB |

**Issue**: These components are doing too much — likely combining state management, data fetching, and rendering in one file.

**Resolution**:
1. Split by concern (container/presentational, or by feature slice)
2. Extract hooks to `hooks/` and utility functions to `lib/`
3. Break into smaller composable components

---

## Finding 2: P2 — `page.tsx` 16.5 KB Main Entry

**Location**: `frontend/src/app/page.tsx` (16,500 bytes)

**Issue**: The main page component is doing too much — routing logic, layout, and possibly data fetching all in one file.

**Resolution**:
1. Extract layout concerns into a layout component
2. Move data fetching to server components or hooks
3. Keep the page.tsx as a thin routing shell

---

## Finding 3: P3 — Dependency Bloat Risk

**Location**: `frontend/package.json`

The frontend has 40+ Radix UI packages, plus Next.js 16, React 19, Prisma 6, Tailwind 4, and other heavy dependencies. While not a bug, this increases bundle size.

**Resolution**:
1. Audit unused Radix packages with `npx depcheck`
2. Consider lazy-loading rarely-used components
3. Review bundle analysis with `next build`

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| 4 components >20KB | P1 | Medium | Maintainability |
| page.tsx 16.5KB entry | P2 | Low | Architecture |
| Dependency bloat risk | P3 | Low | Performance |

**Estimated Total Effort**: 2-3 days
