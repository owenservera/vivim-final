# Unit 6.1-6.3: Ship — Doc Alignment, E2E Tests, Performance Gates

**Phase:** 6 | **Files:** E2E tests, perf checks
**Depends:** Phase 1-5 complete | **Produces:** Production-ready system

## 6.1: Doc Alignment Checklist
Verify all 25+ items from `08-merged-implementation.md` §Doc Alignment:
- [ ] No deleted table names referenced (ChromeProfile, RouteBinding, etc.)
- [ ] Engine signatures match API endpoint shapes
- [ ] SDK method URLs match endpoint table
- [ ] Streaming scope consistent (v1: batch-only, conversation:complete only)
- [ ] CapabilityResolutionEngine added to engine spec
- [ ] ConversationManager added to engine spec
- [ ] CapabilityEventBus referenced as event infrastructure
- [ ] Auto-promotion rules in VersionManager documented
- [ ] TelemetryPipelineConfig fully specified with default schedules
- [ ] ConfigManager provides unified config persistence
- [ ] All lifecycle engines reference ConfigManager for reprogrammability
- [ ] HarnessRuntime defined with module contract, DAG format, progress streaming
- [ ] Operation classification columns added to capability_taxonomy
- [ ] Result rendering contract defined (result_component, result_layout)
- [ ] MCP design slot present but not wired (v1)
- [ ] No forward references — each doc only references earlier docs

## 6.2: E2E Tests
### Manual E2E Scenarios
- [ ] Multi-turn send/receive for Claude (3 turns)
- [ ] Multi-turn send/receive for ChatGPT (3 turns)
- [ ] Multi-turn send/receive for Gemini (3 turns)
- [ ] Concurrent sends to different providers (Claude + ChatGPT simultaneously)
- [ ] Config change at runtime takes effect without restart
- [ ] Kill Chrome → Governor auto-restarts → conversation continues

### Automated E2E (`tests/e2e/`)
- [ ] `claude-send.test.ts` — Send message, verify response blocks
- [ ] `chatgpt-send.test.ts` — Send message, verify response blocks
- [ ] `multi-turn.test.ts` — 3-turn conversation across providers

## 6.3: Performance Gates
| Operation | Target |
|-----------|--------|
| Resolution (RESOLVE step) | <5ms |
| Conversation create | <50ms |
| Store blocks (100 blocks) | <20ms |
| Provider seed (7 providers) | <5s |
| Governor.boot() | <2s |
| Health aggregate (1 provider) | <100ms |
| Server startup (full boot) | <5s |

### Resource Limits
- SQLite WAL file <100MB
- In-memory cache (ExecutionMemoizer) <500 entries
- Circuit breaker reset <60s
- Health probe interval 30s

## Exit Criteria
- [ ] `bunx tsc --noEmit` → zero errors
- [ ] `bun test` → all pass (target: ~120 tests)
- [ ] Multi-turn send/receive works for Claude, ChatGPT, Gemini
- [ ] Concurrent sends to different providers work
- [ ] `ProviderRegistrar.seedAll()` populates 7 providers
- [ ] `ChromeGovernor.boot()` spawns Chrome
- [ ] `ConversationManager.send()` completes 8-step pipeline
- [ ] `CapabilityResolutionEngine.resolve()` returns correct UI contracts
- [ ] `CapabilityEventBus` delivers typed events to subscribers
- [ ] `ProviderHealthKernel` produces valid health reports
- [ ] All lifecycle engines are reprogrammable
- [ ] Config changes audited in config_audit
- [ ] SDK client methods cover all REST endpoints
- [ ] CLI commands work for all subsystem bridges

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- Manual E2E verified for 3 providers
