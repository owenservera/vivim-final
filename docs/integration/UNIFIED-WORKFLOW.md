# Unified Workflow: SpecKit + DevOps Integration

## Overview

The vivim-final project uses **two complementary systems** for structured development:

- **SpecKit** (spec-driven development) defines *what* to build — requirements, plans, task breakdowns — via the `/speckit.*` command family living in `.specify/` and `.opencode/commands/speckit.*.md`.
- **DevOps** (autonomous agentic orchestrator) *builds* it — tracker-driven atomic units and goal-driven full-stack loops — via the `devops/` CLI and `.opencode/skill/devops*/SKILL.md` skills.

The integration layer (bridge modules in `devops/`) makes the two systems mutually aware **without modifying any SpecKit files**. SpecKit remains untouched; DevOps becomes SpecKit-aware through bridge modules that map IDs, sync state, unify gates, convert research formats, and run a consolidated converge.

## The Canonical Workflow

### Step 1: Research (if needed)

- **SpecKit:** `/speckit.clarify` (optional, pre-plan) produces `research.md`
- **DevOps:** `bun run devops research topic <name>` produces `docs/research/briefs/<topic>-brief.md`
- **Bridge:** `devops/research-bridge.ts` converts between the two formats
  - `exportBriefForSpecKit(brief, featureDir)` → `research.md` content
  - `importSpecKitResearch(featureDir)` → `Brief`
  - `findStaleSpecKitResearch()` → freshness scan
- **Output:** `specs/NNN-name/research.md` + `docs/research/briefs/<topic>-brief.md`

### Step 2: Specify

- **SpecKit:** `/speckit.specify "<description>"`
- **DevOps:** (not used)
- **Output:** `specs/NNN-name/spec.md`, `checklists/requirements.md`

### Step 3: Plan

- **SpecKit:** `/speckit.plan`
- **DevOps:** (research feeds into plan Phase 0 via the research bridge)
- **Output:** `plan.md`, `data-model.md`, `contracts/`, `quickstart.md`

### Step 4: Tasks

- **SpecKit:** `/speckit.tasks`
- **DevOps:** `bun run devops speckit sync <featureDir>` (links tasks to the atomic tracker)
- **Bridge:** `devops/speckit-bridge.ts`
  - `syncTasksToTracker(featureDir)` → creates/updates atomic units with bidirectional links
  - `mapTaskToUnit("T012")` → linked unit or `null`
  - `mapUnitToTask("2.1")` → linked task ID or `null`
- **Output:** `tasks.md` with `<!-- bridge:unit=... -->` linkage comments

### Step 5: Implement

- **SpecKit:** `/speckit.implement` (with unified gate)
- **DevOps:** `bun run devops runtime-test loop` (goal mode) OR tracker mode (`devops select` → `devops mark`)
- **Gate:** `bun run devops speckit gate --feature=<dir> --scope=phase`
- **Bridge:** `devops/unified-gate.ts` (`runUnifiedGate(config)`) orchestrates typecheck + lint + tests + SpecKit checklists

### Step 6: Converge + Audit

- **SpecKit:** `/speckit.converge`
- **DevOps:** `bun run devops speckit converge --feature=<dir>`
- **Bridge:** `devops/speckit-converge-bridge.ts` (`unifiedConverge(featureDir)`)
  - Runs spec/code/arch analysis and appends convergence tasks to `tasks.md`
  - Sources: `audit-code`, `audit-arch`, `speckit-bridge.validateBridge()`
- **Output:** Consolidated report + appended `## Phase N: Convergence` tasks

## Decision Table

See [DECISION-TABLE.md](./DECISION-TABLE.md) for the full scenario → system mapping.

## Bridge Modules Reference

| Module | Purpose | Path |
|--------|---------|------|
| speckit-bridge | Task↔unit ID mapping, sync, validation | `devops/speckit-bridge.ts` |
| unified-gate | Unified quality gate (typecheck/lint/test/SpecKit) | `devops/unified-gate.ts` |
| research-bridge | Brief↔research.md format conversion | `devops/research-bridge.ts` |
| tracker-speckit-sync | Bidirectional tracker↔tasks sync | `devops/tracker-speckit-sync.ts` |
| speckit-converge-bridge | Unified converge pipeline | `devops/speckit-converge-bridge.ts` |
| speckit-audit | Skill readiness audit | `devops/speckit-audit.ts` |

## CLI Surface

```
bun run devops speckit map-task <T###>        Map task ID to unit
bun run devops speckit map-unit <N.M>         Map unit ID to task
bun run devops speckit sync <featureDir>      Sync tasks→tracker (create units)
bun run devops speckit sync-feature <dir>     Sync feature tasks→tracker (update state)
bun run devops speckit sync-unit <unitId>     Sync unit state→tasks.md
bun run devops speckit sync-all               Sync all features to tracker
bun run devops speckit validate              Check bridge consistency
bun run devops speckit gate [--scope=...]     Unified quality gate
bun run devops speckit converge <featureDir>  Run unified converge (spec+code+arch)
bun run devops speckit find-brief <topic>     Find DevOps research brief
bun run devops speckit export-brief <t> <dir> Export brief to SpecKit format
bun run devops speckit import-research <dir>  Import SpecKit research to DevOps format
bun run devops speckit audit                  Audit skills for SpecKit readiness
```
