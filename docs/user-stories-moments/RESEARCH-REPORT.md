# User Journey Moments — Research Report

**Date:** 2026-07-11
**Status:** ANALYSIS COMPLETE — Ready for Structured Atomic List Creation

---

## Executive Summary

The user journey storyboard reference (`.kilo/plans/1783737979221-user-journey-storyboard.md`) is **missing**, but the `user-journey-completion-plan.md` contains the moment-to-unit mapping. The `docs/user-stories-moments/` directory is **empty** — this is the gap we need to fill.

**Core Concept:** Frontend Sandbox Driven Development — the sandbox IS the user app prototype. Every moment validated in sandbox graduates to `web/app/`.

---

## Existing Moment Definitions (from user-journey-completion-plan.md)

| Moment | Name | Required Units | Status | Description |
|--------|------|---------------|--------|-------------|
| **M-001** | App Launch | 13.1-13.4 | ✅ DONE | Sandbox boots, shows catalog |
| **M-002** | Catalog Load | 13.9 | ✅ DONE | Capabilities load from DB |
| **M-003** | Provider Login | 14.2, 14.4 | ⚠ STUB | Chrome launches, provider auth detected |
| **M-004** | Session Confirm | 11.3, 11.4, 3.1 | ⚠ BLOCKED | Provider session established |
| **M-005** | Conversation Create | 3.6, 10.1 | ✅ DONE | New conversation created |
| **M-006** | Message Send | 4.3, 3.6 | ✅ DONE | User sends message |
| **M-007** | Response Receive | 14.2, 14.5, 14.7 | ⚠ STUB | Response captured from provider |
| **M-008** | Stream Display | 3.2, 3.3, 3.8, 4.1 | ✅ DONE | Response displayed in UI |
| **M-009** | Capability Execute | 5.3, 3.6 | ✅ DONE | Capability button triggers action |
| **M-013** | Capability Catalog Detail | 13.4, 13.6 | ⚠ PARTIAL | Full capability details shown |
| **M-014** | Capability Exec with Result | 18.2, 13.6, 4.2, 14.7 | ⚠ BLOCKED | Capability executes, result rendered |

---

## Key Moments Identified (User Journey Arc)

### Phase A: Bootstrap (M-001 → M-002)
**User Goal:** "I want to see what this app can do"
1. **M-001: App Launch** — Sandbox boots, shows empty state or catalog
2. **M-002: Catalog Load** — Capabilities populate from backend DB
3. **M-002b: Provider Discovery** — User sees available providers (Claude, ChatGPT, Gemini)

### Phase B: Connection (M-003 → M-004)
**User Goal:** "I want to connect my AI provider"
4. **M-003: Provider Login** — Chrome launches, user authenticates with provider
5. **M-004: Session Confirm** — Provider session established, ready for conversation

### Phase C: Conversation (M-005 → M-008)
**User Goal:** "I want to chat with my AI"
6. **M-005: Conversation Create** — User creates new conversation
7. **M-006: Message Send** — User types and sends message
8. **M-007: Response Receive** — Response captured from provider via CDP
9. **M-008: Stream Display** — Response rendered in conversation UI

### Phase D: Capability Execution (M-009 → M-014)
**User Goal:** "I want to use advanced features"
10. **M-009: Capability Trigger** — User clicks capability button
11. **M-013: Capability Detail** — Full capability UI contract shown
12. **M-014: Capability Result** — Capability executes, result displayed

### Phase E: Multi-Provider (M-010 → M-012) [INFERRED]
**User Goal:** "I want to use multiple AI providers"
13. **M-010: Provider Switch** — User switches between providers
14. **M-011: Multi-Conversation** — User manages multiple conversations
15. **M-012: Fleet Status** — User sees Chrome fleet health

---

## Current State: What Exists in Sandbox

| Component | File | Status | Gap |
|-----------|------|--------|-----|
| SandboxApp | `web/sandbox/src/app/sandbox-app.tsx` | ✅ Exists | No conversation view |
| CapabilityCatalog | `web/sandbox/src/features/capability-catalog.tsx` | ✅ Exists | No provider filter |
| CapabilityHarness | `web/sandbox/src/features/capability-harness.tsx` | ✅ Exists | Execute button hardcoded to conv/1 |
| ProviderSetupWizard | `web/ui/src/features/provider-setup-wizard.tsx` | ✅ Exists | Not wired to real backend |
| CapabilityStore | `web/sandbox/src/store/capability-store.ts` | ✅ Exists | No conversation state |
| ActionRegistry | `web/ui/src/actions/registry.ts` | ✅ Exists | No UI actions registered |
| AgentBridge | `web/ui/src/actions/agent-bridge.ts` | ✅ Exists | Not tested E2E |
| API Client | `web/api-client/src/index.ts` | ✅ Exists | Not used by sandbox |

---

## Structural Gap: The Missing User Journey Moments

The `docs/user-stories-moments/` directory is empty. We need to create:

1. **Moment definitions** — What the user sees/does at each step
2. **Component specs** — What React components render each moment
3. **Store contracts** — What state each moment requires
4. **API contracts** — What endpoints each moment calls
5. **Test scenarios** — How to validate each moment works

---

## Proposed Atomic List Structure (Parallel to DevOps)

### User Journey Atomic Units (Phase 100)

| Unit | Name | Depends | Description |
|------|------|---------|-------------|
| **100.1** | Conversation List View | 90.8 | Sidebar showing all conversations |
| **100.2** | Conversation Create Flow | 100.1 | Button + modal to create new conversation |
| **100.3** | Message Thread View | 100.1 | Main area showing message history |
| **100.4** | Message Send Composer | 100.3 | Input + send button at bottom |
| **100.5** | Response Stream Display | 100.3 | Real-time response rendering |
| **100.6** | Provider Selector | 100.1 | Dropdown to switch providers |
| **100.7** | Capability Toolbar | 100.3 | Capability buttons in conversation context |
| **100.8** | Capability Result Panel | 100.7 | Inline result display after execution |
| **100.9** | Fleet Status Bar | 100.1 | Chrome fleet health indicator |
| **100.10** | Settings Panel | 100.1 | Provider config, account management |
| **100.11** | Debug Console | 90.8 | WS events, latency, traces |
| **100.12** | First Conversation E2E | 100.1-100.8 | Full loop: create → send → receive → display |

---

## Sandbox → App Graduation Path

```
web/sandbox/                    web/app/
┌─────────────────┐            ┌─────────────────┐
│ CapabilityCatalog│ ────────► │ ConversationList │
│ (sidebar)       │  graduate  │ (sidebar)       │
├─────────────────┤            ├─────────────────┤
│ CapabilityHarness│ ────────► │ MessageThread   │
│ (main area)     │  graduate  │ (main area)     │
├─────────────────┤            ├─────────────────┤
│ (no composer)   │ ────────► │ MessageComposer │
│                 │  new       │ (bottom)        │
├─────────────────┤            ├─────────────────┤
│ (no fleet)      │ ────────► │ FleetStatus     │
│                 │  new       │ (header)        │
└─────────────────┘            └─────────────────┘
```

---

## Critical Blockers for User Journey Completion

| Blocker | Impact | Resolution |
|---------|--------|------------|
| **11.11 Executor Barrel** | M-004, M-007-M-009 blocked | Create `src/executor/index.ts` |
| **13.6 Capability API** | M-013, M-014 blocked | Create `src/server/routes/capabilities.ts` |
| **Type Mismatches** | All moments affected | Fix event types in capability-event-bus |
| **No Conversation UI** | M-005-M-008 can't render | Build conversation components |
| **No Message Composer** | M-006 can't send | Build input + send button |

---

## Recommended Implementation Order

### Sprint 1: Unblock Backend (1-2 days)
1. Fix type errors (capability-event-bus, conversation-manager)
2. Create `src/executor/index.ts` barrel (Unit 11.11)
3. Create `src/server/routes/capabilities.ts` (Unit 13.6)
4. Verify `bun run typecheck` passes

### Sprint 2: Build Conversation UI (2-3 days)
5. Create `docs/user-stories-moments/` moment definitions
6. Build ConversationList component (100.1)
7. Build MessageThread component (100.3)
8. Build MessageComposer component (100.4)
9. Wire to real backend endpoints

### Sprint 3: Capability Integration (2-3 days)
10. Build CapabilityToolbar in conversation context (100.7)
11. Build CapabilityResultPanel (100.8)
12. Wire execution to real backend
13. Add debug console (100.11)

### Sprint 4: First Feature Loop (1-2 days)
14. E2E test: create conversation → send message → receive response
15. E2E test: click capability → execute → show result
16. Graduate first component from sandbox to app

---

## Success Criteria

1. `docs/user-stories-moments/` contains all moment definitions
2. User can create conversation, send message, see response in sandbox
3. User can click capability, see execution, view result
4. First component graduates from sandbox to `web/app/`
5. `bun run devops gate` passes

---

*This report bridges the gap between the missing storyboard and the existing moment-to-unit mapping.*
