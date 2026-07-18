# Feature Specification: Chat Advanced Capabilities & Memory/Knowledge

**Feature Branch**: `003-chat-advanced`
**Created**: 2025-07-17
**Status**: Ready
**Input**: Register 5 missing chat capabilities as proper `UnifiedCapability` entries + wire 7 UI features + surface 6 memory/knowledge panels
**Source**: `docs/workstreams/AGENT-3-CHAT-ADVANCED.md`
**Source Audit**: `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

## User Scenarios & Testing

### User Story 1 — Register Missing Chat Capabilities (Priority: P1)

8 capabilities were claimed "exists" but were only string names in provider JSON manifests. They need proper `UnifiedCapability` registration in `capability-bootstrap.ts` using the `makeCapability()` pattern with full cross-surface parity.

**Why this priority**: Without registered capabilities, the chat UI has no actions to wire. These are the foundation for all UI work.

**Independent Test**: `bun test tests/unit/engines/capability-bootstrap.test.ts` verifies new capabilities registered. `bun run devops runtime-test test-cap --slug=provider_select_model` verifies execution.

**Acceptance Scenarios**:
1. **Given** `provider:select_model` capability, **When** executed with `{ modelName: 'gpt-4' }`, **Then** the model selector CDP flow runs
2. **Given** `provider:upload_file` capability, **When** executed with `{ filePath: './report.pdf' }`, **Then** file is uploaded via CDP
3. **Given** `provider:edit_message` capability, **When** executed with `{ newText: 'corrected' }`, **Then** message is edited and re-sent
4. **Given** `provider:regenerate` capability, **When** executed, **Then** CDP clicks regenerate button
5. **Given** `provider:new_chat` capability, **When** executed, **Then** CDP navigates to new chat + creates DB conversation

### User Story 2 — Wire Chat UI Features (Priority: P1)

7 UI features need wiring into the chat interface: model selector dropdown, file upload drag-drop, edit message button, regenerate button, FTS5 search bar, export conversations, import conversations.

**Why this priority**: Basic chat UX is incomplete without model switching, file upload, message editing, and conversation management.

**Independent Test**: Each UI feature can be tested in isolation via `bun run devops runtime-test test --nl "<description>"`.

**Acceptance Scenarios**:
1. **Given** model selector dropdown, **When** user selects a different model, **Then** `provider_select_model` capability executes
2. **Given** drag-drop zone, **When** user drops a file, **Then** file saved to `uploads/` and `provider_upload_file` executes
3. **Given** user message hover, **When** edit icon clicked, **Then** message text populates composer for re-editing
4. **Given** FTS5 search bar, **When** user types (debounced 300ms), **Then** conversations matching query appear

### User Story 3 — Surface Memory/Knowledge Panels (Priority: P2)

6 memory/knowledge features already have backend engines but no UI: memory context panel, semantic search results, cross-conversation synthesis, knowledge ingestion progress, entity extraction cards, decision tracking timeline.

**Why this priority**: Memory/knowledge engines exist but users can't see their output. These panels make the knowledge graph visible.

**Independent Test**: Each panel can be independently toggled and verified via the canvas/chat surface.

**Acceptance Scenarios**:
1. **Given** memory context panel, **When** opened during conversation, **Then** relevant facts, episodes, and procedural rules are shown
2. **Given** semantic search tab, **When** user searches, **Then** results appear in "Text Match" and "Semantic" tabs
3. **Given** cross-conversation synthesis, **When** "Synthesize" clicked, **Then** themes, entities, and decision patterns are displayed
4. **Given** decision timeline, **When** rendered, **Then** decisions show: text, date, confidence, related conversations

## Requirements

### Functional Requirements

- **FR-001**: System MUST register 5 new `UnifiedCapability` entries: `select_model`, `upload_file`, `edit_message`, `regenerate`, `new_chat`
- **FR-002**: Each new capability MUST have full cross-surface parity (CLI, API, MCP, UI)
- **FR-003**: Model selector MUST fetch available models from `GET /api/providers/{id}/models`
- **FR-004**: File upload MUST support drag-drop with file saved to `uploads/` directory
- **FR-005**: Edit message MUST repopulate composer with original text for re-editing
- **FR-006**: FTS5 search MUST debounce at 300ms and search via `POST /api/conversations/search`
- **FR-007**: Export MUST call `ExportEngine.export()` with format=json
- **FR-008**: Memory context panel MUST fetch from `memory:query` capability
- **FR-009**: Semantic search MUST show results in "Text Match" and "Semantic" tabs
- **FR-010**: Knowledge ingestion MUST poll `GET /api/knowledge/ingest/{jobId}` for progress

### Key Entities

- **UnifiedCapability**: id, slug, name, description, category, inputSchema, outputSchema, cliCommand, ui, mcpToolName, apiEndpoint, surfaces
- **ChatMessage**: role (user/assistant), content, timestamp, edit history
- **SearchResult**: type (fts5/semantic), score, conversationId, messageId, snippet
- **SynthesisResult**: themes[], entities[], decisionPatterns[], confidence
- **DecisionEntry**: text, date, confidence, relatedConversations[], status

## Success Criteria

### Measurable Outcomes

- **SC-001**: 5 new capabilities resolve in `devops verify-cross-surface`
- **SC-002**: All 7 UI features are independently testable via `runtime-test --nl`
- **SC-003**: Search results appear within 500ms for FTS5, 2s for semantic
- **SC-004**: Export produces valid JSON that roundtrips via import
- **SC-005**: `conversation-surface.tsx` refactored from 554-line god component to <200 lines with extracted sub-components

## Assumptions

- CDP transport (`ChromeGovernor.cdp`) is available for model selector and file upload CDP flows
- `ExportEngine` and `KnowledgeIngestionEngine` already exist
- `CrossConversationSynthesizer` backend already exists
- `GET /api/providers/{id}/models` endpoint exists or can be added
- `POST /api/conversations/search` route needs wiring (backend `searchMessages()` exists)

## File Conflict Notes

- **`capability-bootstrap.ts`**: Agent 3 adds 5 new entries at bottom of `defaults` array FIRST. Agent 1 wraps handlers with consent gates SECOND.
- **`conversation-surface.tsx`**: Refactor into sub-components before adding features: `MessageList.tsx`, `Composer.tsx`, `ModelSelector.tsx`, `FileUploader.tsx`, etc.
