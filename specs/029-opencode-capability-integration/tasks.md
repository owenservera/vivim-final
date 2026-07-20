# Tasks: OpenCode Serve Capability Integration (029)

**Input**: Design documents from `/specs/029-opencode-capability-integration/`

**Prerequisites**: 027 (supervisor/client/ingest) complete, all 7 opencode integration tests passing

**Gate (per unit)**:
```powershell
bun run typecheck              # 0 errors in touched files
bun run lint                   # 0 new warnings
```

**Gate (final)**:
```powershell
bun test tests/integration/opencode     # 7 still pass
bun run devops runtime-test test --nl="send message to opencode"  # resolves
```

## Phase 1: Executor (Core)

- [ ] T001 Create `src/engines/opencode/opencode-executor.ts` — `OpenCodeExecutor` class implementing NLCL `CommandExecutor` interface. Handles intents: `opencode.send`, `opencode.session.create`, `opencode.session.list`, `opencode.permission.respond`. Uses `OpenCodeClient` for HTTP calls, `OpenCodeIngest` for event projection. Collects SSE response blocks with 30s timeout.

- [ ] T002 Register `OpenCodeExecutor` in `src/engines/nlcl/nlcl-engine.ts` alongside other executors.

- [ ] T003 Create `tests/unit/engines/opencode-executor.test.ts` — unit test with mock client/ingest.

## Phase 2: Capabilities

- [ ] T004 Add `opencodeClient?: OpenCodeClient` and `opencodeIngest?: OpenCodeIngest` to `BootstrapServices` in `src/engines/capability-bootstrap.ts`.

- [ ] T005 Register 4 capabilities in `registerDefaultCapabilities`:
  - `cap:opencode:send` — sends prompt via client, returns response blocks
  - `cap:opencode:session.create` — creates session via client
  - `cap:opencode:session.list` — lists active sessions (from ingest state)
  - `cap:opencode:permission.respond` — responds to pending permission

- [ ] T006 In `src/server/index.ts`, pass `opencodeClient` and `opencodeIngest` from `globalThis.__opencodeServe` into `BootstrapServices`.

## Phase 3: NL Patterns

- [ ] T007 Add `opencodePatterns` to `src/engines/nlcl/catalog.ts`:
  - `"ask opencode to <task>"` → `opencode.send`
  - `"send to opencode: <prompt>"` → `opencode.send`
  - `"opencode session list"` → `opencode.session.list`
  - `"opencode session create"` → `opencode.session.create`

- [ ] T008 Spread `...opencodePatterns` into `getDefaultCommandPatterns()`.

## Phase 4: API Routes

- [ ] T009 Add `POST /api/opencode/send` — accepts `{ prompt, sessionId?, model? }`, returns response blocks.

- [ ] T010 Add `POST /api/opencode/session` — accepts `{ model?, cwd? }`, returns `{ sessionId }`.

- [ ] T011 Add `GET /api/opencode/sessions` — returns list of active sessions.

- [ ] T012 Add `POST /api/opencode/permission/:id` — accepts `{ sessionId, decision }`, responds to permission.

## Phase 5: Gate

- [ ] T013 Run `bun run typecheck` — 0 errors in touched files.
- [ ] T014 Run `bun run lint` — 0 new warnings.
- [ ] T015 Run `bun test tests/integration/opencode` — 7 still pass.
- [ ] T016 Run `bun run devops runtime-test test --nl="send message to opencode"` — resolves.

## Dependencies

```
T001 → T002 → T003        (executor chain)
T004 → T005 → T006        (capability chain)
T007 → T008               (NL patterns)
T009 → T010 → T011 → T012 (API routes)
All → T013 → T014 → T015 → T016 (gate)
```

## Parallel Opportunities

- T001 and T004 can run in parallel (different files)
- T007 and T009 can run in parallel (different files)
- T002 and T005 can run in parallel (different files)
