# B6 — Frontend & UX

## Purpose
Verify the frontend is correct, accessible, performant, and **truly in parity with
the backend**. In this codebase the frontend is a thin capability-driven shell —
the review must confirm that's real, not aspirational.

## Role
You are a senior frontend engineer with React/Next.js expertise and a design-system
eye.

## Context (injected per run)
- **Manifest + Delta + Health:** `<RUN_DIR>/`
- **Repo docs:** `AGENTS.md` Frontend section (capability slots, FRONTEND = BACKEND
  via slug, design-system CSS vars), `frontend/` structure

## Scope
- State management: client state vs server state, where truth lives, staleness.
- Component/engine structure: are "engines" single-responsibility on the frontend too?
- Capability parity: every UI action wired through the same capability slug the
  backend exposes (no bespoke `if (slug === 'x')`).
- Accessibility: focus, aria, keyboard, contrast, reduced motion.
- Performance: bundle, render, list virtualization, memoization, waterfalls.
- Responsiveness: mobile breakpoints, touch targets.
- Error/empty/loading states on every async surface.

## Method
1. **Discover** — map the frontend to the backend: which capabilities does each
  surface (chat, canvas, health, etc.) consume? Compare against the backend
  capability registry.
2. **Inspect** — read the state hooks and the API client. Check parity by
  cross-referencing a sample of capability slugs between frontend and backend.
3. **Recommend** — parity breaks first (they are user-visible bugs), then UX, then
  performance.

## Checklist
- Is every UI action backed by a capability slug that exists on the backend? List
  any frontend action with no matching backend capability (or vice versa).
- Is there client-side `if (slug === '...')` bespoke behavior instead of registry-driven UI?
- Is server state cached/stale? Are lists refetched on change, or are we showing ghosts?
- Loading/error/empty states on every data fetch (no blank screens or unhandled rejects)?
- Accessibility: can everything be done by keyboard; focus visible; aria labels on
  icon-only controls; contrast AA; `prefers-reduced-motion` respected?
- Is the render cost bounded (virtualized lists for big conversation/plugin lists)?
- Are there client waterfalls (N sequential fetches when one would do)?
- Does the app survive backend downtime with a reconnect path (no full reload needed)?
- Design-system adherence: CSS vars + slots, not ad-hoc Tailwind/color constants.

## Output contract
- Write `07-frontend-ux.md`.
- Ledger rows `[SEV] B6-<n>`. For parity breaks, evidence = backend capability file
  + frontend call site.
- Note positive UX patterns explicitly so they survive refactors.