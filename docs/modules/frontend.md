# Frontend Module

**Purpose:** Next.js-based frontend UI for vivim-final.

## Description
Next.js application with:
- Static export for Tauri desktop integration
- Canvas-based UI for capability-driven chat
- Browser grounding and knowledge envelope features

## Public Interface
- Main entry: `frontend/src/`
- Build: `bun run build` (with dynamic output mode for Tauri)
- Dev server: `bun run dev`

## Internal Gotchas
- Tauri integration requires `output: 'export'` patching in next.config.mjs
- Static export limits some Next.js features (API routes, getServerSideProps)
- Canvas implementation uses browser-grounding patterns

## Owner: VIVIM.inc
## Last Reviewed: 2026-08-15