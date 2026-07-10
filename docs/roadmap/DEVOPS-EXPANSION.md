# DevOps Expansion Plan

**Status:** DESIGN — ready for implementation
**Date:** 2026-07-10
**Purpose:** Extend existing devops/ with gate-specific verification, risk tracking, drift detection, environment management, release pipeline, and observability

---

## Current State (12 files)

```
devops/
  index.ts        — CLI entry (select|mark|gate|fmt|audit|gc|report)
  gate.ts         — Generic quality gate (typecheck + lint + tests)
  tracker.ts      — Unit state tracking (parse/update markdown)
  select.ts       — Next unit selection (dependency-aware)
  mark.ts         — State transitions in tracker
  report.ts       — Progress summary
  audit.ts        — Gate audit logging to PROGRESS.md
  deps.ts         — Dependency extraction from atomic markdown
  changed.ts      — Git changed files detection
  gc.ts           — Git garbage collection (daily)
  fmt.ts          — Scoped formatter (changed files only)
```

---

## Expansion: 6 New Modules

### 1. Gate-Specific Verification (`devops/gate-verify.ts`)

**Purpose:** Check that each gate's specific criteria pass, not just generic typecheck+lint+test.

**New CLI commands:**
```bash
bun run devops gate-verify <gate-id>     # Run gate-specific checks
bun run devops gate-verify --all         # Run all gate checks
bun run devops gate-verify --status      # Show gate status summary
```

**Gate verify scripts (per gate):**

| Gate | Script | What It Checks |
|------|--------|----------------|
| 1a: CDP Client | `devops/gates/cdp-client.ts` | connect(), send(), reconnect, timeout |
| 2a: Chrome Launcher | `devops/gates/chrome-launcher.ts` | detectChromePath(), launchChrome(), isRunning() |
| 3a: Profile Allocator | `devops/gates/profile-allocator.ts` | allocateProfile(), getProfile(), deleteProfile() |
| 3b: Port Reaper | `devops/gates/port-reaper.ts` | reapOrphans(), isPortInUse() |
| 2b: Fleet Supervisor | `devops/gates/fleet-supervisor.ts` | spawnSlave(), probeHealth(), circuit breaker |
| 4: Chrome Process Mgmt | `devops/gates/chrome-governor.ts` | Governor.spawn(), kill(), ensureRunning() |
| 5: Conversation Pipeline | `devops/gates/conversation-pipeline.ts` | Manager.send() end-to-end |
| 6: API Layer | `devops/gates/api-layer.ts` | HTTP endpoints, WebSocket streaming |
| 7: CLI | `devops/gates/cli.ts` | CLI commands work |
| 8: Frontend | `devops/gates/frontend.ts` | Tauri builds, frontend renders |
| 9: Integration | `devops/gates/integration.ts` | E2E tests pass with real Chrome |

**Each gate script returns:**
```typescript
interface GateVerifyResult {
  gate: string
  pass: boolean
  criteria: { name: string; pass: boolean; detail: string }[]
  durationMs: number
  timestamp: string
}
```

**Storage:** Results saved to `devops/gate-results/{gate-id}-{timestamp}.json`

---

### 2. Risk & Drift Tracking (`devops/risk.ts`)

**Purpose:** Track risks, detect drift, alert before things break.

**New CLI commands:**
```bash
bun run devops risk scan              # Scan for risks
bun run devops risk status            # Show risk summary
bun run devops risk add <type> <msg>  # Manually add risk
bun run devops drift check            # Check for drift
bun run devops drift status           # Show drift summary
```

**Risk types:**
| Type | Detection | Severity |
|------|-----------|----------|
| `gate_regression` | Gate that was passing now fails | HIGH |
| `dependency_stale` | Dependency changed, dependent not updated | MEDIUM |
| `test_coverage_drop` | Coverage decreased after change | MEDIUM |
| `lint_debt_increase` | New lint issues in changed files | LOW |
| `performance_regression` | Gate takes longer than baseline | LOW |
| `interface_change` | Exported interface changed, consumers not updated | HIGH |

**Drift detection:**
- Compare current gate results with last passing results
- Detect when code changes affect files that other gates depend on
- Alert when exported interfaces change

**Storage:** `devops/risk-state.json` — tracked risks and drift

---

### 3. Environment Management (`devops/env.ts`)

**Purpose:** Manage test environments — DB setup, Chrome profiles, port allocation.

**New CLI commands:**
```bash
bun run devops env setup              # Set up test environment
bun run devops env teardown           # Clean up test environment
bun run devops env status             # Show environment status
bun run devops env ports              # Show port allocation
bun run devops env profiles           # Show Chrome profiles
bun run devops env cleanup            # Kill orphaned processes, clean temp files
```

**What it manages:**
| Resource | Setup | Cleanup |
|----------|-------|---------|
| Test database | `bunx prisma migrate dev` | Reset to clean state |
| Chrome profiles | Create `data/chrome-profiles/` | Delete temp profiles |
| Ports | Scan for available | Kill orphaned processes |
| Temp files | Create `tmp/` | Delete old temp files |

**Environment states:**
- `clean` — fresh, no test data
- `seeded` — provider data loaded
- `active` — Chrome processes running
- `dirty` — needs cleanup

---

### 4. Release Pipeline (`devops/release.ts`)

**Purpose:** Version management, changelog generation, build verification, distribution.

**New CLI commands:**
```bash
bun run devops release version <bump>  # Bump version (major|minor|patch)
bun run devops release changelog       # Generate changelog from git log
bun run devops release build           # Verify build passes
bun run devops release check           # Pre-release checklist
bun run devops release publish         # Full release flow
```

**Version strategy:**
- Follow semver
- Auto-bump based on commit types (feat: minor, fix: patch, breaking: major)
- Update package.json version

**Changelog generation:**
- Parse git log for conventional commits
- Group by type (feat, fix, refactor, etc.)
- Link to commits

**Pre-release checklist:**
- [ ] All gates pass
- [ ] No blocked units
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Build passes
- [ ] Version bumped
- [ ] Changelog updated

---

### 5. Observability (`devops/observe.ts`)

**Purpose:** Metrics, build times, failure rates, bottleneck detection.

**New CLI commands:**
```bash
bun run devops observe metrics        # Show build metrics
bun run devops observe gates          # Show gate pass/fail rates
bun run devops observe timeline       # Show build timeline
bun run devops observe bottlenecks    # Show bottleneck analysis
bun run devops observe export         # Export metrics as JSON
```

**Metrics tracked:**
| Metric | Source | Storage |
|--------|--------|---------|
| Gate pass/fail | gate-verify results | `devops/metrics/gates.json` |
| Build duration | timing from gate runs | `devops/metrics/timing.json` |
| Test coverage | bun test --coverage | `devops/metrics/coverage.json` |
| Lint issues | biome output | `devops/metrics/lint.json` |
| Unit completion | tracker stats | `devops/metrics/progress.json` |

**Bottleneck detection:**
- Which gate takes longest?
- Which gate fails most often?
- Which units are blocked longest?
- What's the critical path delay?

---

### 6. Dependency Graph (`devops/graph.ts`)

**Purpose:** Visualize dependency graph, show critical path, detect cycles.

**New CLI commands:**
```bash
bun run devops graph show             # Show dependency graph (ASCII)
bun run devops graph critical         # Show critical path
bun run devops graph cycles           # Detect cycles
bun run devops graph export           # Export as Mermaid diagram
```

**ASCII graph output:**
```
GATE 0 (Storage) ✓
  ├─→ GATE 1a (CDP Client) [ ]
  │     └─→ GATE 2b (Fleet Supervisor) [ ]
  │           └─→ GATE 4 (Chrome Process Mgmt) [ ]
  │                 └─→ GATE 5 (Conversation Pipeline) [ ]
  │                       └─→ GATE 6 (API Layer) [ ]
  │                             ├─→ GATE 7 (CLI) [ ]
  │                             └─→ GATE 8 (Frontend) [ ]
  └─→ GATE 2a (Chrome Launcher) [ ]
        ├─→ GATE 3a (Profile Allocator) [ ]
        └─→ GATE 3b (Port Reaper) [ ]
```

**Critical path:** Highlight longest dependency chain

---

## Updated CLI

```bash
bun run devops <command>

  # Existing
  select              # Next unit
  mark <id> <state>   # Update state
  gate                # Quality gate
  fmt                 # Format changed files
  audit <id> <notes>  # Log audit
  gc                  # Git garbage collection
  report              # Progress summary

  # New: Gate Verification
  gate-verify <gate>  # Run gate-specific checks
  gate-verify --all   # Run all gate checks
  gate-verify --status # Gate status summary

  # New: Risk & Drift
  risk scan           # Scan for risks
  risk status         # Risk summary
  drift check         # Check for drift
  drift status        # Drift summary

  # New: Environment
  env setup           # Set up test environment
  env teardown        # Clean up
  env status          # Environment status
  env cleanup         # Kill orphans, clean temp

  # New: Release
  release version <bump> # Bump version
  release changelog      # Generate changelog
  release build          # Verify build
  release check          # Pre-release checklist
  release publish        # Full release flow

  # New: Observability
  observe metrics    # Build metrics
  observe gates      # Gate pass/fail rates
  observe timeline   # Build timeline
  observe bottlenecks # Bottleneck analysis

  # New: Dependency Graph
  graph show         # ASCII dependency graph
  graph critical     # Critical path
  graph cycles       # Detect cycles
  graph export       # Mermaid diagram
```

---

## File Structure (After Expansion)

```
devops/
  index.ts              — CLI entry (updated)
  gate.ts               — Generic quality gate (existing)
  gate-verify.ts        — Gate-specific verification (NEW)
  tracker.ts            — Unit state tracking (existing)
  select.ts             — Next unit selection (existing)
  mark.ts               — State transitions (existing)
  report.ts             — Progress summary (existing)
  audit.ts              — Gate audit logging (existing)
  deps.ts               — Dependency extraction (existing)
  changed.ts            — Git changed files (existing)
  gc.ts                 — Git garbage collection (existing)
  fmt.ts                — Scoped formatter (existing)
  risk.ts               — Risk & drift tracking (NEW)
  env.ts                — Environment management (NEW)
  release.ts            — Release pipeline (NEW)
  observe.ts            — Observability (NEW)
  graph.ts              — Dependency graph (NEW)
  gates/                — Gate-specific verify scripts (NEW)
    cdp-client.ts
    chrome-launcher.ts
    profile-allocator.ts
    port-reaper.ts
    fleet-supervisor.ts
    chrome-governor.ts
    conversation-pipeline.ts
    api-layer.ts
    cli.ts
    frontend.ts
    integration.ts
  metrics/              — Observability data (NEW)
    gates.json
    timing.json
    coverage.json
    lint.json
    progress.json
  gate-results/         — Gate verify results (NEW)
    {gate-id}-{timestamp}.json
```

---

## Implementation Order

| # | Module | Effort | Dependencies |
|---|--------|--------|--------------|
| 1 | `gate-verify.ts` + `gates/` scripts | M | None |
| 2 | `graph.ts` | S | deps.ts |
| 3 | `risk.ts` | M | gate-verify.ts |
| 4 | `env.ts` | M | None |
| 5 | `observe.ts` | M | gate-verify.ts |
| 6 | `release.ts` | S | gate-verify.ts, observe.ts |

**Parallel:** 1 and 4 can run in parallel
**Sequential:** 3 depends on 1, 5 depends on 1, 6 depends on 1+5

---

## Integration with Existing System

**How new modules connect to existing:**

| Existing | New Connection |
|----------|---------------|
| `gate.ts` | `gate-verify.ts` calls `runGate()` first, then gate-specific checks |
| `tracker.ts` | `risk.ts` reads tracker for blocked units, `observe.ts` reads for progress |
| `select.ts` | `graph.ts` uses dependency data from `deps.ts` |
| `report.ts` | `observe.ts` extends report with metrics |
| `audit.ts` | `release.ts` uses audit trail for changelog |
| `changed.ts` | `risk.ts` uses changed files for drift detection |
| `lefthook.yml` | Add `gate-verify` to pre-push hook |

**Updated lefthook.yml:**
```yaml
pre-push:
  commands:
    gate:
      run: bun run devops gate --strict
    gate-verify:
      run: bun run devops gate-verify --status
```

---

## Context Preservation

When resuming work, read these anchors:

| Anchor | File | Lines | Purpose |
|--------|------|-------|---------|
| Gate system | devops/gate.ts | 1-95 | Generic gate logic |
| Tracker | devops/tracker.ts | 1-128 | State machine |
| Select | devops/select.ts | 1-80 | Dependency-aware selection |
| Deps | devops/deps.ts | 1-66 | Dependency extraction |
| New: Gate verify | devops/gate-verify.ts | — | Gate-specific checks |
| New: Risk | devops/risk.ts | — | Risk tracking |
| New: Env | devops/env.ts | — | Environment management |
| New: Observe | devops/observe.ts | — | Observability |
| New: Graph | devops/graph.ts | — | Dependency graph |
| New: Release | devops/release.ts | — | Release pipeline |
