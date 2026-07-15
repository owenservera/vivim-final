# Unit 37.1 — React Workspace SDK

**Fork ID:** 13.2 (v3: 10.2) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** `sdk/` contains only `src/client.ts` (CapStoreClient) + `src/index.ts`. No `sdk/react`, no `CapStoreProvider`/`useCapStore`. Web UI uses hand-written `ActionRegistry`. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.2-react-workspace-sdk.md`
**Depends on:** Typed SDK v2 (13.1 `[~]`), v10 universal routes

## Context
The typed REST SDK (`sdk/`) exists. A React SDK wraps it with hooks/providers so the workspace UI consumes capabilities without hand-wiring fetch.

## Current State
- `sdk/src/client.ts` — `CapStoreClient` (171 lines) exists.
- `web/ui/` has hand-written `ActionRegistry`/`catalog.ts`; not SDK-backed.

## Requirements
New `sdk/react/` (or `web/ui/src/sdk/`):
- `CapStoreProvider` + `useCapStore()` context.
- Hooks: `useCapabilities()`, `useConversation(id)`, `useProvider(id)`, `useInterpret()`.
- Auto-generated from `UnifiedCapabilityRegistry` surface `ui`.
- Thin wrapper over `CapStoreClient`.

## Acceptance Criteria
1. `CapStoreProvider` exposes typed hooks.
2. Hooks call the v10 universal routes (`/api/capabilities`, `/api/interpret`).
3. No duplicate fetch logic vs `CapStoreClient`.
4. `bun run devops gate` passes (`web/`).

## Tests
`web/ui/src/sdk/__tests__/react-sdk.test.tsx` — provider + hook returns data from mocked client.

## DevOps
```powershell
bun run devops gate
```
