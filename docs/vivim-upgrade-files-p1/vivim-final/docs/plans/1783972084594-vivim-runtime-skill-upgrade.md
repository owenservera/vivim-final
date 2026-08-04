# vivim-runtime Skill Upgrade Plan

## Objective
Transform vivim-runtime from documentation-only to a fully self-sufficient autonomous development orchestration skill that can:
1. Launch and manage backend/frontend/provider processes
2. Run non-stop autoloops for development tasks
3. Integrate with devops, source-audit, and devops-research skills
4. Stop/restart the full stack as needed
5. Perform debugging and best-practice audits

## Current State Gap Analysis

| Component | Status | Location |
|-----------|--------|----------|
| Runtime loop meta-cmd (6.1) | Pending | `scripts/devops/runtime-test/index.ts` missing |
| SKILL.md capstone (6.2) | Pending | `.opencode/skill/vivim-runtime/SKILL.md` missing |
| Frontend data flow wire (5.1) | Done | `src/engines/config-universal-surface.ts` exists |
| Detached supervisor (2.1) | Done | Exists per tracker (but need to verify) |
| Pre-flight (2.3) | Done | Exists per tracker (but need to verify) |

## Implementation Plan

### Phase A: Core Runtime Infrastructure (scripts/devops/runtime-test/)

1. **Create `scripts/devops/runtime-test/index.ts`** - Main entry point with CLI
   - Parse subcommands: bootstrap, preflight, engage, discover-*, test, ui-gate, debug, build, runtime
   - Wire all subordinate commands

2. **Create `scripts/devops/runtime-test/supervisor.ts`** - Process orchestration
   - Spawn/detach backend (`bun run serve`) and frontend
   - Health polling against ports
   - Clean stop/restart with PID management

3. **Create `scripts/devops/runtime-test/preflight.ts`** - Health check
   - DB connection + WAL mode verification
   - Server health endpoint check
   - Provider slave registration check

4. **Create `scripts/devops/runtime-test/engage.ts`** - Browser automation
   - Use ChromeGovernor to launch browser
   - Delegate to Governor Canon (only ChromeGovernor touches CDP)

5. **Create `scripts/devops/runtime-test/discover-backend.ts`** - Backend discovery
   - List capabilities from `/api/capabilities`
   - Identify gaps in capability handlers

6. **Create `scripts/devops/runtime-test/discover-frontend.ts`** - UI discovery
   - Static scan web/ui/src for missing capability components
   - Report unfenced UI components

7. **Create `scripts/devops/runtime-test/test.ts`** - E2E harness
   - Live end-to-end against running server
   - Integrate with bun test runner

8. **Create `scripts/devops/runtime-test/ui-gate.ts`** - UI readiness check
   - Via ChromeGovernor/CDP, verify capability renders

9. **Create `scripts/devops/runtime-test/debug.ts`** - Debug capture
   - Capture screenshot + console on failure
   - Read DebugReport from `/tmp/vivim-debug/`

10. **Create `scripts/devops/runtime-test/build.ts`** - Scaffold/regenerate
    - Create frontend component
    - Wire to backend handler
    - Register in CapabilityRegistry

### Phase B: Skill Integration

11. **Wire source-audit skill** - Auto-audit on failures
    - On P0/P1 findings, auto-generate fix targets
    - Integration point for audit-code

12. **Wire devops-research skill** - Auto-research on unknowns
    - When gaps discovered, trigger research
    - Create research briefs for CREATE units

13. **Wire devops skill** - Unit implementation loop
    - Use `bun run devops select` to find next implementable unit
    - Use `bun run devops mark` to manage state
    - Use `bun run devops gate` for typecheck/lint/test

### Phase C: Skill Documentation

14. **Create `.opencode/skill/vivim-runtime/SKILL.md`** - Capstone
    - Complete command reference
    - Mode descriptions (autonomous vs mitm)
    - Integration points with other skills
    - Failure playbook

### Phase D: Self-Sufficiency Features

15. **Auto-question detection** - When the runtime hits ambiguity
    - Launch devops-research for context
    - Synthesize answers, continue loop

16. **Best-practice audit integration**
    - Post-build audit via source-audit
    - Prevent drift introduction

17. **Restart capability**
    - Governor-mediated CDP restart
    - WAL-safe backend restart

## Key Invariants to Maintain

- **Governor Canon:** Only ChromeGovernor touches CDP (B1)
- **Store Contracts:** Engines use `src/storage/contracts/*` (B2)
- **FRONTEND=BACKEND:** Capability slug links both sides (5.1)
- **One Entry Point:** All ops via `/api/interpret` (25.7)

## Acceptance Tests

- `bun run devops runtime-test --help` shows all commands
- `bun run devops runtime-test preflight` checks stack health
- `bun run devops runtime-test runtime --max-cycles 1` runs one cycle without hanging
- On injected failure, loop either builds fix or stops in mitm mode
- `bunx tsc --noEmit` clean after implementation
- Unit tests for each runtime-test component