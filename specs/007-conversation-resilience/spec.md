# Feature Specification: Conversation Resilience

**Feature Branch**: `007-conversation-resilience`  
**Created**: 2025-07-17 | **Status**: Ready  
**Input**: Graceful error handling for Chrome crashes, CDP disconnections, and session expirations during conversations

## User Scenarios

### User Story 1 — Chrome Crash During Send (P1)

User is sending a message when the Chrome slave crashes. Instead of a silent failure or generic error, they see a clear recovery path.

**Acceptance Scenarios**:
1. **Given** a send is in progress, **When** Chrome slave crashes, **Then** error message appears: "Chrome disconnected — your message was not sent. Click Retry to reconnect and resend."
2. **Given** the error is showing, **When** user clicks "Retry", **Then** system reconnects Chrome slave and resends the last message
3. **Given** Chrome reconnection succeeds, **When** resend completes, **Then** user sees normal streaming response

### User Story 2 — Session Expired Mid-Conversation (P1)

Provider session expires while the user is actively chatting.

**Acceptance Scenarios**:
1. **Given** provider session cookie is expired, **When** pre-flight check runs before sending, **Then** inline warning shows: "ChatGPT session expired — click to re-login"
2. **Given** user clicks "Re-login", **When** ChromeSetupWizard launches, **Then** login page opens in visible Chrome for manual login

### User Story 3 — Circuit Breaker Open (P2)

Circuit breaker opens after repeated failures. User sees status instead of repeated errors.

**Acceptance Scenarios**:
1. **Given** circuit breaker is open for a provider, **When** user attempts to send, **Then** message shows: "Provider temporarily unavailable — waiting for recovery" with estimated retry time

## Requirements

- **FR-001**: Send pipeline MUST pre-flight check Chrome liveness, CDP connection, and session validity
- **FR-002**: On Chrome crash, system MUST show recovery message with Retry button
- **FR-003**: On session expiry, system MUST show re-login prompt inline
- **FR-004**: On circuit open, system MUST show "temporarily unavailable" with auto-recovery countdown
- **FR-005**: Auto-recovery MUST attempt one reconnect before showing error to user
- **FR-006**: All resilience states MUST be surfaced as frontend capability slots (not hardcoded strings)

## Success Criteria

- SC-001: 90% of Chrome crashes recoverable with one-click Retry
- SC-002: Session expiry detected within 1 second of pre-flight check
- SC-003: User never sees a raw stack trace from a CDP failure
