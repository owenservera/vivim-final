# User Journey Moments — Atomic Task List

**Phase:** 100 (User-Centric Frontend)
**Core Concept:** Frontend Sandbox Driven Development
**Status:** DEFINED — Ready for Implementation

---

## Architecture Principle

```
Sandbox ( prototype ) → App ( production )
       ↓                        ↓
  Validate moments          Graduate proven
  in isolation              components
```

Every moment is first built in `web/sandbox/`, validated with real backend, then graduated to `web/app/`.

---

## Moment Definitions

### M-001: App Launch
**User sees:** Empty state or capability catalog
**Component:** `SandboxApp`
**Store:** `useCapabilityStore`
**API:** `GET /api/providers`
**Test:** Sandbox boots without errors

### M-002: Catalog Load
**User sees:** List of capabilities from DB
**Component:** `CapabilityCatalog`
**Store:** `useCapabilityStore.loadCapabilities()`
**API:** `GET /api/providers/:id/capabilities?planTier=free`
**Test:** Capabilities render with correct names

### M-003: Provider Login
**User sees:** Chrome window opens, provider auth page
**Component:** `ProviderSetupWizard`
**Store:** N/A (Chrome lifecycle)
**API:** `POST /api/providers/:id/accounts`
**Test:** Chrome launches, login page loads

### M-004: Session Confirm
**User sees:** "Connected" status, ready for conversation
**Component:** `ProviderStatusBadge`
**Store:** `useFleetStore`
**API:** `GET /api/fleet/status`
**Test:** Fleet shows running slave for provider

### M-005: Conversation Create
**User sees:** New conversation appears in list
**Component:** `ConversationList` + `CreateConversationModal`
**Store:** `useConversationStore`
**API:** `POST /api/conversations`
**Test:** Conversation created, appears in sidebar

### M-006: Message Send
**User sees:** Message appears in thread, loading state
**Component:** `MessageComposer` + `MessageThread`
**Store:** `useConversationStore.sendMessage()`
**API:** `POST /api/conversations/:id/send`
**Test:** Message sent, appears in thread

### M-007: Response Receive
**User sees:** Response streams in from provider
**Component:** `MessageThread`
**Store:** `useConversationStore` (WS events)
**API:** WebSocket `conversation:complete`
**Test:** Response appears within 5s

### M-008: Stream Display
**User sees:** Formatted response with markdown
**Component:** `MessageBubble`
**Store:** `useConversationStore.messages`
**API:** `GET /api/conversations/:id/messages`
**Test:** Response renders with correct formatting

### M-009: Capability Trigger
**User sees:** Capability button in conversation context
**Component:** `CapabilityToolbar`
**Store:** `useCapabilityStore`
**API:** `POST /api/conversations/:id/capabilities/:slug/execute`
**Test:** Button click triggers execution

### M-010: Provider Switch
**User sees:** Provider changes, conversation context updates
**Component:** `ProviderSelector`
**Store:** `useProviderStore`
**API:** `GET /api/providers`
**Test:** Switch provider, catalog updates

### M-011: Multi-Conversation
**User sees:** Multiple conversations in sidebar
**Component:** `ConversationList`
**Store:** `useConversationStore.list()`
**API:** `GET /api/conversations`
**Test:** Switch between conversations

### M-012: Fleet Status
**User sees:** Chrome fleet health indicator
**Component:** `FleetStatusBar`
**Store:** `useFleetStore`
**API:** `GET /api/fleet/status`
**Test:** Status shows running/stopped slaves

### M-013: Capability Detail
**User sees:** Full capability UI contract display
**Component:** `CapabilityDetailPanel`
**Store:** `useCapabilityStore.selected`
**API:** `GET /api/providers/:id/capabilities`
**Test:** All 21 fields render correctly

### M-014: Capability Result
**User sees:** Execution result inline
**Component:** `CapabilityResultPanel`
**Store:** `useExecutionStore`
**API:** WebSocket `capability:progress`
**Test:** Result appears after execution

---

## Atomic Units (Phase 100)

### Conversation UI Units

| Unit | Name | Depends | Components | Store | API |
|------|------|---------|------------|-------|-----|
| **100.1** | Conversation List View | 90.8 | `ConversationList` | `useConversationStore` | `GET /api/conversations` |
| **100.2** | Conversation Create Flow | 100.1 | `CreateConversationModal` | `useConversationStore.create()` | `POST /api/conversations` |
| **100.3** | Message Thread View | 100.1 | `MessageThread` | `useConversationStore.messages` | `GET /api/conversations/:id/messages` |
| **100.4** | Message Send Composer | 100.3 | `MessageComposer` | `useConversationStore.send()` | `POST /api/conversations/:id/send` |
| **100.5** | Response Stream Display | 100.3 | `MessageBubble` | WS `conversation:complete` | WebSocket |
| **100.6** | Provider Selector | 100.1 | `ProviderSelector` | `useProviderStore` | `GET /api/providers` |

### Capability UI Units

| Unit | Name | Depends | Components | Store | API |
|------|------|---------|------------|-------|-----|
| **100.7** | Capability Toolbar | 100.3 | `CapabilityToolbar` | `useCapabilityStore` | `GET /api/conversations/:id/capabilities` |
| **100.8** | Capability Result Panel | 100.7 | `CapabilityResultPanel` | `useExecutionStore` | WebSocket `capability:progress` |
| **100.9** | Capability Execute Flow | 100.7, 90.6 | `CapabilityExecuteButton` | `ActionRegistry.dispatch()` | `POST /api/conversations/:id/capabilities/:slug/execute` |

### System UI Units

| Unit | Name | Depends | Components | Store | API |
|------|------|---------|------------|-------|-----|
| **100.10** | Fleet Status Bar | 100.1 | `FleetStatusBar` | `useFleetStore` | `GET /api/fleet/status` |
| **100.11** | Settings Panel | 100.1 | `SettingsPanel` | `useConfigStore` | `GET /api/config/:engineId` |
| **100.12** | Debug Console | 90.8 | `DebugConsole` | WS events | WebSocket |

### Integration Units

| Unit | Name | Depends | Description |
|------|------|---------|-------------|
| **100.13** | First Conversation E2E | 100.1-100.8 | Full loop: create → send → receive → display |
| **100.14** | First Capability E2E | 100.7-100.9 | Full loop: select → execute → result |
| **100.15** | Sandbox → App Graduate | 100.13, 100.14 | Move proven components to `web/app/` |

---

## Store Definitions

### useConversationStore
```typescript
interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  loading: boolean
  error: string | null
  
  list: (opts?: { providerId?: string }) => Promise<void>
  create: (providerId: string, title?: string) => Promise<Conversation>
  select: (id: string) => Promise<void>
  send: (conversationId: string, message: string) => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
}
```

### useFleetStore
```typescript
interface FleetState {
  slaves: FleetSlave[]
  loading: boolean
  
  refresh: () => Promise<void>
  start: (providerId: string, accountId: string) => Promise<void>
  stop: (providerId: string, accountId: string) => Promise<void>
}
```

### useExecutionStore
```typescript
interface ExecutionState {
  activeExecution: Execution | null
  results: ExecutionResult[]
  
  execute: (conversationId: string, slug: string) => Promise<void>
  clearResult: () => void
}
```

---

## API Contract Mapping

| Unit | Endpoint | Method | Request | Response |
|------|----------|--------|---------|----------|
| 100.1 | `/api/conversations` | GET | `?providerId=&limit=&offset=` | `ConversationRow[]` |
| 100.2 | `/api/conversations` | POST | `{ providerId, title? }` | `ConversationRow` |
| 100.3 | `/api/conversations/:id/messages` | GET | `?limit=&before=` | `ConversationMessageRow[]` |
| 100.4 | `/api/conversations/:id/send` | POST | `{ message }` | `SendResult` |
| 100.5 | WebSocket | — | — | `conversation:complete` |
| 100.6 | `/api/providers` | GET | `?isActive=true` | `ProviderSummary[]` |
| 100.7 | `/api/conversations/:id/capabilities` | GET | `?planTier=free` | `ResolvedCapabilities` |
| 100.8 | WebSocket | — | — | `capability:progress` |
| 100.9 | `/api/conversations/:id/capabilities/:slug/execute` | POST | `{}` | `ExecutionResult` |
| 100.10 | `/api/fleet/status` | GET | — | `ChromeSlave[]` |
| 100.11 | `/api/config/:engineId` | GET | `?scopeType=&scopeId=` | `ConfigEntry` |

---

## Component Hierarchy

```
SandboxApp
├── ProviderSetupWizard (M-003, first run only)
├── Header
│   ├── ProviderSelector (100.6)
│   ├── FleetStatusBar (100.10)
│   └── SettingsButton → SettingsPanel (100.11)
├── Sidebar
│   ├── ConversationList (100.1)
│   │   └── CreateConversationButton (100.2)
│   └── CapabilityCatalog (existing)
└── Main
    ├── MessageThread (100.3)
    │   ├── MessageBubble[] (100.5)
    │   └── CapabilityResultPanel (100.8)
    ├── MessageComposer (100.4)
    └── CapabilityToolbar (100.7)
        └── CapabilityExecuteButton (100.9)
```

---

## Gate Criteria

### Per-Unit Gate
- [ ] Component renders without errors
- [ ] Store state updates correctly
- [ ] API call succeeds (mock or real)
- [ ] `bun run typecheck` passes
- [ ] Unit test passes

### Phase Gate (100.13-100.15)
- [ ] Full conversation loop works E2E
- [ ] Full capability loop works E2E
- [ ] First component graduated to `web/app/`
- [ ] `bun run devops gate` passes
- [ ] `docs/sandbox/PROMOTED.md` updated

---

## Implementation Order

```
Sprint 1: Conversation Foundation (100.1-100.4)
  ├── 100.1 Conversation List View
  ├── 100.2 Conversation Create Flow
  ├── 100.3 Message Thread View
  └── 100.4 Message Send Composer

Sprint 2: Response & Provider (100.5-100.6)
  ├── 100.5 Response Stream Display
  └── 100.6 Provider Selector

Sprint 3: Capability Integration (100.7-100.9)
  ├── 100.7 Capability Toolbar
  ├── 100.8 Capability Result Panel
  └── 100.9 Capability Execute Flow

Sprint 4: System UI (100.10-100.12)
  ├── 100.10 Fleet Status Bar
  ├── 100.11 Settings Panel
  └── 100.12 Debug Console

Sprint 5: Integration & Graduation (100.13-100.15)
  ├── 100.13 First Conversation E2E
  ├── 100.14 First Capability E2E
  └── 100.15 Sandbox → App Graduate
```

---

## Dependency Graph

```
100.1 ──┬──► 100.2
        ├──► 100.3 ──┬──► 100.4
        │            ├──► 100.5
        │            └──► 100.7 ──┬──► 100.8
        │                        └──► 100.9
        ├──► 100.6
        ├──► 100.10
        └──► 100.11
        
100.12 (standalone, uses existing 90.8)

100.13 depends on: 100.1-100.8
100.14 depends on: 100.7-100.9
100.15 depends on: 100.13, 100.14
```

---

*This atomic list parallels the devops system and will integrate into one unified tracker.*
