# Feature Specification: Wire 10 Critical User Moments in v9 Canvas

**Feature Branch**: `030-v9-user-moments`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Wire the 10 critical user moments identified in USER-MOMENTS.md into the v9 frontend canvas. Each moment maps to specific API endpoints, capabilities, and WebSocket events that must be connected for a fully functional user experience."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First Contact: Backend Liveness Check (Priority: P1)

User opens the app. Within 2 seconds they need to know: backend is reachable, I'm authenticated, I can start.

**Why this priority**: Foundation for all other moments. Without backend connectivity, nothing works.

**Independent Test**: Can be fully tested by opening the app and verifying the login panel appears with backend status indicator.

**Acceptance Scenarios**:

1. **Given** app is opened, **When** backend is reachable, **Then** green status indicator shows "Connected"
2. **Given** app is opened, **When** backend is unreachable, **Then** red status shows "Disconnected" with retry button
3. **Given** user is authenticated, **When** session is valid, **Then** user sees their email/name in header
4. **Given** user is not authenticated, **When** app loads, **Then** login form is displayed

---

### User Story 2 - Send a Message: Streaming AI Response (Priority: P1)

User types a message in the composer, hits send. A streaming response appears in real-time.

**Why this priority**: Core value proposition - talking to AI is the primary use case.

**Independent Test**: Can be tested by sending a message and verifying character-by-character streaming response appears.

**Acceptance Scenarios**:

1. **Given** user types a message, **When** they press Enter or click Send, **Then** message appears in chat history
2. **Given** message is sent, **When** AI is processing, **Then** "Streaming..." indicator with animated dots appears
3. **Given** AI is streaming, **When** chunks arrive, **Then** text appears character-by-character in real-time
4. **Given** streaming completes, **When** response is finished, **Then** streaming indicator disappears
5. **Given** user sends message via NL command, **When** NLCL resolves capability, **Then** capability executes and result streams back

---

### User Story 3 - Conversation List: Session History (Priority: P1)

User sees a list of past conversations. They click one, the message history loads.

**Why this priority**: Users need to access their conversation history to continue previous sessions.

**Independent Test**: Can be tested by loading the app and verifying conversation list appears in sidebar.

**Acceptance Scenarios**:

1. **Given** user has conversations, **When** app loads, **Then** sidebar shows list of conversations with titles
2. **Given** conversation list is displayed, **When** user clicks a conversation, **Then** message history loads in main canvas
3. **Given** user wants new conversation, **When** they click "New Conversation", **Then** empty conversation is created and selected
4. **Given** user wants to delete conversation, **When** they click delete button, **Then** conversation is removed from list

---

### User Story 4 - Switch Provider: Multi-AI Support (Priority: P2)

User switches from one AI provider to another. The conversation context changes, capabilities update.

**Why this priority**: Multi-provider is the key differentiator - users can choose between ChatGPT, Claude, Gemini.

**Independent Test**: Can be tested by switching providers and verifying capability list refreshes.

**Acceptance Scenarios**:

1. **Given** user is on ChatGPT, **When** they select Claude from provider dropdown, **Then** provider switches and capabilities refresh
2. **Given** provider is switched, **When** new provider has different capabilities, **Then** command palette shows updated capability list
3. **Given** user creates new conversation, **When** they select provider, **Then** conversation is associated with that provider

---

### User Story 5 - Command Palette: Keyboard-Driven Actions (Priority: P2)

User presses Cmd+K. A fuzzy search dialog appears. They type a command, select it, it executes.

**Why this priority**: Power user productivity - keyboard-driven workflow.

**Independent Test**: Can be tested by pressing Cmd+K and verifying command palette appears with searchable capabilities.

**Acceptance Scenarios**:

1. **Given** user presses Cmd+K, **When** command palette opens, **Then** fuzzy search input appears with capability list
2. **Given** command palette is open, **When** user types "send", **Then** filtered list shows matching capabilities
3. **Given** user selects a capability, **When** they press Enter, **Then** capability executes with result displayed
4. **Given** capability requires input, **When** user selects it, **Then** input form appears before execution

---

### User Story 6 - Real-time Events: Live Updates (Priority: P2)

User sees live updates: new messages arriving, provider status changes, presence indicators.

**Why this priority**: Live feel, not a static page - essential for real-time collaboration.

**Independent Test**: Can be tested by verifying WebSocket connection and real-time event handling.

**Acceptance Scenarios**:

1. **Given** WebSocket is connected, **When** new message arrives on subscribed topic, **Then** UI updates in real-time
2. **Given** WebSocket disconnects, **When** connection is lost, **Then** "Reconnecting..." indicator appears
3. **Given** WebSocket reconnects, **When** connection is restored, **Then** indicator returns to "Connected"
4. **Given** config changes, **When** backend emits config:changed event, **Then** UI reflects updated configuration

---

### User Story 7 - Knowledge Search: Cross-Conversation Intelligence (Priority: P3)

User searches across all past conversations. Results appear with source attribution.

**Why this priority**: Cross-conversation intelligence - finding relevant information from history.

**Independent Test**: Can be tested by searching for a term and verifying results appear with conversation sources.

**Acceptance Scenarios**:

1. **Given** user types search query, **When** they execute search, **Then** results appear with conversation titles and timestamps
2. **Given** search results are displayed, **When** user clicks a result, **Then** original conversation loads with context highlighted
3. **Given** user wants to synthesize, **When** they click "Synthesize", **Then** AI generates answer across multiple conversations

---

### User Story 8 - Memory Management: Persistent Context (Priority: P3)

User asserts a fact into memory. Later they query it. They can also forget facts.

**Why this priority**: Persistent context across sessions - users can store and retrieve information.

**Independent Test**: Can be tested by asserting a fact, querying it, and verifying it's returned.

**Acceptance Scenarios**:

1. **Given** user asserts a fact, **When** they type "Remember: my birthday is March 15", **Then** fact is stored in memory
2. **Given** fact is stored, **When** user queries "What is my birthday?", **Then** memory returns the stored fact
3. **Given** user wants to forget, **When** they say "Forget my birthday", **Then** fact is removed from memory

---

### User Story 9 - Provider Health: System Visibility (Priority: P3)

User sees a health dashboard showing which AI providers are connected, their latency, error rates.

**Why this priority**: Visibility into system state - knowing which providers are available.

**Independent Test**: Can be tested by viewing health dashboard and verifying provider statuses are displayed.

**Acceptance Scenarios**:

1. **Given** user opens health dashboard, **When** providers are online, **Then** green status badges appear for each provider
2. **Given** provider is offline, **When** user views dashboard, **Then** red status badge shows "Offline"
3. **Given** provider has latency, **When** user views dashboard, **Then** response time is displayed in milliseconds

---

### User Story 10 - Session Lifecycle: Provider Session Management (Priority: P3)

User loads a provider session (attaches to a Chrome slave), starts a conversation, the canvas becomes active.

**Why this priority**: Needed for full provider integration - session management for Chrome automation.

**Independent Test**: Can be tested by loading a session and verifying canvas becomes active.

**Acceptance Scenarios**:

1. **Given** user clicks "Load Session", **When** they select a provider, **Then** session loads with "Loading..." indicator
2. **Given** session is loading, **When** Chrome profile restores, **Then** progress indicator shows status
3. **Given** session is loaded, **When** canvas becomes active, **Then** composer is enabled for message input
4. **Given** user wants to end session, **When** they click "End Session", **Then** session is terminated and canvas deactivates

---

### Edge Cases

- What happens when backend is unreachable? → Show "Disconnected" state with retry
- What happens when WebSocket disconnects? → Auto-reconnect with exponential backoff
- What happens when capability execution fails? → Show error message with retry option
- What happens when provider is offline? → Show "Provider unavailable" in provider selector
- What happens when search returns no results? → Show "No results found" with suggestions

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST check backend liveness via `GET /api/health` on app load
- **FR-002**: System MUST authenticate user via `GET /api/auth/session` and `POST /api/auth/login`
- **FR-003**: System MUST send messages via `POST /api/conversations/:id/send` with streaming response
- **FR-004**: System MUST interpret NL commands via `POST /api/interpret` for capability resolution
- **FR-005**: System MUST list capabilities via `GET /api/capabilities?surface=cli` for command palette
- **FR-006**: System MUST execute capabilities via `POST /api/capabilities/:id/execute`
- **FR-007**: System MUST list conversations via `GET /api/conversations` for sidebar
- **FR-008**: System MUST load message history via `GET /api/conversations/:id/messages`
- **FR-009**: System MUST create conversations via `POST /api/conversations`
- **FR-010**: System MUST delete conversations via `DELETE /api/conversations/:id`
- **FR-011**: System MUST list providers via `GET /api/providers` for provider selector
- **FR-012**: System MUST load provider capabilities via `GET /api/providers/:id/capabilities`
- **FR-013**: System MUST connect WebSocket to `ws://localhost:9420/ws` for real-time events
- **FR-014**: System MUST subscribe to topics via WebSocket `subscribe` message
- **FR-015**: System MUST search knowledge via `GET /api/knowledge/search?q=<query>`
- **FR-016**: System MUST assert memory via `POST /api/memory/assert`
- **FR-017**: System MUST query memory via `GET /api/memory/query?q=<query>`
- **FR-018**: System MUST check provider health via `GET /api/telemetry/health`
- **FR-019**: System MUST load sessions via `POST /api/session/load`
- **FR-020**: System MUST list sessions via `GET /api/session/list`

### Key Entities

- **Capability**: Represents an executable action with id, slug, name, description, inputSchema, outputSchema
- **Conversation**: A chat session with id, title, providerId, createdAt, updatedAt
- **Message**: A chat message with id, conversationId, role, content, createdAt
- **Provider**: An AI provider with id, name, slug, status, capabilities
- **Session**: A provider session with id, providerId, slaveId, conversationId
- **Memory**: A stored fact with id, content, confidence, createdAt
- **Knowledge**: A searchable document with id, content, source, timestamp

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can send a message and see streaming response within 2 seconds of pressing Enter
- **SC-002**: Command palette opens within 100ms of pressing Cmd+K
- **SC-003**: Conversation list loads within 500ms of app startup
- **SC-004**: WebSocket reconnects within 5 seconds of disconnection
- **SC-005**: Provider switch completes within 1 second with capability refresh
- **SC-006**: Search results appear within 1 second of query execution
- **SC-007**: Memory query returns results within 500ms
- **SC-008**: Health dashboard updates every 30 seconds with current provider status
- **SC-009**: Session load completes within 10 seconds with progress indicator
- **SC-010**: All 10 user moments are wireable without backend code changes

## Assumptions

- Backend API at `localhost:9420` is running and accessible
- WebSocket server at `ws://localhost:9420/ws` is available
- User has valid authentication credentials
- All API endpoints return valid JSON responses
- WebSocket protocol follows the spec: subscribe, agent_command, ping/pong
- Frontend runs at `localhost:3000` with Next.js dev server
- All capability slugs match the backend capability-bootstrap.ts definitions
- Provider capabilities are resolved dynamically based on provider selection
