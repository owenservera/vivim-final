# Surgical Edit Plan — v5 Tracker Consolidation

*Generated: 2026-07-12 | Status: DRAFT — Awaiting Approval*

## Purpose

Document all proposed edits to `docs/atomic-v5/01-tracker.md` before execution. This is a READ-ONLY planning document. No changes will be made until explicitly approved.

---

## 1. Current State

### v5 Tracker (as-is)
- **Total units:** 85
- **Status:** All 85 marked as `[ ]` (pending)
- **Phases:** 17 (Phase 0 + Phases 1-16)
- **Problem:** Does not reflect actual codebase state (61 engines, 34 store contracts exist)

### v3 Tracker (as-is)
- **Total units:** 108
- **Status:** 10 `[x]` (done), rest `[ ]` (pending) or `[!]` (blocked)
- **Problem:** 40 units (Canvas, Memory, Sovereign Data, SDK) are DEFERRED — not in v4/v5
- **Gap:** 26 v3-only units have no equivalent in v4/v5 — need a plan

### v4 Tracker (as-is)
- **Total units:** 71
- **Status:** All 71 marked as `[ ]` (pending)
- **Problem:** 4 units have existing code that needs FIX, not CREATE

### Codebase Reality
- 61 engine files exist in `src/engines/`
- 34 store contracts exist in `src/storage/contracts/`
- 15+ server routes exist
- Event bus has production bugs (no error isolation)
- `executeHarnessPlan()` is a STUB (biggest blocker)

---

## 2. Proposed Edits

### Edit 1: Mark Existing Units as EXISTS (not CREATE)

These v4/v5 units have real code in the codebase. They are not "CREATE from scratch" — they need FIX (complete stubs, wire gaps, verify functionality).

| Unit ID | Unit Title | Current Status | Proposed Status | Existing Code | What's Needed |
|---------|------------|----------------|-----------------|---------------|---------------|
| 2.2 | Harness Real Execution | `[ ]` | `[~]` EXISTS | `harness-runtime.ts` has STUB | Implement `executeHarnessPlan()` |
| 2.6 | Parser Extract | `[ ]` | `[~]` EXISTS | `stream-parser.ts` exists | Verify SSE→ContentBlock |
| 2.7 | Store + Emit | `[ ]` | `[~]` EXISTS | `conversation-manager.ts` exists | Verify store + emit flow |
| 3.6 | Selector Healing | `[ ]` | `[~]` EXISTS | `selector-healer.ts` exists | Auto-detect + repair |
| 4.5 | Health Monitoring | `[ ]` | `[~]` EXISTS | `provider-health.ts` exists | 6-signal weighted scoring |
| 1.1 | Wire CDP Transport | `[ ]` | `[~]` EXISTS | `ChromeGovernor` exists | Wire `setCdpTransport()` |
| 1.2 | Seed Pipeline | `[ ]` | `[~]` EXISTS | Seeds in `seeds/providers/` | Verify loading at boot |
| 1.4 | Visible Chrome Launch | `[ ]` | `[~]` EXISTS | `FleetSupervisor` exists | Launch with correct profile |
| 1.6 | Complete Persist | `[ ]` | `[~]` EXISTS | `ProviderStore` exists | Persist account + profile |
| 1.7 | Headless Profile Reuse | `[ ]` | `[~]` EXISTS | `FleetSupervisor` exists | Reuse saved profile |
| 2.1 | SlaveId Derivation | `[ ]` | `[~]` EXISTS | `FleetSupervisor` has naming | Fix mismatch |
| 3.1 | State Persistence | `[ ]` | `[~]` EXISTS | `conversation-manager.ts` exists | Verify cross-turn persistence |
| 3.3 | Streaming WS | `[ ]` | `[~]` EXISTS | WebSocket exists in server | Progressive block delivery |
| 3.5 | Error Recovery | `[ ]` | `[~]` EXISTS | `FleetSupervisor` has circuit breaker | Mid-conversation recovery |

**Rationale:** These units have real implementations. Marking them as EXISTS reduces the perceived work and focuses effort on FIX rather than CREATE.

---

### Edit 2: Add Discovered Gaps as New Units

6 gaps discovered during cross-version analysis. These are NEW units not in the current v5 tracker.

| Gap ID | Unit ID | Unit Title | Phase | Effort | Dependencies | Rationale |
|--------|---------|------------|-------|--------|--------------|-----------|
| GAP-001 | 0.0 | CapabilityEventBus Upgrade | 0 | M (8h) | None | Blocks kernel + all engines. No error isolation, no envelopes, no wildcards. |
| GAP-002 | 0.5 | Prisma Schema Migration | 0 | S (2h) | None | 4 new tables: kernel_spans, kernel_provenance, kernel_topology, kernel_events |
| GAP-003 | 0.6a | Server Bootstrap Refactor | 0 | S (4h) | GAP-001, GAP-002 | Refactor `createServerWithEngines()` to create Kernel first |
| GAP-004 | 0.7 | Test Infrastructure Consolidation | 0 | M (8h) | Kernel Core | Shared mocks, test helpers, coverage targets |
| GAP-005 | 16.5 | MCP Server Kernel Integration | 16 | S (4h) | Kernel Oracle | Register kernel tools in `DiscoveryMcpServer` |
| GAP-006 | 16.6 | CLI Kernel Commands | 16 | S (4h) | Kernel Oracle | `bun run kernel status/diagnose/trace` |

**Note:** GAP-003 overlaps with existing unit 0.6 (KernelBootstrap). Proposed split:
- 0.6a = Server Bootstrap Refactor (GAP-003)
- 0.6 = KernelBootstrap (existing — register Kernel in bootstrap sequence)

---

### Edit 3: Archive v3 Tracker

**Action:** Add banner to top of `docs/atomic-v3/01-tracker.md`:

```
> ⚠️ SUPERSEDED BY v5
> 
> This tracker is archived. v5 (`docs/atomic-v5/01-tracker.md`) is the canonical plan.
> v3 units 1.1-1.9 are DONE. All other v3 units are either:
> - DEFERRED (Canvas, Workspace, Memory, Sovereign Data, SDK) — not in v4/v5
> - SUPERSEDED by v4/v5 units (see cross-version gap analysis)
> 
> Reference only. Do not implement from this tracker.
```

**Rationale:** Prevents confusion. 40 deferred units are intentionally out of scope. 26 v3-only units are NOT in v5 and need a plan.

---

### Edit 4: Update v5 Tracker Metadata

Add header to `docs/atomic-v5/01-tracker.md`:

```markdown
> **CANONICAL PLAN** — v5 is the single source of truth.
> v3 is archived (superseded). v4 specs are referenced for Phases 1-14.
> 
> **Codebase Reality:** 61 engines, 34 store contracts, 15+ routes exist.
> Units marked [~] EXISTS have real code that needs FIX, not CREATE.
> Units marked [ ] CREATE need new implementation.
```

---

### Edit 5: Add Phase 0 Pre-Phase (Event Bus Upgrade)

Current Phase 0 has units 0.1-0.6. Proposed addition:

```
## Phase 0: Kernel Core (PRE-PHASE: Event Bus)

### 0.0 CapabilityEventBus Upgrade [ ]
- [ ] Per-handler error isolation via `Promise.resolve().then().catch()`
- [ ] Event envelope: `{ event, metadata: { eventId, correlationId, causationId, source } }`
- [ ] Async handler support: `void | Promise<void>`
- [ ] Wildcard subscriptions: `on('capability:*', handler)`
- [ ] Circular ring buffer (O(1) push/pop) + DB overflow
- [ ] Snapshot dispatch (copy before iterate)
- [ ] Dead letter queue for failed events
- [ ] `publishAndWait()` for test synchronization
- **Effort:** M (8h)
- **Dependencies:** None
- **Blocks:** 0.1-0.6 (all kernel units)
- **Spec:** `docs/research/event-bus-sota-2026.md`
```

---

## 3. Unit Count Changes

### Before Surgical Edit
| Plan | Units | Status |
|------|-------|--------|
| v3 | 108 | 9 DONE, rest pending/archived |
| v4 | 71 | All pending |
| v5 | 85 | All pending |
| **Total** | **264** | — |

### After Surgical Edit
| Plan | Units | Status |
|------|-------|--------|
| v3 | 108 | ARCHIVED (banner added) |
| v4 | 71 | REFERENCE ONLY (v5 is canonical) |
| v5 | 91 | 14 EXISTS, 77 CREATE (was 85, +6 gaps) |

**Net change to v5:** +6 units (85 → 91)
- Added: 0.0, 0.5, 0.6a, 0.7, 16.5, 16.6
- Existing 0.6 renamed to 0.6b (or kept as 0.6 with 0.6a as pre-step)

---

## 4. Phase Structure After Edit

```
Phase 0: Kernel Core (21 units — was 6, now 15 with pre-phase)
  0.0  CapabilityEventBus Upgrade [ ]         ← NEW (GAP-001)
  0.1  KernelRegistry [ ]                     ← CREATE
  0.2  KernelContext [ ]                      ← CREATE
  0.3  KernelTracer [ ]                       ← CREATE
  0.4  KernelProvenance [ ]                   ← CREATE
  0.5  Prisma Schema Migration [ ]            ← NEW (GAP-002)
  0.6  KernelBootstrap [ ]                    ← CREATE
  0.6a Server Bootstrap Refactor [ ]          ← NEW (GAP-003)
  0.7  Test Infrastructure Consolidation [ ]  ← NEW (GAP-004)

Phase 1: E2E Bootstrap (7 units — 5 EXISTS, 2 CREATE)
  1.1  Wire CDP Transport [~] EXISTS          ← EDIT
  1.2  Seed Pipeline [~] EXISTS               ← EDIT
  1.3  Setup Wizard [ ]                       ← CREATE
  1.4  Visible Chrome Launch [~] EXISTS       ← EDIT
  1.5  Login Verification [ ]                 ← CREATE
  1.6  Complete Persist [~] EXISTS            ← EDIT
  1.7  Headless Profile Reuse [~] EXISTS      ← EDIT

Phase 2: Single-Turn (8 units — 5 EXISTS, 3 CREATE)
  2.1  SlaveId Derivation [~] EXISTS          ← EDIT
  2.2  Harness Real Execution [~] EXISTS      ← EDIT (STUB)
  2.3  Composer Typing [ ]                    ← CREATE
  2.4  Submit Action [ ]                      ← CREATE
  2.5  Network Capture [ ]                    ← CREATE
  2.6  Parser Extract [~] EXISTS              ← EDIT
  2.7  Store + Emit [~] EXISTS                ← EDIT
  2.8  Frontend Render [ ]                    ← CREATE

Phase 3: Multi-Turn (6 units — 4 EXISTS, 2 CREATE)
  3.1  State Persistence [~] EXISTS           ← EDIT
  3.2  DOM Recovery [ ]                       ← CREATE
  3.3  Streaming WS [~] EXISTS                ← EDIT
  3.4  Frontend Streaming [ ]                 ← CREATE
  3.5  Error Recovery [~] EXISTS              ← EDIT
  3.6  Selector Healing [~] EXISTS            ← EDIT

Phase 4: Three-Provider (5 units — 1 EXISTS, 4 CREATE)
  4.1  ChatGPT E2E [ ]                        ← CREATE
  4.2  Claude E2E [ ]                         ← CREATE
  4.3  Gemini E2E [ ]                         ← CREATE
  4.4  Provider Switching [ ]                 ← CREATE
  4.5  Health Monitoring [~] EXISTS           ← EDIT

Phase 5: Frontend Perf (6 units — all CREATE)
Phase 6: Platform (6 units — all CREATE)
Phase 7: Reliability (7 units — all CREATE)
Phase 8: Resource Mgmt (3 units — all CREATE)
Phase 9: Observability (5 units — all CREATE)
Phase 10: Frontend Resilience (3 units — all CREATE)
Phase 11: Stealth Core (4 units — all CREATE)
Phase 12: Fingerprint (4 units — all CREATE)
Phase 13: Human Sim (3 units — all CREATE)
Phase 14: Profile/Trace (4 units — all CREATE)
Phase 15: Kernel Oracle (4 units — all CREATE)
Phase 16: Kernel Surfaces (6 units — 4 CREATE + 2 NEW from gaps)
  16.1  REST API [ ]                          ← CREATE
  16.2  MCP Tools [ ]                         ← CREATE
  16.3  CLI [ ]                               ← CREATE
  16.4  Frontend [ ]                          ← CREATE
  16.5  MCP Server Integration [ ]            ← NEW (GAP-005)
  16.6  CLI Kernel Commands [ ]               ← NEW (GAP-006)
```

---

## 5. Summary of All Edits

| Edit | Type | Target | Description |
|------|------|--------|-------------|
| 1 | MODIFY | 14 units in v5 | Change status from `[ ]` to `[~]` EXISTS |
| 2 | ADD | 6 new units | GAP-001 through GAP-006 |
| 3 | ADD BANNER | v3 tracker | Mark as ARCHIVED/SUPERSEDED |
| 4 | ADD HEADER | v5 tracker | Mark as CANONICAL |
| 5 | ADD PHASE | Phase 0 | Pre-phase for Event Bus Upgrade |

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| EXISTS marking may be inaccurate | Units marked EXISTS might have hidden issues | Each unit has "What's Needed" column specifying exact work |
| 6 new units increase scope | v5 grows from 85 to 91 units | All 6 are small (S/M effort) and high-priority |
| v3 archival may lose context | Some v3 units have useful specs | Archive with "Reference only" note, keep files intact |
| Phase 0 pre-phase adds dependency | Event Bus blocks all kernel work | This is accurate — event bus IS the foundation |

---

## 7. Approval Checklist

- [ ] Review Edit 1: 14 units marked EXISTS (are these accurate?)
- [ ] Review Edit 2: 6 new units added (GAP-001 through GAP-006)
- [ ] Review Edit 3: v3 tracker archival banner
- [ ] Review Edit 4: v5 tracker canonical header
- [ ] Review Edit 5: Phase 0 pre-phase (Event Bus Upgrade)
- [ ] Confirm unit count: 85 → 91 (+6)
- [ ] Confirm phase structure is correct
- [ ] Approve for execution

---

## 8. Execution Plan

After approval:

1. **Edit `docs/atomic-v5/01-tracker.md`:**
   - Add canonical header (Edit 4)
   - Add Phase 0 pre-phase (Edit 5)
   - Mark 14 units as EXISTS (Edit 1)
   - Add 6 new units (Edit 2)

2. **Edit `docs/atomic-v3/01-tracker.md`:**
   - Add archival banner (Edit 3)

3. **Update `devops/select.ts`:**
   - Point at `docs/atomic-v5` (if not already)

4. **Verify:**
   - Run `bun run devops select` to confirm v5 is canonical
   - Run `bun run devops roadmap --discover` to check for new gaps

---

*End of Surgical Edit Plan — Awaiting Approval*
