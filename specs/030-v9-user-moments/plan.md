# Implementation Plan: Wire 10 Critical User Moments in v9 Canvas

**Feature**: 030-v9-user-moments
**Branch**: `030-v9-user-moments`
**Created**: 2026-07-19
**Status**: Ready for Implementation
**Spec**: [spec.md](./spec.md)

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18, React Flow
**Storage**: SQLite via Prisma (`dev.db`)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React canvas frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: SC-001..SC-010 (streaming <2s, palette <100ms, conv list <500ms, WS reconnect <5s, provider switch <1s, search <1s, memory <500ms, health 30s, session load <10s).
**Constraints**: Governor Canon, Store Contracts, One Entry Point, Research-First (all resolved — no backend changes required, SC-010 holds).

## Constitution Check

*GATE: Must pass before implementation. Re-checked post-design.*

- [x] Governor Canon: no engine imports `BunCdpClient` directly (frontend wiring only; no new engine CDP imports)
- [x] Store Contracts: engines depend on contracts, not impls (no new engines; reuse existing routers)
- [x] One Entry Point: all 10 moments resolve via `UnifiedCapability` → `POST /api/capabilities/:id/execute` (no second transport, no hardcoded UI branches)
- [x] Custom errors: no raw `new Error()` in engines (no engine changes)
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions (frontend follows conventions)
- [x] Tests: unit + integration + typecheck + lint gates (verify-cross-surface post-wire)

**Complexity Tracking**: No constitution violations. All moments are frontend wiring against existing routers/WS/capability registry.

## Executive Summary

This plan wires the 10 critical user moments identified in USER-MOMENTS.md into the v9 frontend canvas. Each moment maps to specific API endpoints, capabilities, and WebSocket events that must be connected for a fully functional user experience.

## Priority Tiers

### P0 - Must Work (MVP Foundation)
1. **Moment 1: First Contact** - Backend liveness + auth
2. **Moment 2: Send a Message** - Streaming AI response
3. **Moment 5: Conversation List** - Session history

### P1 - Core Differentiators
4. **Moment 3: Switch Provider** - Multi-AI support
5. **Moment 4: Command Palette** - Keyboard-driven actions
6. **Moment 6: Real-time Events** - Live updates

### P2 - Enhanced Experience
7. **Moment 7: Knowledge Search** - Cross-conversation intelligence
8. **Moment 8: Memory Management** - Persistent context
9. **Moment 9: Provider Health** - System visibility
10. **Moment 10: Session Lifecycle** - Provider session management

## Dependency Graph

```
Moment 1 (First Contact)
  ↓
Moment 2 (Send Message) ← depends on Moment 1
  ↓
Moment 5 (Conversation List) ← depends on Moment 1
  ↓
Moment 3 (Switch Provider) ← depends on Moment 1
  ↓
Moment 4 (Command Palette) ← depends on Moment 1, Moment 3
  ↓
Moment 6 (Real-time Events) ← depends on Moment 1
  ↓
Moment 7 (Knowledge Search) ← depends on Moment 5
  ↓
Moment 8 (Memory Management) ← depends on Moment 1
  ↓
Moment 9 (Provider Health) ← depends on Moment 3
  ↓
Moment 10 (Session Lifecycle) ← depends on Moment 3
```

## Implementation Order

### Phase 1: P0 Foundation (Week 1)

#### T001: Backend Liveness Check
- **API**: `GET /api/health`, `GET /api/auth/session`
- **Component**: `LoginPanel.tsx` (already exists)
- **WebSocket**: Connection to `ws://localhost:9420/ws`
- **Acceptance**: App shows "Connected" within 2 seconds

#### T002: Send Message with Streaming
- **API**: `POST /api/conversations/:id/send`, `POST /api/interpret`
- **Component**: `StreamingIndicator.tsx` (already exists)
- **WebSocket**: `conversation:<id>` topic
- **Acceptance**: Character-by-character streaming response

#### T003: Conversation List
- **API**: `GET /api/conversations`, `POST /api/conversations`, `DELETE /api/conversations/:id`
- **Component**: Sidebar conversation list
- **Acceptance**: Conversations load within 500ms

### Phase 2: P1 Differentiators (Week 2)

#### T004: Switch Provider
- **API**: `GET /api/providers`, `GET /api/providers/:id/capabilities`
- **Component**: Provider selector dropdown
- **Acceptance**: Provider switch completes within 1 second

#### T005: Command Palette
- **API**: `GET /api/capabilities?surface=cli`, `POST /api/capabilities/:id/execute`
- **Component**: `CommandPalette.tsx` (already exists)
- **Acceptance**: Palette opens within 100ms of Cmd+K

#### T006: Real-time Events
- **WebSocket**: `subscribe` + topics
- **Component**: `useWebSocket.ts` (already exists)
- **Acceptance**: Reconnects within 5 seconds

### Phase 3: P2 Enhanced (Week 3)

#### T007: Knowledge Search
- **API**: `GET /api/knowledge/search?q=<query>`
- **Component**: Search UI in sidebar
- **Acceptance**: Results appear within 1 second

#### T008: Memory Management
- **API**: `POST /api/memory/assert`, `GET /api/memory/query?q=<query>`
- **Component**: Memory panel
- **Acceptance**: Memory query returns within 500ms

#### T009: Provider Health
- **API**: `GET /api/telemetry/health`
- **Component**: Health dashboard
- **Acceptance**: Updates every 30 seconds

#### T010: Session Lifecycle
- **API**: `POST /api/session/load`, `GET /api/session/list`, `DELETE /api/session/:id`
- **Component**: Session manager
- **Acceptance**: Session load completes within 10 seconds

## API Endpoint Mapping

| Moment | API Endpoint | Method | Purpose |
|--------|--------------|--------|---------|
| 1 | `/api/health` | GET | Liveness check |
| 1 | `/api/auth/session` | GET | Current session |
| 1 | `/api/auth/login` | POST | Authenticate |
| 2 | `/api/conversations/:id/send` | POST | Send message (streams) |
| 2 | `/api/interpret` | POST | NL → capability resolution |
| 3 | `/api/providers` | GET | List providers |
| 3 | `/api/providers/:id/capabilities` | GET | Resolved capabilities |
| 4 | `/api/capabilities?surface=cli` | GET | CLI capabilities |
| 4 | `/api/capabilities/:id/execute` | POST | Execute capability |
| 5 | `/api/conversations` | GET | List conversations |
| 5 | `/api/conversations` | POST | Create conversation |
| 5 | `/api/conversations/:id/messages` | GET | Message history |
| 5 | `/api/conversations/:id` | DELETE | Delete conversation |
| 6 | WebSocket `subscribe` | WS | Real-time events |
| 7 | `/api/knowledge/search?q=` | GET | Search knowledge |
| 8 | `/api/memory/assert` | POST | Assert fact |
| 8 | `/api/memory/query?q=` | GET | Query memory |
| 9 | `/api/telemetry/health` | GET | Fleet health |
| 10 | `/api/session/load` | POST | Load session |
| 10 | `/api/session/list` | GET | List sessions |
| 10 | `/api/session/:id` | DELETE | End session |

## Quality Gates

### Gate 1: P0 Completion
- [ ] All P0 moments wireable
- [ ] Backend liveness check works
- [ ] Message streaming works
- [ ] Conversation list loads

### Gate 2: P1 Completion
- [ ] All P1 moments wireable
- [ ] Provider switching works
- [ ] Command palette functional
- [ ] WebSocket real-time events work

### Gate 3: P2 Completion
- [ ] All P2 moments wireable
- [ ] Knowledge search works
- [ ] Memory management works
- [ ] Health dashboard displays
- [ ] Session lifecycle works

## Risk Assessment

### High Risk
- **WebSocket reconnection**: Must handle disconnections gracefully
- **Streaming response**: Must parse SSE/WebSocket chunks correctly
- **Provider capability resolution**: Must refresh when provider changes

### Medium Risk
- **Command palette performance**: Must handle 50+ capabilities efficiently
- **Conversation list pagination**: Must handle 100+ conversations
- **Memory query accuracy**: Must return relevant results

### Low Risk
- **Health dashboard**: Simple read-only display
- **Session lifecycle**: Well-defined API endpoints
- **Knowledge search**: Standard search functionality

## Success Metrics

- **SC-001**: Message send → streaming response within 2 seconds
- **SC-002**: Command palette opens within 100ms
- **SC-003**: Conversation list loads within 500ms
- **SC-004**: WebSocket reconnects within 5 seconds
- **SC-005**: Provider switch completes within 1 second
- **SC-006**: Search results appear within 1 second
- **SC-007**: Memory query returns within 500ms
- **SC-008**: Health dashboard updates every 30 seconds
- **SC-009**: Session load completes within 10 seconds
- **SC-010**: All 10 moments wireable without backend changes

## Next Steps

1. **Create tasks.md** with detailed task breakdown
2. **Begin implementation** starting with P0 moments
3. **Run quality gates** after each phase
4. **Validate** against USER-MOMENTS.md API mapping
