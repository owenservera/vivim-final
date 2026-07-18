# Feature Specification: Knowledge & Memory UI Panels

**Feature Branch**: `008-knowledge-memory-ui`  
**Created**: 2025-07-17 | **Status**: Ready  
**Input**: Interactive frontend panels for MemoryEngine, SemanticSearchEngine, and CrossConversationSynthesizer

## User Scenarios

### User Story 1 — Memory Context Panel (P1)

During a conversation, user opens a side panel showing relevant memories: facts about the topic, recent related episodes, and applicable procedural rules.

**Acceptance Scenarios**:
1. **Given** a conversation is active, **When** user opens Memory Context panel, **Then** facts, episodes, and rules relevant to the current topic are displayed
2. **Given** the user sends a new message, **When** memory context updates, **Then** panel refreshes with newly relevant items

### User Story 2 — Semantic Search (P1)

User searches across all conversations using text match (FTS5) and semantic search (embeddings), with tabbed results.

**Acceptance Scenarios**:
1. **Given** user types a search query, **When** "Text Match" tab is active, **Then** FTS5 results appear with snippets, conversation name, and timestamp within 500ms
2. **Given** search results are shown, **When** user clicks a result, **Then** navigates to that conversation at the matching message

### User Story 3 — Knowledge Synthesis (P2)

User clicks "Synthesize" to see cross-conversation insights: recurring themes, extracted entities, and decision patterns.

**Acceptance Scenarios**:
1. **Given** 5+ conversations exist, **When** user clicks "Synthesize", **Then** themes, entities, and decision timeline are displayed
2. **Given** synthesis is running, **When** results appear, **Then** decision entries show: decision text, date, confidence, related conversations

## Requirements

- **FR-001**: Memory panel MUST fetch from memory:query capability
- **FR-002**: Semantic search MUST show results in "Text Match" and "Semantic" tabs
- **FR-003**: FTS5 search MUST debounce at 300ms and return results under 500ms
- **FR-004**: Synthesis panel MUST call CrossConversationSynthesizer via capability
- **FR-005**: All panels MUST be collapsible and resizable
- **FR-006**: Panel state (open/closed, width) MUST persist across page reloads

## Success Criteria

- SC-001: FTS5 search returns results under 500ms
- SC-002: Memory context updates within 2 seconds of new message
- SC-003: Synthesis completes for 50+ conversations in under 5 seconds
