# Feature Specification: Streaming UX Polish

**Feature Branch**: `011-streaming-ux-polish`  
**Created**: 2025-07-17 | **Status**: Ready  
**Input**: Polished streaming response UX with thinking indicator, progressive rendering, tool-use cards, error recovery, and cancel support

## User Scenarios

### User Story 1 — Thinking Indicator (P1)

While waiting for the first response token, user sees an animated thinking indicator instead of an empty screen.

**Acceptance Scenarios**:
1. **Given** user sends a message, **When** waiting for first token, **Then** animated "Claude is thinking..." with pulsing dots appears
2. **Given** first token arrives, **When** thinking indicator fades out, **Then** progressive text rendering begins

### User Story 2 — Progressive Text Rendering (P1)

Response text appears character-by-character with a smooth fade-in effect.

**Acceptance Scenarios**:
1. **Given** stream chunks arrive, **When** text is appended, **Then** new characters fade in over 100ms
2. **Given** stream is complete, **When** final message renders, **Then** token/speed counter shows final stats

### User Story 3 — Tool Use Visualization (P2)

When the provider uses a tool, the user sees an inline card showing what's happening.

**Acceptance Scenarios**:
1. **Given** provider calls a tool (search, code exec, image gen), **When** tool use event arrives, **Then** inline card shows tool name, input summary, and spinner
2. **Given** tool completes, **When** tool result arrives, **Then** card updates to show output, then stream continues

### User Story 4 — Streaming Error Recovery (P2)

If the stream breaks mid-response, user can see what was received and retry.

**Acceptance Scenarios**:
1. **Given** stream breaks mid-response, **When** error occurs, **Then** partial response is shown with "Response interrupted — click to retry" banner

### User Story 5 — Cancel Button (P2)

User can stop a streaming response at any time.

**Acceptance Scenarios**:
1. **Given** a stream is in progress, **When** user clicks "Stop" button, **Then** stream is cancelled via AbortSignal and partial response remains visible

## Requirements

- **FR-001**: Thinking indicator MUST show provider name and animated dots
- **FR-002**: Text MUST render progressively with fade-in at 100ms per chunk
- **FR-003**: Tool use events MUST render as inline cards with tool name + spinner
- **FR-004**: Stream break MUST preserve partial response and show retry banner
- **FR-005**: Cancel button MUST send AbortSignal and keep partial response
- **FR-006**: Token/speed counter MUST update in real-time during streaming

## Success Criteria

- SC-001: First token renders within 100ms of arrival
- SC-002: Tool use cards render within 50ms of tool_use event
- SC-003: Cancel stops rendering within 200ms of click
