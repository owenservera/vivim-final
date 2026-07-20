# Tasks: OpenCode `serve` Backend Integration (v2 persistent harness)

**Input**: Design documents from `/specs/027-opencode-serve/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Gate (per unit)**:
```powershell
bun run typecheck              # 0 errors in touched files
bun test tests/unit/<path>     # unit tests pass
bun run lint                   # 0 new warnings
```

**Gate (per phase)**:
```powershell
bun build src/server/index.ts          # additive boot wiring imports cleanly (no full tsc)
bun test tests/integration/opencode     # S1/S2/S3 pass
```

**Gate (final)**:
```powershell
bun test tests/integration/agentic      # 16 still pass (backbone untouched)
bun run devops verify-cross-surface     # 3548/3548 (not broken by additive line)
```

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- Backend tasks use `src/engines/`, `src/storage/contracts/`, `src/storage/impl/`
- Test tasks use `tests/unit/engines/`, `tests/integration/opencode/`

## Project Conventions

- **Language**: TypeScript strict, ESNext, `.js` extension in imports
- **Runtime**: Bun
- **ORM**: Prisma v6.5
- **Linter**: Biome
- **Testing**: `bun test` (Bun test runner)
- **Patterns**: `type` imports, `no any`, Zod validation, custom errors from `src/errors.ts`
- **Invariants**: Governor Canon (only ChromeGovernor touches CDP), Store Contracts (engines depend on contracts, not impls)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify prerequisites and substrate are present (AGENT5 confirmed).

- [ ] T001 Confirm `opencode` v1.17.15 on PATH and `bun --version`
- [ ] T002 Confirm the 4 OpenCode Prisma tables exist (`AgentSession`/`AgentPermissionDecision`/`AgentFileEdit`/`EventRecord`) — `prisma/schema.prisma:2967`
- [ ] T003 Confirm `AgenticStoreContract` Option C methods + `EventRecordStore.append` + `parseOpencodeJson` are present (reuse, no rebuild)
- [ ] T004 Confirm `opencode` `ProviderDefinition` seeded by feature `022` (`capability-bootstrap.ts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared substrate the three engines depend on. NO schema migration (tables exist).

- [ ] T005 [P] Add `createOpencodeAgentSession` to `src/storage/impl/agentic-store-impl.ts` — writes `AgentSession` (providerId='opencode') linked to a `ProviderSession`, mirroring `ensureAgentProviderSession` (do NOT change contract signatures)
- [ ] T006 [P] Add `OpencodeEvent` type + risk-tier mapping helper to `src/schema/streaming.ts` (reuse `parseOpencodeJson` from local-agent-executor)
- [ ] T007 [P] Add `EngineError` variants for supervisor/client failures in `src/errors.ts` if absent (e.g. `OPENCODE_SERVE_DOWN`, `OPENCODE_PERMISSION_DENIED`)

**Checkpoint**: Foundation ready — `bun build src/server/index.ts` clean before adding new engines.

---

## Phase 3: User Story 1 - Supervise local `opencode serve` (Priority: P1)

**Goal**: Spawn + supervise `opencode serve` on `127.0.0.1` with password, readiness probe, crash-restart backoff, clean shutdown. Default OFF.

**Independent Test**: `bun test tests/integration/opencode/supervisor.test.ts` (S3) — boots serve, probes `/doc` 200, stops cleanly.

### Tests (write FIRST, ensure FAIL before implementation)

- [ ] T008 [P] [US1] Unit test in `tests/unit/engines/opencode-supervisor.test.ts` — args/loopback/password assertion (mock spawn)
- [ ] T009 [P] [US1] Integration test in `tests/integration/opencode/supervisor.test.ts` (S3)

### Implementation

- [ ] T010 [US1] Create `src/engines/opencode/opencode-supervisor.ts` — spawn `opencode serve --port <p> --hostname 127.0.0.1` with `OPENCODE_SERVER_PASSWORD`; poll `/doc` until 200; restart with bounded backoff (max 5); SIGTERM clean kill; `OPENCODE_SERVE_ENABLED` gate
- [ ] T011 [US1] Run gate: `bun test tests/integration/opencode/supervisor.test.ts && bun run lint`

**Checkpoint**: Supervisor boots + stops a real `opencode serve` cleanly.

---

## Phase 4: User Story 2 - Client talks `serve` HTTP/SSE API (Priority: P1)

**Goal**: Create session, send prompt, subscribe to `GET /event` SSE, map frames → `ContentBlock[]` via `parseOpencodeJson`.

**Independent Test**: `bun test tests/integration/opencode/client.test.ts` (S1a) against mock serve — session created, prompt accepted, SSE parsed.

### Tests

- [ ] T012 [P] [US2] Unit test in `tests/unit/engines/opencode-client.test.ts` — `parseOpencodeJson` reuse: text/tool/invalid/error blocks; basic-auth header
- [ ] T013 [P] [US2] Integration test in `tests/integration/opencode/client.test.ts` (S1a)

### Implementation

- [ ] T014 [US2] Create `src/engines/opencode/opencode-client.ts` — `OpenCodeClient`: `ready()`, `createSession()`, `sendPrompt()`, `subscribe()` (SSE → `parseOpencodeJson`), `respondPermission()`, `getDiff()`; localhost + basic auth; defensive unknown-event handling
- [ ] T015 [US2] Run gate: `bun test tests/integration/opencode/client.test.ts && bun run lint`

**Checkpoint**: Client drives a mock serve end-to-end; SSE → ContentBlock[].

---

## Phase 5: User Story 3 - Ingest sessions into local DB (Priority: P1)

**Goal**: Project served events into `AgentSession`/`AgentPermissionDecision`/`AgentFileEdit` + durable `EventRecord`; render as vivim chat thread via Option C. Idempotent.

**Independent Test**: `bun test tests/integration/opencode/ingest.test.ts` (S1/S2) — rows written, hash chain extended, thread renders, idempotent re-ingest.

### Tests

- [ ] T016 [P] [US3] Integration test in `tests/integration/opencode/ingest.test.ts` (S1) — projection + EventRecord + idempotency
- [ ] T017 [P] [US3] Integration test in `tests/integration/opencode/ingest.test.ts` (S2 thread render)

### Implementation

- [ ] T018 [US3] Create `src/engines/opencode/opencode-ingest.ts` — consumes client events; writes `AgentSession` (via T005), `AgentPermissionDecision`, `AgentFileEdit` (RFC-6902), `EventRecord.append({source:'opencode',...})`; renders via `startAgentConversation`/`appendAgentMessage`; dedupes by provider ids
- [ ] T019 [US3] Run gate: `bun test tests/integration/opencode/ingest.test.ts && bun run lint`

**Checkpoint**: Served session fully projected + replayable; thread renders via `getAgentMessages`.

---

## Phase 6: User Story 4 - Governor-owned permissions (Priority: P2)

**Goal**: Governor assesses each `/event` permission request in-process; tier > 3 auto-denied; decision POSTed back to OpenCode.

**Independent Test**: `bun test tests/integration/opencode/permission.test.ts` (S2b) — tier-4 bash → deny + POST `decision:'deny'`.

### Tests

- [ ] T020 [P] [US4] Integration test in `tests/integration/opencode/permission.test.ts` (S2b)

### Implementation

- [ ] T021 [US4] Extend `src/engines/opencode/opencode-ingest.ts` — Governor risk assessment hook (tier mapping from data-model.md); auto-deny tier>3; `respondPermission()` POST; record `decidedBy='governor'`
- [ ] T022 [US4] Run gate: `bun test tests/integration/opencode/permission.test.ts && bun run lint`

**Checkpoint**: Governor is sole authority over OpenCode tool permissions.

---

## Phase 7: Additive Boot Wiring (local-first gate)

- [ ] T023 [P] Add ONE env-gated supervisor boot line in `src/server/index.ts` (after the memory-fabric block, ~line 688) — synced with AGENT3; `OPENCODE_SERVE_ENABLED` only; never blocks other providers
- [ ] T024 [P] Run `bun build src/server/index.ts` — exit 0 (import-clean additive wiring)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Run `bun test tests/integration/opencode` — S1/S2/S3 pass
- [ ] T026 [P] Run `bun test tests/integration/agentic` — 16 still pass
- [ ] T027 [P] Run `bun run devops verify-cross-surface` — confirm not broken by additive line
- [ ] T028 [P] Run `bun run lint` on `src/engines/opencode/` — 0 new warnings

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Supervisor — independent
- **US2 (Phase 4)**: Client — depends on Foundational
- **US3 (Phase 5)**: Ingest — depends on US2 (client events) + T005
- **US4 (Phase 6)**: Governor perms — depends on US3 ingest
- **Boot (Phase 7)**: depends on US1+US2+US3
- **Polish (Phase 8)**: depends on all

## Parallel Opportunities

- T005/T006/T007 (Foundational) run in parallel (different files)
- T008/T009 (US1 tests) parallel; T012/T013 (US2 tests) parallel; T016/T017 (US3 tests) parallel; T020 (US4 test) parallel
- US1 supervisor and US2 client impl can be parallelized across agents (different files)

## Implementation Strategy — MVP First

1. Phase 1 Setup → substrate confirmed
2. Phase 2 Foundational → T005/T006/T007
3. Phase 3 US1 Supervisor → independently testable MVP (S3)
4. **STOP and VALIDATE**: `bun test tests/integration/opencode/supervisor.test.ts`
5. Phase 4 US2 Client → S1a
6. Phase 5 US3 Ingest → S1/S2
7. Phase 6 US4 Governor perms → S2b
8. Phase 7 Boot wiring → `bun build` clean
9. Phase 8 Polish → full gate

## Notes

- No new Prisma migration (4 tables exist).
- No new message table (Option C chat methods).
- Governor Canon preserved (no `BunCdpClient`).
- Default OFF; localhost-only; password always set.
- Do NOT commit unless explicitly asked.
