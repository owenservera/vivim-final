# v4 Phase Dependencies

## Intra-Phase Chains

All v4 phases have linear internal chains (each unit depends on the previous).

### Phase 1: E2E Bootstrap & Login
```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
```
- 1.1 wires CDP transport (foundation)
- 1.2 loads provider seeds
- 1.3 sets up workspace/profile
- 1.4 launches visible Chrome
- 1.5 verifies login state
- 1.6 persists account
- 1.7 reuses profile headlessly

### Phase 2: Single-Turn Conversation
```
2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8
```
- 2.1 fixes slave ID (naming foundation)
- 2.2 implements real harness execution
- 2.3 types via CDP
- 2.4 submits via CDP
- 2.5 captures network response
- 2.6 parses SSE → ContentBlocks
- 2.7 stores + emits events
- 2.8 renders in frontend

### Phase 3: Multi-Turn Conversation
```
3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
```
- 3.1 persists state across turns
- 3.2 handles DOM recovery
- 3.3 streams via WebSocket
- 3.4 renders live streaming
- 3.5 handles errors/circuit breaker
- 3.6 heals broken selectors

### Phase 4: Three-Provider Demo
```
4.1 → 4.2 → 4.3 → 4.4 → 4.5
```
- 4.1 ChatGPT E2E
- 4.2 Claude E2E
- 4.3 Gemini E2E
- 4.4 Provider switching UI
- 4.5 Health monitoring

### Phase 5: Frontend Performance
```
5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
```
- 5.1 Optimistic UI
- 5.2 WS debouncing
- 5.3 Virtual scrolling
- 5.4 Mirror sync
- 5.5 Latency budget
- 5.6 Mutation safety

### Phase 6: Platform Foundation
```
6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6
```
- 6.1 ActionRegistry
- 6.2 AgentBridge
- 6.3 Capability UI
- 6.4 DevTools
- 6.5 Provider management
- 6.6 Workspace settings

### Phase 7: Reliability & Persistence
```
7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 → 7.7
```
- 7.1 Fleet persistence
- 7.2 Port reaper adopt
- 7.3 Conversation locking
- 7.4 Double-send protection
- 7.5 Graceful shutdown
- 7.6 SQLite WAL
- 7.7 Retry policy

### Phase 8: Resource Management
```
8.1 → 8.2 → 8.3
```
- 8.1 Idle TTL
- 8.2 DB abstraction
- 8.3 Backpressure

### Phase 9: Observability
```
9.1 → 9.2 → 9.3 → 9.4 → 9.5
```
- 9.1 Structured logging
- 9.2 Metrics export
- 9.3 Error tracking
- 9.4 Audit trail
- 9.5 Latency SLA

### Phase 10: Frontend Resilience
```
10.1 → 10.2 → 10.3
```
- 10.1 Error boundary
- 10.2 Loading states
- 10.3 Keyboard shortcuts

### Phase 11: Stealth Core
```
11.1 → 11.2 → 11.3 → 11.4
```
- 11.1 Launch profiles
- 11.2 Stealth modules
- 11.3 Profile store
- 11.4 Extension bridge

### Phase 12: Fingerprint Spoofing
```
12.1 → 12.2 → 12.3 → 12.4
```
- 12.1 Canvas noise
- 12.2 WebGL spoof
- 12.3 Audio context
- 12.4 Font/screen

### Phase 13: Human Simulation
```
13.1 → 13.2 → 13.3
```
- 13.1 Mouse
- 13.2 Keyboard
- 13.3 Scroll

### Phase 14: Profile & Trace
```
14.1 → 14.2 → 14.3 → 14.4
```
- 14.1 Profile warmup
- 14.2 CDP artifact cleanup
- 14.3 Network fingerprint
- 14.4 Behavioral pattern

## Inter-Phase Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                                         ↓
Phase 5 → Phase 6 → Phase 7 → Phase 8
                                         ↓
Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14
```

**Rationale:** Linear progression. Each phase builds on the previous.
