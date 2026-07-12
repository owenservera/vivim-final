> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-06: Platform Foundation

**Phase:** 6 | **Units:** 6 | **Goal:** Frontend-driven development surface for ongoing platform work

## Problem

After the E2E demo works (Phases 1-5), the platform needs a solid foundation for frontend-driven development. The sandbox is a testing surface, but it needs to evolve into the actual development platform where:
- Every backend capability has a frontend action trigger
- Agents can discover and execute capabilities via WebSocket
- New capabilities render automatically without bespoke frontend code
- Developers can debug, inspect, and manage the system from the UI

## User Story

> As a developer building on VIVIM, I want a frontend platform where every backend capability is automatically surfaced as an interactive UI element. I want to discover, test, and compose capabilities from the browser without writing new frontend code for each one.

## Success Criteria

1. ActionRegistry contains at least 20 registered actions covering all Phase 1-5 functionality
2. AgentBridge correctly routes WebSocket commands and returns results
3. GenericCapabilityRenderer renders any capability based on its UI contract
4. DevTools panel shows live event stream, capability states, and provider health
5. Provider management UI allows adding, removing, and switching providers
6. Workspace settings UI allows configuring profile paths and fleet parameters

## Action Catalog

Core actions that must be registered:

| Action ID | Description | Params |
|-----------|-------------|--------|
| `conversation.create` | Create new conversation | `{ providerId, title }` |
| `conversation.send` | Send message | `{ conversationId, message }` |
| `conversation.list` | List conversations | `{ limit }` |
| `conversation.messages` | Get messages | `{ conversationId, limit }` |
| `provider.list` | List providers | `{}` |
| `provider.capabilities` | Get resolved capabilities | `{ providerId, planTier }` |
| `capability.execute` | Execute capability | `{ conversationId, slug, params }` |
| `setup.workspace` | Set workspace path | `{ path }` |
| `setup.launch` | Launch visible Chrome | `{ providerId, accountSlug }` |
| `setup.verify` | Verify login state | `{ port }` |
| `setup.complete` | Complete setup | `{ providerId, accountSlug, ... }` |
| `fleet.status` | Get fleet status | `{}` |
| `fleet.start` | Start slave | `{ providerId, accountId }` |
| `health.provider` | Get provider health | `{ providerId }` |
| `health.all` | Get all health | `{}` |

## Generic Renderer Contract

The GenericCapabilityRenderer reads the capability's UI contract from `CapabilityResolutionEngine.resolve()` and renders the appropriate component:

```
uiComponent → React component mapping:
  "button"       → <CapabilityButton />
  "toggle"       → <CapabilityToggle />
  "select"       → <CapabilitySelect />
  "input"        → <CapabilityInput />
  "modal"        → <CapabilityModal />
  "panel"        → <CapabilityPanel />
  "inline"       → <CapabilityInline />
  "custom:..."   → lookup in bespoke registry

uiPosition → where in the layout:
  "composer"     → composer toolbar
  "header"       → header bar
  "message"      → message action bar
  "sidebar"      → sidebar panel
  "inline"       → inline with response
```

## DevTools Surface

```
┌─────────────────────────────────────────────┐
│ DevTools Panel                               │
├──────────┬──────────┬──────────┬─────────────┤
│ Events   │ Capabilities │ Fleet │ Health     │
├──────────┴──────────┴──────────┴─────────────┤
│ [Live event stream from EventBus]            │
│ { type: 'conversation:block', ... }          │
│ { type: 'capability:executed', ... }         │
│ { type: 'fleet:slave_status', ... }          │
│                                              │
│ [Capability states]                          │
│ send_message: [OK] hit rate 98%              │
│ select_model: [OK] hit rate 95%              │
│ upload_file: [DEGRADED] hit rate 42%         │
│                                              │
│ [Fleet status]                               │
│ chatgpt_work: running pid=1234 port=9301     │
│ claude_personal: stopped                     │
└─────────────────────────────────────────────┘
```

## Key Files

- `web/ui/src/actions/registry.ts` — ActionRegistry
- `web/ui/src/actions/agent-bridge.ts` — AgentBridge
- `web/ui/src/components/action-trigger.tsx` — ActionTrigger
- `web/sandbox/src/features/generic-capability-renderer.tsx` — Generic renderer
- `web/sandbox/src/features/debug-panel.tsx` — DevTools
- `web/sandbox/src/features/capability-catalog.tsx` — Capability browser

## Units

| Unit | Title | Key Files |
|------|-------|-----------|
| 6.1 | Action catalog with Zod schemas | `web/ui/src/actions/` |
| 6.2 | AgentBridge command routing | `web/ui/src/actions/agent-bridge.ts` |
| 6.3 | Generic capability renderer | `web/sandbox/src/features/` |
| 6.4 | DevTools surface | `web/sandbox/src/features/debug-panel.tsx` |
| 6.5 | Provider management UI | `web/sandbox/src/` |
| 6.6 | Workspace settings UI | `web/sandbox/src/` |

