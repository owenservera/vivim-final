# 08 — Merged Implementation Plan

**Status:** FINAL — merged PRD
**Covers:** Original `07-migration-plan.md` + `08-test-plan.md` + `pending-design/09-doc-alignment.md` + `pending-design/10-implementation-plan.md`

---

## 6-Phase Execution Plan

### Phase 1: Skeleton

**Goal:** New repo boots with clean schema. `bun run typecheck` passes. Storage tests green.

#### Files to CREATE (~5)

```
prisma/schema.prisma                  ← 54 tables, relations, indexes (Prisma)
prisma/seed.sql                       ← CHECK constraints, 9 views, seed data
.env                                  ← DATABASE_URL
src/storage/prisma.ts                 ← PrismaClient singleton
src/storage/db.ts                     ← CapStoreDb using PrismaClient
tsconfig.json                         ← strict mode
```

#### Prisma Commands

```
bunx prisma generate   ← Generate typed Prisma client
bunx prisma db push    ← Create SQLite dev.db from schema
```

#### Gate Criteria

- [ ] `bunx prisma generate` → zero errors
- [ ] `bunx prisma db push` → creates dev.db with all 54 tables
- [ ] `bun run typecheck` → zero errors
- [ ] DB opens, all 54 tables created, CHECK constraints enforced

---

### Phase 2: Provider Knowledge Graph

**Goal:** 7 providers seeded from JSON manifests. ProviderRegistrar working.

#### Files to CREATE (~14)

```
seeds/providers/claude.json
seeds/providers/chatgpt.json
seeds/providers/gemini.json
seeds/providers/deepseek.json
seeds/providers/studio-ai.json
seeds/providers/z-ai.json
seeds/providers/qwen.json
src/engines/provider-registrar.ts
src/engines/registration-auditor.ts
src/engines/config-manager.ts
src/engines/execution-memoizer.ts
tests/unit/engines/provider-registrar.test.ts
tests/unit/engines/registration-auditor.test.ts
tests/unit/engines/config-manager.test.ts
```

#### Gate Criteria

- [ ] `ProviderRegistrar.seedAll()` populates 7 providers
- [ ] All provider tables populated
- [ ] `bunx tsc --noEmit` → zero
- [ ] All unit tests pass

---

### Phase 3: ChromeGovernor + ConversationManager

**Goal:** Single I/O authority. Multi-turn send/receive works.

#### Files to CREATE (~10)

```
src/engines/chrome-governor.ts       ← 4 subsystems
src/engines/conversation-manager.ts  ← 8-step pipe
src/engines/capability-event-bus.ts
src/engines/stream-block-store.ts
tests/unit/engines/chrome-governor.test.ts
tests/unit/engines/conversation-manager.test.ts
tests/unit/engines/capability-event-bus.test.ts
tests/unit/engines/stream-block-store.test.ts
tests/e2e/claude-send.test.ts
tests/e2e/chatgpt-send.test.ts
```

#### Files to PORT (~16 — logic extraction)

From current codebase → Governor subsystems:
```
fleet-supervisor.ts    → Governor.LifecycleManager
profile-allocator.ts   → Governor.LifecycleManager
account-registry.ts    → Governor.LifecycleManager
slave-write.ts         → Governor.CDPProxy
slave-read.ts          → Governor.CDPProxy
stream-capture.ts      → Governor.CDPProxy
network-capture.ts     → Governor.CDPProxy
health/probe.ts        → Governor.HealthMonitor
health/loop.ts         → Governor.HealthMonitor
harness.ts             → Governor.CDPProxy (injectHarness)
cdp.ts                 → BunCdpClient (wrapped by CDPProxy)
conversation-driver.ts → ConversationManager
content-pipeline.ts    → ConversationManager
```

#### Files to DELETE (~16 — absorbed)

```
fleet-supervisor.ts, profile-allocator.ts, account-registry.ts,
slave-write.ts, slave-read.ts, stream-capture.ts, network-capture.ts,
launcher.ts, port-reaper.ts, ensure-session.ts, auth-probe.ts,
health/probe.ts, health/loop.ts, conversation-driver.ts,
turn-executor.ts, content-pipeline.ts
```

#### Gate Criteria

- [ ] `ChromeGovernor.boot()` completes
- [ ] `Governor.launch('claude')` spawns Chrome
- [ ] `Governor.captureConversation()` captures test response
- [ ] `ConversationManager.send(convId, msg)` completes 8-step pipeline
- [ ] Multi-turn E2E works for Claude, ChatGPT, Gemini
- [ ] `bunx tsc --noEmit` → zero
- [ ] Governor + Manager unit tests pass

---

### Phase 4: Remaining Engines

**Goal:** All engines built and tested.

#### Files to CREATE (~30)

```
src/engines/stream-parser.ts
src/engines/capability.ts
src/engines/capability-resolution.ts
src/engines/provider-health.ts
src/engines/version-manager.ts
src/engines/telemetry-aggregator.ts
seeds/parsers/claude/001_streaming_sse.ts
seeds/parsers/gemini/001_batchexecute.ts
seeds/parsers/chatgpt/001_openai_sse.ts
seeds/parsers/generic/001_sse_frames.ts
seeds/parsers/generic/002_openai_delta.ts
seeds/parsers/system/001_fallback.ts
seeds/harness/composer.module.ts
seeds/harness/login.module.ts
seeds/harness/navigation.module.ts
seeds/harness/capture.module.ts
seeds/harness/selector.module.ts
tests/unit/engines/
  stream-parser.test.ts
  capability.test.ts
  capability-resolution.test.ts
  provider-health.test.ts
  version-manager.test.ts
  telemetry-aggregator.test.ts
  execution-memoizer.test.ts
```

#### Gate Criteria

- [ ] StreamParserEngine parses canned SSE for all 3 providers
- [ ] CapabilityResolutionEngine resolves correct UI contracts
- [ ] CapabilityEventBus delivers events to typed subscribers
- [ ] ProviderHealthKernel produces valid health reports
- [ ] VersionManager handles auto-promotion
- [ ] TelemetryAggregator runs schedules
- [ ] `bunx tsc --noEmit` → zero
- [ ] All engine unit tests pass

---

### Phase 5: Server + SDK + CLI

**Goal:** REST API serving. WebSocket broadcasting. SDK functional. CLI working.

#### Files to CREATE (~25)

```
src/server/index.ts                  ← Bun.serve + routes
src/server/response.ts               ← CORS + JSON helpers
src/server/websocket.ts              ← WS bridge
src/server/conversation-router.ts    ← route handlers
src/server/auth-gate.ts              ← Bearer token
sdk/src/types.ts                     ← clean types
sdk/src/client.ts                    ← full typed client
sdk/src/index.ts
src/cli/index.ts                     ← CLI entry
src/cli/command-registry.ts
src/cli/output-formatter.ts
src/cli/pipeline-engine.ts
src/cli/bridges/cap-store-bridge.ts
src/cli/bridges/backend-bridge.ts
src/cli/bridges/extension-bridge.ts
src/cli/commands/providers.ts
src/cli/commands/fleet.ts
src/cli/commands/conversations.ts
src/cli/commands/admin.ts
src/cli/commands/config.ts
src/cli/commands/health.ts
src/cli/commands/version.ts
src/cli/commands/telemetry.ts
src/cli/commands/system.ts
tests/integration/api/               ← 7 test files
sdk/tests/client.test.ts
```

#### Gate Criteria

- [ ] All REST endpoints respond with correct JSON shapes
- [ ] WebSocket subscription/unsubscription works
- [ ] Auth gate returns 401 for missing/invalid tokens
- [ ] SDK client methods hit all endpoints
- [ ] CLI commands work across all subsystems
- [ ] `bunx tsc --noEmit` → zero
- [ ] All integration + SDK tests pass

---

### Phase 6: Clean & Ship

**Goal:** Zero dead code. Verified alignment. Manual E2E pass.

#### Tasks

1. Run doc-alignment checklist → fix all contradictions
2. Verify no dead table references anywhere (22 deleted tables confirmed absent)
3. `bun test` → all pass (target: ~120 tests)
4. `bunx tsc --noEmit` → zero errors
5. Manual E2E: send message to Claude/ChatGPT/Gemini → verify response correct
6. Manual E2E: multi-turn conversation (3 turns each provider)
7. Manual E2E: concurrent sends (Claude + ChatGPT simultaneously)
8. Manual E2E: config change at runtime → takes effect without restart
9. Manual E2E: kill Chrome → Governor auto-restarts → conversation continues

#### Gate Criteria

- [ ] Zero `tsc --noEmit` errors
- [ ] Zero `bun test` failures
- [ ] Multi-turn send/receive verified for Claude, ChatGPT, Gemini
- [ ] Concurrent sends to different providers work
- [ ] Re-programability verified (config change takes effect)

---

## Test Plan

### Test Layers

| Layer | Location | Count (est.) | Mock Strategy |
|-------|----------|-------------|---------------|
| Storage Contracts | `tests/unit/storage/` | 5 | In-memory `:memory:` DB |
| Engine Unit Tests | `tests/unit/engines/` | 13 | Mock store contracts |
| Integration Tests | `tests/integration/api/` | 7 | Real DB + mock CDP endpoint |
| SDK Tests | `sdk/tests/` | 1 | Test server |
| E2E Tests | `tests/e2e/` | 3 | Real Chrome (manual) |
| **Total** | | **~120** | |

### Engine Unit Test Patterns

```typescript
// Example: VersionManager test
describe('VersionManager', () => {
  it('snapshotCapability with on_update strategy', async () => {
    const store = mockVersionStore();
    const configMgr = mockConfigManager({ taxonomySnapshotStrategy: 'on_update' });
    const vm = new VersionManager(store, configMgr);
    // update capability → snapshot should be created
  });

  it('recordStatusChange triggers auto-promotion', async () => {
    const store = mockVersionStore();
    const configMgr = mockConfigManager({
      autoPromotionRules: [{
        conditions: [{ metric: 'consecutive_successes', operator: 'gte', value: 5, windowMs: 3600000 }],
        targetStatus: 'stable',
        targetProgram: 'current',
        cooldownMs: 0,
      }],
    });
    const vm = new VersionManager(store, configMgr);
    // record 5 consecutive successes → auto-promotion fires
  });

  it('recordStatusChange with cooldown — skips rule', async () => { /* ... */ });
  it('degradation takes priority over promotion', async () => { /* ... */ });
  it('compareVersions with minSamples — excludes low samples', async () => { /* ... */ });
  it('rollbackCapability restores version snapshot', async () => { /* ... */ });
});
```

### Integration Test Patterns

```typescript
// Example: Conversation API test
describe('POST /api/conversations/:id/send', () => {
  it('returns SendResult with blocks', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/conv-1/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.blocks).toBeDefined();
    expect(body.latencyMs).toBeGreaterThan(0);
  });

  it('returns 409 when slave is busy', async () => { /* ... */ });
  it('returns 503 when circuit is open', async () => { /* ... */ });
});
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Parser porting loses multi-turn correctness | High | Phase 4 gate: canned SSE body tests for all 3 providers before E2E. Fallback parser always succeeds. |
| ChromeGovernor integration breaks Chrome lifecycle | High | Phase 3 gate: Governor.boot + launch + capture tested before ConversationManager. |
| ConversationManager loses old ConversationDriver state | Medium | Phase 3 extracts logic from current conversation-driver.ts, tests with mock Governor. |
| Schema writes fail due to missing tables | Medium | Phase 1 gate: storage contract tests verify CRUD on all ~54 tables. |
| WebSocket subscription model incompatible with frontend | Low | Phase 5 gate: WS tests verify subscribe/unsubscribe/event routing. Frontend integration test. |

---

## Test Coverage Targets

| Phase | Unit | Integration | E2E | Total (est.) |
|-------|------|-------------|-----|-------------|
| Phase 1 | 5 (storage) | 0 | 0 | 5 |
| Phase 2 | 3 (registrar, auditor, config) | 0 | 0 | 8 |
| Phase 3 | 15 (governor + manager + bus + blocks) | 0 | 2 | 25 |
| Phase 4 | 25 (all remaining engines) | 0 | 0 | 50 |
| Phase 5 | 0 | 25 (API + SDK) | 0 | 75 |
| Phase 6 | 0 | 0 | 3 (manual E2E) | 78 |
| **Total** | **48** | **25** | **5** | **~78-120** |

---

## Doc Alignment Checklist

All 25+ verification items are resolved by these merged documents:

- [x] No document references `ChromeProfile`, `RouteBinding`, or deleted table names
- [x] Doc 05 engine signatures match doc 10 API endpoint shapes
- [x] Doc 09 SDK method URLs match doc 10 endpoint table
- [x] Doc 02 and doc 10 agree on streaming scope (batch after capture)
- [x] All `conversation:block` WS references removed
- [x] `conversation:complete` is sole delivery event
- [x] `TraceOrigin` type consistent between Governor and ConversationManager
- [x] `PlanTier` enum matches between schema and resolution engine
- [x] `ChromeSlave` interface matches between Governor and API response
- [x] `ContentBlock` union has all 9 block kinds
- [x] `ProviderAccount` type has correct fields (no chrome_profile_id, no status, no classification, no tags)
- [x] `SlaveState` type matches ChromeGovernor's `ChromeSlave` interface
- [x] `SendResult` type matches ConversationManager's return shape
- [x] SDK method URLs match endpoint table
- [x] CapabilityResolutionEngine added to engine spec
- [x] ConversationManager added to engine spec
- [x] CapabilityEventBus referenced as event infrastructure (replaces delta-pipeline.ts)
- [x] Auto-promotion rules in VersionManager documented
- [x] TelemetryPipelineConfig fully specified with default schedules
- [x] ConfigManager provides unified config persistence
- [x] All lifecycle engines reference ConfigManager for reprogrammability
- [x] HarnessRuntime defined with module contract, DAG format, progress streaming
- [x] Operation classification columns added to capability_taxonomy
- [x] Result rendering contract defined (result_component, result_layout)
- [x] MCP design slot present but not wired

---

## Total New vs Ported vs Deleted Files

| Category | New | Ported | Deleted |
|----------|-----|--------|---------|
| Schema (types, validators) | 16 | 0 | ~5 |
| Storage (contracts + impls) | 22 | 0 | ~12 |
| Engines | 13 | 0 | 0 |
| Seed files (providers + parsers + harness) | 18 | 0 | 0 |
| Server | 5 | 2 | ~3 |
| CLI | 12 | 0 | 0 |
| SDK | 3 | 0 | ~2 |
| Executor (survivors) | 1 | 8 | ~16 |
| Tests | ~25 | ~5 | ~15 |
| Config / Errors | 0 | 2 | ~3 |
| Migrations | 1 | 0 | 42 |
| **Total** | **~116** | **~17** | **~98** |

---

## See also

- `00-merged-index.md` — Reading order for implementing agent
- `02-merged-architecture.md` — Boot sequence
