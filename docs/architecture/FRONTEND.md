# Architecture — Frontend

> The UI that consumes vivim. Next.js 16 App Router + React 19, Tailwind 4.
> Lives in `frontend/`. Keep current on any `frontend/src/` architecture change.

## What it is

A **thin consumer of the backend capability API** — the frontend does not
second-transport anything. It reads capability `slug` from the backend registry
and renders accordingly (no `if (slug === 'x')` conditionals).

## Key architecture

- **Capability-slug = the link.** Pages are wired to capabilities; the UI is
  rendered from what the capability system declares (`CapabilityResolutionEngine`
  contract), not from hardcoded per-feature branches.
- **Slot system — hot-swappable.** `frontend/src/ui/` has `slots.ts`,
  `registry.ts`, `context.tsx`, `defaults/`. UI slots are **namespaced**
  (`chat.actionBar`, `chat.composer`, `chat.sidebar`). Any slot can be swapped
  at runtime per provider/capability.
- **Surfaces/tabs**: surface tabs (Sidebar / Chat / Canvas / Capabilities /
  Health) with `<Ctrl+Tab>` cycling via `SurfaceTabs.tsx`.
- **Command palette** (`Ctrl+K`), **dev console** (`Ctrl+~`, WS event firehose +
  NL inject). Component signatures in `frontend/src/components/canvas/`.

## Data flow

```
React ↴  fetch  →  :9420/api/* ,openapi.json
        ws     →  ws://9420/ws  (RAF-batched streaming, 60fps flush)
        ↳ state lives in frontend; backend/DB are the source of truth only for
          capability/health data, not for client UI state.
```

Practices: readiness errors surfaced; empty states ("No X yet"); auto-refresh 15s
on health dash; latency-breakdown bar chart; provider badges in conversation
list; execution toasts (2s auto-dismiss).

## Layout

```
frontend/src/
  app/            App Router (layout, page, api/)
  canvas/         canvas live-config
  components/     canvas/, chat/, memory/, ui/, panels…
  engines/        renderer/system composition
  registry/       CapabilityRegistry
  sdk/            frontend SDK bindings
  storage/        storage contracts + memory impls
  ui/             the SLOOT system
  actions/        ActionRegistry + auto-populate
  api/            API client
  shared/, types/ shared/cross-cutting types
```

## Running

- Dev: `cd frontend && bun run dev` (port 3000); build:

```
bun run web:build   # static export (output: 'export')
```

For Tauri, `scripts/prepare-frontend` patches `next.config.mjs` to
`output: 'export'`, builds, then restores.

## Conventions

- Design system = CSS variables (`--bg`, `--text`, `--border`, `--accent`) with
  inline styles — **not** Tailwind-only classes for theming.
- FRONTEND = BACKEND: capability `slug` is the single link; no string-conditional
  feature branching.

## Changing the frontend

- Add/swap a slot → update `ui/slots.ts` + `registry.ts` + `defaults/`.
- Add a capability UI → render from the registry; it appears via surface tabs.
- Keep cross-surface parity: `bun run devops verify-cross-surface`.