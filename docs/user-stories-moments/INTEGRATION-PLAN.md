# User Journey Integration Plan

**Date:** 2026-07-11
**Status:** READY FOR IMPLEMENTATION

---

## Core Concept: Frontend Sandbox Driven Development

```
┌─────────────────────────────────────────────────────────────┐
│                    SANDBOX (Prototype)                       │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ M-001 Launch│───►│ M-005 Create│───►│ M-006 Send  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                   │                   │            │
│         ▼                   ▼                   ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ M-002 Catalog│   │ M-003 Login │    │ M-007 Recv  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                          │                   │              │
│                          ▼                   ▼              │
│                    ┌─────────────┐    ┌─────────────┐       │
│                    │ M-004 Confirm│   │ M-008 Display│      │
│                    └─────────────┘    └─────────────┘       │
│                                           │                 │
│                                           ▼                 │
│                                     ┌─────────────┐         │
│                                     │ M-014 Execute│        │
│                                     └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Graduate proven components
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      APP (Production)                        │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Conversation│    │ Message     │    │ Capability  │      │
│  │ List        │    │ Thread      │    │ Toolbar     │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Atomic Tracker Integration

### Existing DevOps Tracker
- **File:** `docs/atomic/01-tracker.md`
- **Phases:** 1-20 (backend engines, schemas, lifecycles)
- **Status:** 95+ units, many complete

### New User Journey Tracker
- **File:** `docs/user-stories-moments/00-atomic-list.md`
- **Phase:** 100 (user-centric frontend)
- **Status:** 15 units defined

### Unified Tracker (Target)
```
Phase 1-20:   Backend engines (existing)
Phase 90:     Frontend sandbox (existing)
Phase 100:    User journey moments (NEW)
Phase 101+:   Sandbox → App graduation (future)
```

---

## Dependency Mapping

### Backend → Frontend Dependencies

| Frontend Unit | Backend Dependency | Status |
|---------------|-------------------|--------|
| 100.1 Conversation List | 13.6 Conversation API | ⚠ BLOCKED |
| 100.2 Conversation Create | 13.6 Conversation API | ⚠ BLOCKED |
| 100.3 Message Thread | 13.6 Message API | ⚠ BLOCKED |
| 100.4 Message Send | 13.6 Send API | ⚠ BLOCKED |
| 100.5 Response Stream | 5.3 WebSocket Bridge | ✅ DONE |
| 100.6 Provider Selector | 13.1 Provider API | ✅ DONE |
| 100.7 Capability Toolbar | 90.6 Capability API | ⚠ PARTIAL |
| 100.8 Capability Result | 90.6 Capability API | ⚠ PARTIAL |
| 100.9 Capability Execute | 13.6, 18.2 Execution API | ⚠ BLOCKED |
| 100.10 Fleet Status | 13.2 Fleet API | ✅ DONE |
| 100.11 Settings Panel | 13.3 Config API | ✅ DONE |
| 100.12 Debug Console | 5.3 WebSocket | ✅ DONE |

### Critical Path

```
11.11 Executor Barrel ──► 13.6 Capability API ──► 100.1-100.4 (Conversation UI)
                                       │
                                       └──► 100.7-100.9 (Capability UI)
```

---

## Implementation Roadmap

### Sprint 1: Unblock Backend (Days 1-2)
**Goal:** Enable all frontend API calls

1. Fix type errors in `capability-event-bus.ts`
2. Fix type errors in `conversation-manager.ts`
3. Create `src/executor/index.ts` barrel (Unit 11.11)
4. Create `src/server/routes/capabilities.ts` (Unit 13.6)
5. Verify `bun run typecheck` passes

### Sprint 2: Conversation Foundation (Days 3-5)
**Goal:** User can create and manage conversations

1. Create `docs/user-stories-moments/` moment definitions ✅
2. Create store definitions ✅
3. Build `ConversationList` component (100.1)
4. Build `CreateConversationModal` (100.2)
5. Build `MessageThread` component (100.3)
6. Build `MessageComposer` component (100.4)
7. Wire to real backend endpoints

### Sprint 3: Response & Provider (Days 6-7)
**Goal:** User can send messages and see responses

1. Build `MessageBubble` component (100.5)
2. Add WebSocket event handlers
3. Build `ProviderSelector` (100.6)
4. Test full conversation loop

### Sprint 4: Capability Integration (Days 8-10)
**Goal:** User can execute capabilities

1. Build `CapabilityToolbar` (100.7)
2. Build `CapabilityResultPanel` (100.8)
3. Build `CapabilityExecuteButton` (100.9)
4. Wire to execution API
5. Test capability execution loop

### Sprint 5: System UI & Integration (Days 11-12)
**Goal:** Complete sandbox experience

1. Build `FleetStatusBar` (100.10)
2. Build `SettingsPanel` (100.11)
3. Build `DebugConsole` (100.12)
4. E2E tests for full journey

### Sprint 6: Graduation (Days 13-14)
**Goal:** First component moves to production

1. Validate all moments work
2. Graduate `ConversationList` to `web/app/`
3. Update `docs/sandbox/PROMOTED.md`
4. Update devops tracker

---

## Moment Priority Matrix

| Moment | Priority | Blocker? | Effort | Value |
|--------|----------|----------|--------|-------|
| M-001 App Launch | P0 | No | Low | High |
| M-002 Catalog Load | P0 | No | Low | High |
| M-005 Conversation Create | P0 | Yes (13.6) | Medium | Critical |
| M-006 Message Send | P0 | Yes (13.6) | Medium | Critical |
| M-007 Response Receive | P0 | Yes (14.2) | Medium | Critical |
| M-008 Stream Display | P0 | No | Low | High |
| M-014 Capability Execute | P1 | Yes (13.6) | High | High |
| M-003 Provider Login | P1 | Yes (14.2) | Medium | Medium |
| M-004 Session Confirm | P1 | Yes (11.11) | Low | Medium |
| M-009 Capability Trigger | P1 | Yes (13.6) | Low | Medium |
| M-010 Provider Switch | P2 | No | Low | Low |
| M-011 Multi-Conversation | P2 | No | Low | Medium |
| M-012 Fleet Status | P2 | No | Low | Low |
| M-013 Capability Detail | P2 | No | Low | Low |

---

## Success Metrics

### Functional Metrics
- [ ] User can create conversation in < 2 clicks
- [ ] User can send message in < 1 keystroke
- [ ] Response appears in < 5 seconds
- [ ] Capability executes in < 15 seconds
- [ ] Zero console errors in sandbox

### Quality Metrics
- [ ] `bun run typecheck` passes (0 errors)
- [ ] `bun run lint` passes (0 errors)
- [ ] `bun test` passes (100% of new tests)
- [ ] `bun run devops gate` passes

### Adoption Metrics
- [ ] First component graduated to `web/app/`
- [ ] `docs/sandbox/PROMOTED.md` has 1+ entry
- [ ] Agent can perform all human actions (B8 invariant)

---

## File Structure Target

```
docs/user-stories-moments/
├── RESEARCH-REPORT.md           (created)
├── 00-atomic-list.md            (created)
├── STORE-DEFINITIONS.md         (created)
├── INTEGRATION-PLAN.md          (this file)
├── M-001-app-launch.md          (created)
├── M-005-conversation-create.md (created)
├── M-006-message-send.md        (created)
├── M-014-capability-execution.md (created)
├── M-002-catalog-load.md        (pending)
├── M-003-provider-login.md      (pending)
├── M-004-session-confirm.md     (pending)
├── M-007-response-receive.md    (pending)
├── M-008-stream-display.md      (pending)
├── M-009-capability-trigger.md  (pending)
├── M-010-provider-switch.md     (pending)
├── M-011-multi-conversation.md  (pending)
├── M-012-fleet-status.md        (pending)
└── M-013-capability-detail.md   (pending)
```

---

## Next Steps

1. **Immediate:** Fix backend blockers (11.11, 13.6, type errors)
2. **Today:** Create remaining moment definition files
3. **This week:** Build Sprint 2 components (Conversation UI)
4. **Next week:** Complete Sprint 3-5, first graduation

---

*This plan bridges the backend devops system with the user-centric frontend development.*
