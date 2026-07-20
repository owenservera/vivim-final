# Skill & DevOps System Audit Report

**Date:** 2026-07-19
**Auditor:** opencode (mimo-v2.5-free)
**Scope:** All custom skills, devops system, kilocode integration, global skill inventory

---

## Executive Summary

The vivim-final project maintains **16 project-specific skills** across two locations
(`.opencode/skill/` and `.kilo/skills/`), a **48-module devops system**, and has access
to **265+ global ECC-bundle skills**. The audit found **critical drift** between the
opencode and kilocode skill copies, ** duplicated maintenance burden**, and **orphaned
kilocode-specific artifacts** not accessible to opencode agents.

| Risk | Count | Summary |
|------|-------|---------|
| **P0** | 1 | `.kilo/skills/` is stale — 10KB+ drift in `devops-fullstack` |
| **P1** | 2 | Dual maintenance burden; kilocode plans not accessible |
| **P2** | 2 | Global skills under-leveraged; no sync automation |
| **P3** | 1 | Skill descriptions in `devops-generators` and `devops-research` are empty |

---

## 1. Architecture Overview

### 1.1 Skill Locations

| Location | Purpose | Skills | Loaded By |
|----------|---------|--------|-----------|
| `.opencode/skill/` | **Active** project skills | 16 | opencode (via `opencode.json` `skills.paths`) |
| `.kilo/skills/` | Kilocode project skills (stale copy) | 16 | kilocode (`.kilo/` convention) |
| `~/.claude/skills/` | Claude Code global skills | 94 | Claude Code (auto-discovered) |
| `~/.agents/skills/` | OpenCode agent global skills | 171 | OpenCode (auto-discovered) |
| `~/.config/opencode/skill/` | OpenCode config-level skills | 8 | opencode (config path) |

### 1.2 DevOps System (`devops/`)

```
devops/
├── index.ts                    # CLI entry (50+ commands)
├── agentic/                    # Limited-context agentic loop
│   ├── engine.ts               # Loop coordinator
│   ├── decomposer.ts           # Objective → Task DAG
│   ├── probe.ts                # State snapshot
│   ├── context-probe.ts        # Preflight context
│   └── packager.ts             # Handoff artifacts
├── runtime-test/               # Provider testing (35+ files)
│   ├── onboard-controller.ts   # 8-phase onboarding
│   ├── cdp-resolver.ts         # CDP connection
│   ├── supervisor.ts           # Server lifecycle
│   └── ...
├── audit-code/                 # P0-P3 source audit
├── audit-arch/                 # Architecture audit
├── truth/                      # Truth scanner + gaps
├── roadmap/                    # Research-first roadmap
├── select.ts                   # Unit selection
├── mark.ts                     # State transitions
├── gate.ts                     # Quality gate
├── report.ts                   # Progress reporting
├── goals.ts                    # OKR tracking
├── decision.ts                 # ADR management
├── invariants.ts               # Architectural invariants
├── tracker.ts                  # Atomic unit tracker
└── ...                         # 25+ supporting modules
```

---

## 2. Drift Analysis: `.kilo/skills/` vs `.opencode/skill/`

### 2.1 Skills with Significant Drift

| Skill | `.kilo` Bytes | `.opencode` Bytes | Delta | Drift Summary |
|-------|--------------|-------------------|-------|---------------|
| `devops-fullstack` | 24,884 | 35,087 | **+10,203** | Anti-hangup rules, CDP gotchas (11 items), Recipes D/E, SpecKit integration, canvas layer docs |
| `vivim-testing` | 4,517 | 8,147 | +3,630 | Node-store testing pattern, mkNode helper, version chain/alias/graph tests |
| `prisma-workflow` | 2,741 | 6,073 | +3,332 | Node-Layer v2 migrations, fixture DB rebuild, migration recording |
| `vivim-build` | 3,766 | 5,991 | +2,225 | Node-Layer v2 section, ACU-proven fields, version chain, fork linkage, graph rebuild |
| `agentic` | 5,406 | 7,448 | +2,042 | Edit-then-verify ordering, preflight/adopt commands, source files table |
| `devops` | 6,107 | 6,778 | +671 | Node-Layer v2 section, Parser Loop, Chrome Profiles docs |
| `source-audit` | 7,262 | 7,486 | +224 | Minor updates |
| `provider-testing` | 5,187 | 5,220 | +33 | Minor updates |

### 2.2 Skills in Sync

| Skill | Status |
|-------|--------|
| `arch-audit` | Identical |
| `db-agent` | Identical |
| `devops-db` | Identical |
| `devops-generators` | Identical |
| `devops-research` | Identical |
| `devops-roadmap` | Identical |
| `vivi-frontend` | Near-identical (minor formatting) |
| `vivim-runtime` | Identical |

### 2.3 Root Cause

The drift occurred because `.opencode/skill/` was updated during development sessions
that used opencode, while `.kilo/skills/` was not re-synced. There is no automation
or git hook to keep them in parallel.

---

## 3. Kilocode-Specific Artifacts

### 3.1 What's in `.kilo/` but NOT in `.opencode/`

| Artifact | Path | Status |
|----------|------|--------|
| Plans directory | `.kilo/plans/` | **Orphaned** — not accessible to opencode |
| Agent config | `.kilo/agent/` | Kilocode-specific |
| Command config | `.kilo/command/` | Kilocode-specific |
| Custom commands | `.kilo/commands/` | Kilocode-specific |
| Package deps | `.kilo/package.json` | Kilocode-specific |
| Node modules | `.kilo/node_modules/` | Kilocode-specific |

### 3.2 Plans Content

Two plan files were found:
- `1784411187311-provider-protocol-verification.md` — prior verification report
- `1784416945191-opencode-deep-research-plan.md` — opencode deep research plan

These contain valuable institutional knowledge but are locked in the kilocode directory.

---

## 4. Global Skills Inventory

### 4.1 `~/.claude/skills/` (94 skills)

**Project-Relevant (already duplicated in project):**
- `capability-driven-chat`, `frontend-capability-ui`, `vivim-debugging`

**High-Value (not in project skills):**
- `diagnose` — Disciplined diagnosis loop
- `tdd` — Test-driven development
- `review` — Code review
- `systematic-debugging` — Structured debugging
- `handoff` — Session handoff
- `session-objectives` — Session tracking
- `verification-before-completion` — Pre-ship verification

**ECC-Bundle (general purpose):**
- 80+ skills for writing, design, frontend, backend, DevOps patterns

### 4.2 `~/.agents/skills/` (171 skills)

**Project-Relevant:**
- `cavecrew` — Subagent delegation
- `source-command-*` — 30+ source commands
- `test-driven-development` — TDD workflow
- `visual-explainer` — Diagram generation

**Notable Gaps vs Claude Code:**
- Missing: `diagnose`, `grill-me`, `grill-with-docs`
- Added: `cavecrew`, `source-command-*` series, `visual-explainer`

---

## 5. DevOps System Health

### 5.1 Module Count by Subsystem

| Subsystem | Modules | Health |
|-----------|---------|--------|
| `runtime-test/` | 35+ | Active, well-tested |
| `agentic/` | 6 | Active, recently expanded |
| `audit-code/` | directory | Active |
| `audit-arch/` | directory | Active |
| `truth/` | 5 | Active |
| `roadmap/` | 5 | Active |
| Root | 25+ | Active |

### 5.2 CLI Command Count

The `devops/index.ts` entry point exposes **50+ commands** across:
- Core loop: `select`, `mark`, `gate`, `report`, `run`
- Runtime testing: `runtime-test` (30+ subcommands)
- Agentic: `agentic` (6 subcommands)
- Auditing: `audit-code`, `audit-arch`, `truth`
- Planning: `roadmap`, `goals`, `decision`
- Integration: `speckit`, `ui-test`, `discover-protocol`

### 5.3 Test Coverage

| Test File | Purpose |
|-----------|---------|
| `tests/unit/devops/tracker.test.ts` | Tracker state machine |
| `tests/unit/devops/select.test.ts` | Unit selection logic |
| `tests/unit/devops/onboard-ledger.test.ts` | Onboarding ledger |
| `tests/unit/devops/onboard-controller.test.ts` | Onboarding controller |
| `tests/unit/devops/invariants.test.ts` | Invariant checking |
| `tests/unit/devops/goals.test.ts` | Goal tracking |
| `tests/unit/devops/decision.test.ts` | ADR management |
| `tests/unit/devops/confidence-gate.test.ts` | Confidence gating |
| `tests/unit/devops/automation-activity-log.test.ts` | Activity logging |
| `tests/unit/devops/agentic-packager.test.ts` | Handoff packaging |
| `tests/unit/devops/agentic-decomposer.test.ts` | Task decomposition |

---

## 6. Recommendations Summary

| # | Priority | Action | Effort |
|---|----------|--------|--------|
| 1 | **P0** | Sync `.kilo/skills/` from `.opencode/skill/` | 5 min |
| 2 | **P1** | Create sync script or git hook | 30 min |
| 3 | **P1** | Move `.kilo/plans/` to `docs/plans/` | 10 min |
| 4 | **P2** | Add high-value global skills to project | 1 hr |
| 5 | **P2** | Fill empty skill descriptions | 15 min |
| 6 | **P3** | Document skill loading architecture | 30 min |

---

## 7. Phased Upgrade Plan

See [PHASED-UPGRADE-PLAN.md](./PHASED-UPGRADE-PLAN.md) for the detailed execution plan.
