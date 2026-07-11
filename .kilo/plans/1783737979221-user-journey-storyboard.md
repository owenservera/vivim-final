# User Journey Storyboard — VIVIM Platform

**Status:** ACTIVE  
**Purpose:** Map user moments to atomic units in devops roadmap. Enables "use the system as a customer" validation loop.

---

## User Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **P1: New User** | First-time setup, no providers configured | Quick start, clear guidance, minimal friction |
| **P2: Returning User** | Has profiles, wants to chat/continue work | Fast access, conversation persistence, reliability |
| **P3: Power User** | Multi-provider, automation workflows | Advanced capabilities, hitless switching, observability |

---

## User Journey Map

### Journey J-001: First-Time Provider Setup

A new user adds their first AI provider account.

```
MOMENT M-001: Workspace Selection
├─ UI: ProviderSetupWizard (step 1)
├─ API: GET /api/setup/workspace
├─ Engine: ConfigManager (get/set workspace config)
├─ State: Must exist before any provider operations
└─ → Units: 13.1, 13.2, 13.3, 13.4 — DONE

MOMENT M-002: Provider Selection & Account Nickname
├─ UI: ProviderSetupWizard (step 2)
├─ API: POST /api/setup/launch-visible
├─ Engine: ChromeGovernor.launch() + LifecycleManager
├─ State: Profile directory created, Chrome spawned
└─ → Units: 14.2 — PENDING (stub), 13.9 (wizard) — DONE

MOMENT M-003: Manual Login Flow
├─ UI: ProviderSetupWizard (step 3)
├─ API: POST /api/setup/verify
├─ Engine: ChromeGovernor.checkLoginStatus()
├─ State: User logs in manually, system verifies session
└─ → Units: 13.10 (E2E) — BLOCKED, 14.4 — PENDING

MOMENT M-004: Session Confirmation
├─ UI: ProviderSetupWizard (step 4)
├─ API: POST /api/setup/complete
├─ Engine: ChromeGovernor.registerSession() + ProviderStore
├─ State: Profile stored, ready for capability execution
└─ → Units: 11.3, 11.4, 3.1 — DONE (needs E2E)
```

**Validation Actions:**
- Unit 13.10 blocks on this moment working end-to-end
- Integration: Sandbox app must show profile after setup completes

---

### Journey J-002: Send First Message

User sends a message through a configured provider.

```
MOMENT M-005: Conversation Creation
├─ UI: Sandbox → "New Chat" button
├─ API: POST /api/conversations
├─ Engine: ConversationManager.createConversation()
├─ State: conversation row in DB, empty message list
└─ → Units: 3.6, 10.1 — DONE

MOMENT M-006: Capability Resolution
├─ UI: Implicit (Composer capability)
├─ Engine: CapabilityResolutionEngine.resolve()
├─ State: Resolved capability stack + UI contracts
└─ → Units: 4.3, 3.6 — DONE

MOMENT M-007: Message Send Execution
├─ UI: Composer text input → send button
├─ API: POST /api/conversations/:id/send
├─ Engine: ConversationManager.send() → ENSURE → SEND
├─ State: Message sent to provider, awaiting response
└─ → Units: 14.2, 14.5 — PENDING (CDP stubs)

MOMENT M-008: Response Capture & Parse
├─ UI: Loading state in Composer
├─ Engine: CDPProxy.captureResponse() + StreamParserEngine
├─ State: ContentBlock[] persisted to stream_block table
└─ → Units: 3.2, 3.3, 3.8, 4.1 — DONE

MOMENT M-009: Response Emission
├─ UI: Message appears in thread
├─ WebSocket: conversation:complete event
├─ State: Message + blocks visible in UI
└─ → Units: 5.3, 3.6 — DONE
```

**Validation Actions:**
- E2E test: Send message to any provider, see response in sandbox
- Phase 6 tests (6.2) must cover this

---

### Journey J-003: Multi-Provider Conversation

User switches between providers during a session.

```
MOMENT M-010: Provider List & Status
├─ UI: Sidebar provider list with status indicators
├─ API: GET /api/providers, GET /api/fleet/status
├─ Engine: ChromeGovernor.getAllSlaves()
├─ State: All configured providers with health/status
└─ → Units: 5.1, 3.5 — DONE

MOMENT M-011: Hitless Provider Switch
├─ UI: Click different provider in sidebar
├─ API: POST /api/conversations (new convo) or context switch
├─ Engine: Requires idle Chrome instance for target
├─ State: New conversation with different provider context
└─ → Units: 16.1, 16.4 — PENDING (mux/failover)

MOMENT M-012: Concurrent Sessions
├─ UI: Multiple browser profiles running
├─ Engine: ChromeGovernor maintains multiple slaves
├─ State: Isolated session per provider/account
└─ → Units: 11.4, 3.5 — DONE
```

---

### Journey J-004: Capability Discovery & Execution

User discovers and executes capabilities beyond basic chat.

```
MOMENT M-013: Capability Catalog Browse
├─ UI: CapabilityCatalog component (sandbox left panel)
├─ API: GET /api/capabilities
├─ Engine: CapabilityResolutionEngine.listAvailable()
├─ State: All available capabilities for current context
└─ → Units: 13.4, 13.6 — DONE (sandbox), 18.1 — PENDING (registry)

MOMENT M-014: Capability Execution
├─ UI: Click capability, configure inputs, execute
├─ API: POST /api/execute (planned)
├─ Engine: CapabilityEngine.execute() → HarnessRuntime
├─ State: CDP script runs, UI updates based on result_component
└─ → Units: 4.2, 9.1, 14.7 — PENDING

MOMENT M-015: Result Visualization
├─ UI: Dynamic result rendering based on capability type
├─ Engine: result_layout + result_component fields
├─ State: Results displayed inline/overlay/sidebar/modal
└─ → Units: 13.10, 18.10 — PENDING
```

---

### Journey J-005: Workflow Automation

Power user creates automated workflows.

```
MOMENT M-016: Workflow Builder Access
├─ UI: Workflow builder canvas (future)
├─ API: GET/POST /api/workflows (planned)
├─ Engine: WorkflowEngine, WorkflowCompiler
├─ State: Saved workflow definitions
└─ → Units: 9.1, 9.2, 18.3 — PENDING

MOMENT M-017: Workflow Execution
├─ UI: Run workflow button
├─ API: POST /api/workflows/:id/execute
├─ Engine: WorkflowEngine.execute(), HarnessRuntime runs DAG
├─ State: Workflow runs, events stream via WebSocket
└─ → Units: 9.1, 14.7 — PENDING

MOMENT M-018: HITL Gate Interaction
├─ UI: Approval modal for human-in-the-loop steps
├─ API: WebSocket hitl:approval_requested
├─ Engine: WorkflowEngine.pauseForApproval()
├─ State: Workflow paused until user action
└─ → Units: 9.8, 19.5 — PENDING
```

---

### Journey J-006: Memory & Knowledge Retrieval

User searches across conversation history.

```
MOMENT M-019: Memory Search
├─ UI: Search bar with semantic results
├─ API: POST /api/memory/search (planned)
├─ Engine: SemanticSearchEngine + MemoryEngine
├─ State: Cross-conversation search results
└─ → Units: 15.5, 15.6 — PENDING

MOMENT M-020: Topic Organization
├─ UI: Auto-tagged conversations, topic view
├─ API: GET /api/conversations?projectId= (planned)
├─ Engine: ConversationOrganization, MemoryEngine
├─ State: Conversations grouped by extracted topics
└─ → Units: 15.11, 18.7 — PENDING
```

---

## Moment-to-Unit Mapping

### Completed & Validated Moments

| Moment | Units | Status | Validation Method |
|--------|-------|--------|-------------------|
| M-001 | 13.1, 13.2, 13.3, 13.4 | DONE | Sandbox loads wizard |
| M-002 | 13.9 | DONE | Wizard shows providers |
| M-005 | 3.6 | DONE | Conversations API works |
| M-006 | 4.3 | DONE | Resolution logic in place |

### Blocked/Stub Moments (Prevent Validation)

| Moment | Blocking Unit | Status | Impact |
|--------|---------------|--------|--------|
| M-003 | 14.2, 14.4 | PENDING | Setup incomplete without real CDP |
| M-004 | 11.11, 14.2 | BLOCKED | Executor barrel wiring needed |
| M-007 | 14.2, 14.5, 14.7 | PENDING | CDP stubs prevent message send |
| M-008 | 14.2, 14.7 | PENDING | HarnessRuntime real context |
| M-009 | 13.10 | BLOCKED | E2E test blocked by CDP |

### Missing Moments (Feature Gaps)

| Moment | Required Units | Status |
|--------|---------------|--------|
| M-014 | 18.2, 13.6, 4.2, 14.7 | PENDING — CLI commands not wired to API |
| M-016 | 9.1, 9.2, 18.3 | PENDING — workflow endpoints missing |
| M-019 | 15.5, 15.6 | PENDING — semantic search not implemented |

---

## Integration with DevOps System

### How to Use This Storyboard

1. **Before implementing each unit**, ask: "Which user moment does this enable?"
2. **After unit completion**, run the corresponding validation action
3. **Blocked moments** become unblocked when their blocking units complete
4. **E2E tests** map directly to moments (see Phase 6.2)

### Moment Validation Commands (to add)

```bash
# Validate Moment M-003 (Login Flow)
bun test tests/e2e/provider-setup.test.ts

# Validate Moment M-007 (Send Message)  
bun test tests/e2e/send-message.test.ts

# Validate Moment M-014 (Capability Execute)
bun test tests/e2e/capability-execution.test.ts

# Run all moment validations
bun run validate-moments
```

### Moment Status Tracking

Add to `docs/atomic/01-tracker.md`:

```markdown
## User Journey Validation Status

| Journey | Moments | Status | Next Blocked Unit |
|---------|---------|--------|-------------------|
| J-001: Setup | M-001..004 | BLOCKED | 14.2, 13.10 |
| J-002: Chat | M-005..009 | BLOCKED | 14.2, 13.10 |
| J-003: Multi-Provider | M-010..012 | PENDING | 16.1 |
| J-004: Capabilities | M-013..015 | BLOCKED | 18.1 |
| J-005: Workflows | M-016..018 | PENDING | 9.1 |
| J-006: Memory | M-019..020 | PENDING | 15.5 |
```

---

## Immediate Next Steps

1. **Unblock M-003/004/007/008/009** by completing CDP wiring (Units 14.2-14.4, 14.7)
2. **Complete 13.10** (First Feature E2E) to validate the core moment
3. **Add moment validation tests** for each journey stage
4. **Create capability execution API** (Units 13.6, 18.2) to enable M-014
5. **Add workflow endpoints** (Units 9.1, 9.2, 18.3) to enable M-016

---

## Design Principles for Moment Validation

### "Use as Customer" Loop
- Each implemented unit must enable at least one user moment
- Moments require complete end-to-end flow (UI → API → Engine → Store)
- Stubbed engines invalidate the moment (counts as PENDING-BLOCKED)

### Progress Flow
- Moments → Journeys → Goals → Completion
- A blocked journey = blocked goal contribution
- Report format: `✓ Moment M-XXX | Journey J-YY unblocked | Next: M-XXX`

---

*Reference:* See `docs/goals/GOALS.md` for goal definitions, `docs/atomic/01-tracker.md` for unit status.