# Frontend Reference

## Frontend Sandbox System (Phase 13)
`web/` workspace: Vite + React 19 + TypeScript + Tailwind + Zustand

```
web/
  tsconfig.base.json    # Shared path aliases (@ui, @api-client)
  api-client/           # Typed SDK from 07-merged-api.md
  ui/                   # Shared components + actions
  sandbox/              # SandboxApp MVP
```

## Path Aliases
- `@ui` → `web/ui/src`
- `@api-client` → `web/api-client/src`

## ActionRegistry (web/ui/src/actions/registry.ts)
```typescript
registerAction(name: string, handler: ActionHandler)
dispatch(name: string, args: unknown)
listActions(): string[]
```

## AgentBridge (web/ui/src/actions/agent-bridge.ts)
Enables agent access to all UI actions via WebSocket:
- `agent:command` routing (B8 invariant)
- `agent:discover` for action discovery

## B8 Invariant
Every UI action must be accessible to AI agents via ActionRegistry + AgentBridge.

## Sandbox App
`web/sandbox/src/app/sandbox-app.tsx`:
- Capability catalog
- Harness runner
- Debug panel
- API: `POST /api/sandbox/debug/reset`

## Promoted UI
- `docs/sandbox/PROMOTED.md` — Promotion ledger
- `bun run sandbox new <slug>` — Promote from sandbox to main