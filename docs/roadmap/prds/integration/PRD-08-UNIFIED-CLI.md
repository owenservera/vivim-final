# PRD-08: Unified CLI Surface

**Phase:** 8 of 10
**Agent Assignment:** Agent A (Batch 4 — parallel with PRD-09, PRD-10)
**Depends On:** PRD-05 (Tracker Unification), PRD-06 (Skill Refactoring), PRD-07 (Converge+Audit)
**Blocks:** None (final implementation phase)

---

## 1. Context

After Phases 1-7, the bridge infrastructure exists: `speckit-bridge.ts`, `unified-gate.ts`, `research-bridge.ts`, `tracker-speckit-sync.ts`, `speckit-converge-bridge.ts`. But they're only accessible via internal module imports. This phase creates a CLI surface so agents can invoke SpecKit-DevOps integration via commands.

## 2. User Stories

### US1 — SpecKit Subcommand Tree (P1)
**As an** agent working in the DevOps CLI,
**I want** a `bun run devops speckit <subcommand>` namespace,
**So that** I can access all integration features from one place.

**Acceptance Scenarios:**
1. When I run `bun run devops speckit status`, then I see both SpecKit feature state and DevOps tracker state.
2. When I run `bun run devops speckit sync`, then tasks and tracker are synchronized.
3. When I run `bun run devops speckit validate`, then consistency is checked.
4. When I run `bun run devops speckit gate --feature=specs/007`, then the unified gate runs.
5. When I run `bun run devops speckit converge --feature=specs/007`, then the unified converge runs.

### US2 — Status Dashboard (P1)
**As an** agent starting a work session,
**I want** a single command that shows the state of both systems,
**So that** I know where I am without running multiple commands.

**Acceptance Scenarios:**
1. When I run `bun run devops speckit status`, then I see:
   - Active SpecKit feature (from `.specify/feature.json`)
   - SpecKit artifact status (spec.md ✓, plan.md ✓, tasks.md ✓, checklists ✓)
   - DevOps tracker summary (done/total, blocked, next unit)
   - Bridge sync status (last sync time, orphan count)
2. When output is `--json`, then structured JSON is returned.

### US3 — Bridge Commands (P1)
**As an** agent managing the integration,
**I want** explicit sync and validate commands,
**So that** I can maintain consistency between systems.

**Acceptance Scenarios:**
1. `bun run devops speckit sync --feature=specs/007` syncs tasks↔tracker bidirectionally.
2. `bun run devops speckit validate` checks consistency and reports orphans/mismatches.
3. `bun run devops speckit bridge` runs full sync + validate in one pass.

## 3. Functional Requirements

- **FR-001**: System MUST provide `bun run devops speckit status [--json]`.
- **FR-002**: System MUST provide `bun run devops speckit sync [--feature=<dir>]`.
- **FR-003**: System MUST provide `bun run devops speckit validate [--quick]`.
- **FR-004**: System MUST provide `bun run devops speckit gate [--feature=<dir>] [--scope=unit|phase|feature|full] [--speckit] [--devops]`.
- **FR-005**: System MUST provide `bun run devops speckit converge --feature=<dir>`.
- **FR-006**: System MUST provide `bun run devops speckit bridge [--feature=<dir>]` (sync + validate).
- **FR-007**: All commands MUST return structured JSON when `--json` is passed.
- **FR-008**: `status` MUST read from `.specify/feature.json` for active feature.
- **FR-009**: `status` MUST read from tracker for DevOps state.
- **FR-010**: All commands MUST delegate to existing bridge modules (no new logic).

## 4. Key Entities

No new entities — this phase is a CLI surface over existing modules.

## 5. Technical Design

### 5.1 Command Tree

```
bun run devops speckit
  ├── status [--json]                          → read feature.json + tracker + bridge state
  ├── sync [--feature=<dir>] [--direction=both|tasks-to-tracker|tracker-to-tasks]
  ├── validate [--quick]                       → consistency check
  ├── gate [--feature=<dir>] [--scope=X] [--speckit] [--devops] [--json]
  ├── converge --feature=<dir> [--json]        → unified converge
  └── bridge [--feature=<dir>]                 → sync + validate
```

### 5.2 Module Structure

```
devops/
  speckit-cli.ts          # CLI command implementations (new)
  speckit-cli.test.ts     # tests (new)
```

### 5.3 Status Command Implementation

```typescript
async function speckitStatus(args: { json?: boolean }) {
  const featureJson = readFeatureJson()  // from .specify/feature.json
  const featureDir = featureJson?.feature_directory
  const specArtifacts = featureDir ? checkSpecKitArtifacts(featureDir) : null
  const trackerState = readTrackerState()  // from devops/select
  const bridgeState = readBridgeState()  // from speckit-bridge

  const status = {
    activeFeature: featureDir,
    specKit: specArtifacts,
    tracker: trackerState,
    bridge: bridgeState,
  }

  if (args.json) {
    console.log(JSON.stringify(status, null, 2))
  } else {
    printStatusTable(status)
  }
}
```

### 5.4 Integration with `devops/index.ts`

Add to the existing CLI wiring:
```typescript
// In devops/index.ts
.command('speckit', 'SpecKit integration commands')
.command('speckit status', 'Show SpecKit + DevOps state')
.command('speckit sync', 'Sync tasks ↔ tracker')
.command('speckit validate', 'Check consistency')
.command('speckit gate', 'Run unified gate')
.command('speckit converge', 'Run unified converge')
.command('speckit bridge', 'Sync + validate')
```

### 5.5 Error Handling

- If `.specify/feature.json` doesn't exist: status shows "No active feature"
- If tasks.md doesn't exist: sync/converge error with "run `/speckit.tasks`"
- If tracker doesn't exist: sync error with "tracker not found"
- If bridge modules aren't available: error with "integration not initialized"

## 6. Constitution Check

- [ ] CLI commands are thin shells — they delegate to bridge modules.
- [ ] No business logic in CLI layer.
- [ ] TypeScript strict, no `any`.

## 7. Testing Requirements

### Unit Tests (`tests/unit/engines/speckit-cli.test.ts`)
- Test `status` reads feature.json correctly
- Test `status` handles no active feature
- Test `sync` delegates to tracker-speckit-sync
- Test `validate` delegates to speckit-bridge
- Test `gate` delegates to unified-gate
- Test `converge` delegates to speckit-converge-bridge
- Test `bridge` runs sync + validate
- Test `--json` output format
- Test error handling for missing artifacts

### Mock Strategy
- Mock all bridge modules (test CLI wiring, not bridge logic)

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/speckit-cli.ts` | CREATE | CLI implementations |
| `tests/unit/engines/speckit-cli.test.ts` | CREATE | Unit tests |
| `devops/index.ts` | MODIFY | Add `speckit` subcommand tree |

## 9. Success Criteria

- [ ] `bun run devops speckit status` shows both system states
- [ ] `bun run devops speckit sync` synchronizes tasks↔tracker
- [ ] `bun run devops speckit validate` reports consistency
- [ ] `bun run devops speckit gate` runs unified gate
- [ ] `bun run devops speckit converge` runs unified converge
- [ ] `bun run devops speckit bridge` runs sync + validate
- [ ] All commands support `--json` output
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/engines/speckit-cli.test.ts` passes

## 10. Parallelization Notes

**Depends on:** PRD-05 (tracker-sync), PRD-06 (refactored skills), PRD-07 (converge bridge).
**Blocks:** None — this is the final integration surface.
**Can start with:** Interface + CLI wiring + mocked tests. Fill in real delegations as bridge modules land.
