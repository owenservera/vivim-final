# Skill Architecture

**Last updated:** 2026-07-19
**Project:** vivim-final

## Overview

The vivim-final project uses a layered skill system where specialized instructions
are loaded on-demand based on the task at hand. Skills are the primary mechanism
for giving agents domain-specific knowledge.

## Skill Loading Order

Skills are loaded in priority order (last wins on conflict):

| Priority | Location | Count | Purpose |
|----------|----------|-------|---------|
| 1 (lowest) | `~/.agents/skills/` | 171 | OpenCode agent global skills (ECC bundle) |
| 2 | `~/.claude/skills/` | 94 | Claude Code global skills (ECC bundle) |
| 3 | `~/.config/opencode/skill/` | 8 | OpenCode config-level skills |
| 4 (highest) | `.opencode/skill/` | 23 | **Project skills (canonical source)** |

## Project Skills (23)

### Core DevOps (7)

| Skill | Purpose |
|-------|---------|
| `devops` | Autonomous DevOps orchestrator (127 atomic units) |
| `devops-fullstack` | LLM-driven full-stack dev loop |
| `devops-db` | Database architecture & schema governance |
| `devops-generators` | Taxonomy generation pipeline |
| `devops-research` | Research-first intelligence layer |
| `devops-roadmap` | Research-first roadmap system |
| `agentic` | Limited-context agentic dev loop |

### Implementation (3)

| Skill | Purpose |
|-------|---------|
| `vivim-build` | Engine implementation workflow |
| `vivim-runtime` | Agent-as-runtime dev loop |
| `vivi-frontend` | Hot-swappable frontend skill |

### Quality (5)

| Skill | Purpose |
|-------|---------|
| `vivim-testing` | Testing patterns & workflows |
| `source-audit` | P0-P3 source-code audit |
| `arch-audit` | Architecture audit (cycles, layering) |
| `provider-testing` | 8-phase provider onboarding |
| `db-agent` | Oracle-vision database agent |

### Database (1)

| Skill | Purpose |
|-------|---------|
| `prisma-workflow` | Prisma ORM patterns |

### Debugging (2)

| Skill | Purpose |
|-------|---------|
| `diagnose` | Structured diagnosis loop (reproduce → fix) |
| `systematic-debugging` | Bug/test failure debugging workflow |

### Development Workflow (5)

| Skill | Purpose |
|-------|---------|
| `tdd` | Test-driven development (red-green-refactor) |
| `review` | Two-axis code review (standards + spec) |
| `verification-before-completion` | Pre-ship verification gate |
| `handoff` | Session handoff for continuity |
| `visual-explainer` | HTML diagram generation |

## Skill File Format

Each skill is a directory with a `SKILL.md` file:

```
.opencode/skill/
  skill-name/
    SKILL.md          # Required: frontmatter + instructions
    *.ts, *.md, ...   # Optional: supporting files
```

### Frontmatter Schema

```yaml
---
name: skill-name                    # Required: unique identifier
description: >-                     # Required: ≤300 chars, used for discovery
  Multi-line description of when
  to load this skill.
---
```

## Sync Script

Skills are synced to kilocode via:

```powershell
pwsh scripts/sync-skills.ps1           # Sync all
pwsh scripts/sync-skills.ps1 -Skill devops  # Sync one
pwsh scripts/sync-skills.ps1 -DryRun   # Preview
```

**Canonical source:** `.opencode/skill/` (never edit `.kilo/skills/` directly)

## Adding a New Skill

1. Create `.opencode/skill/<name>/SKILL.md` with frontmatter
2. Run `pwsh scripts/sync-skills.ps1 -Skill <name>`
3. Test: verify skill loads and instructions are correct
4. Commit both `.opencode/skill/<name>/` and `.kilo/skills/<name>/`

## Governance Rules

1. **Single source of truth:** `.opencode/skill/` is canonical
2. **Sync to kilocode:** Run `scripts/sync-skills.ps1` after edits
3. **No duplicate names:** Check global skills before creating
4. **Test after edit:** Verify skill loads and instructions are correct
5. **Review drift:** Monthly check of `.kilo/skills/` sync status

## Plans & Historical Artifacts

Historical plans from kilocode are archived in `docs/plans/`:

```
docs/plans/
  1752318499550-http-query-tasks.md
  1783617940191-land-unit-3-13-and-devops-hygiene.md
  ...  (19 total plan files)
```

These are read-only references for institutional knowledge.
