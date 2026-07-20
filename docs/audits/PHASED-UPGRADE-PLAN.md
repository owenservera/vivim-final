# Phased Upgrade Plan: Skills & DevOps System

**Created:** 2026-07-19
**Based on:** Skill & DevOps System Audit (2026-07-19)
**Status:** Ready for execution

---

## Phase 0: Critical Fix — Sync Kilocode Skills (P0)

**Goal:** Eliminate the 10KB+ drift between `.kilo/skills/` and `.opencode/skill/`
**Effort:** 5 minutes
**Risk:** Low (copy operation only)

### Steps

1. Copy all 16 SKILL.md files from `.opencode/skill/` to `.kilo/skills/`:

```powershell
$skills = @(
  'agentic', 'arch-audit', 'db-agent', 'devops', 'devops-db',
  'devops-fullstack', 'devops-generators', 'devops-research',
  'devops-roadmap', 'prisma-workflow', 'provider-testing',
  'source-audit', 'vivi-frontend', 'vivim-build', 'vivim-runtime',
  'vivim-testing'
)
foreach ($s in $skills) {
  Copy-Item ".opencode\skill\$s\SKILL.md" ".kilo\skills\$s\SKILL.md" -Force
  Write-Host "Synced: $s"
}
```

2. Verify sync completed:

```powershell
Get-ChildItem ".kilo\skills\*\SKILL.md" | ForEach-Object {
  $opencode = Get-Item ".opencode\skill\$($_.Directory.Name)\SKILL.md"
  [PSCustomObject]@{
    Skill = $_.Directory.Name
    KiloSize = $_.Length
    OpenCodeSize = $opencode.Length
    Match = $_.Length -eq $opencode.Length
  }
} | Format-Table -AutoSize
```

### Acceptance Criteria

- [ ] All 16 SKILL.md files exist in both locations
- [ ] File sizes match exactly
- [ ] No kilocode-specific content was lost (plans, agent config remain)

---

## Phase 1: Consolidate Artifacts (P1)

**Goal:** Make kilocode plans accessible to opencode; eliminate dual maintenance
**Effort:** 30 minutes
**Risk:** Low

### Step 1.1: Move Plans to Shared Location

```powershell
# Create shared plans directory
New-Item -ItemType Directory -Path "docs\plans" -Force

# Move kilocode plans
Copy-Item ".kilo\plans\*" "docs\plans\" -Recurse -Force

# Update .gitignore if needed (plans should be tracked)
# Remove any .gitignore entry for .kilo/plans/ if present
```

### Step 1.2: Create Skill Sync Script

Create `scripts/sync-skills.ps1`:

```powershell
#!/usr/bin/env pwsh
# Sync skills from .opencode/skill/ to .kilo/skills/
# Run after any skill edit to keep both locations in sync

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot ".opencode\skill"
$target = Join-Path $projectRoot ".kilo\skills"

if (-not (Test-Path $source)) {
  Write-Error "Source not found: $source"
  exit 1
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

$synced = 0
$failed = 0

Get-ChildItem -Path $source -Directory | ForEach-Object {
  $skillName = $_.Name
  $srcFile = Join-Path $_.FullName "SKILL.md"
  $dstFile = Join-Path $target "$skillName\SKILL.md"

  if (Test-Path $srcFile) {
    New-Item -ItemType Directory -Path (Split-Path $dstFile) -Force | Out-Null
    Copy-Item $srcFile $dstFile -Force
    $synced++
    Write-Host "  OK: $skillName" -ForegroundColor Green
  } else {
    $failed++
    Write-Host "  MISSING: $skillName" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Synced: $synced | Failed: $failed" -ForegroundColor Cyan
```

### Step 1.3: Create Git Hook (Optional)

Add to `.lefthook/pre-commit` or create `.git/hooks/post-checkout`:

```bash
# Re-sync kilocode skills after checkout
if [ -d ".kilo/skills" ] && [ -d ".opencode/skill" ]; then
  powershell -File scripts/sync-skills.ps1
fi
```

### Acceptance Criteria

- [ ] `docs/plans/` contains the two plan files from `.kilo/plans/`
- [ ] `scripts/sync-skills.ps1` exists and runs successfully
- [ ] Both skill directories are in sync

---

## Phase 2: Fill Skill Description Gaps (P2)

**Goal:** Ensure all skills have proper frontmatter descriptions for discovery
**Effort:** 15 minutes
**Risk:** None

### Current Gaps

| Skill | Issue |
|-------|-------|
| `devops-generators` | `description:` is empty (`>`) |
| `devops-research` | `description:` is empty (`>`) |
| `devops-roadmap` | `description:` is empty (`>`) |

### Fix

Edit each SKILL.md frontmatter to add a proper description:

**`devops-generators`:**
```yaml
description: Autonomous + interactive taxonomy generation. Builds ProviderCapabilityTaxonomy library via LLM-driven 4-round pipeline (skeleton → drill-down → UI slot mapping → cross-surface binding). Use when expanding platform coverage or generating capability taxonomies.
```

**`devops-research`:**
```yaml
description: Research-first intelligence layer with web search synthesis and code convergence. Bridges deep-research with devops (tracker + gate + ADRs + goals). Use before implementing CREATE units, when creating ADRs, or when freshness check flags stale research.
```

**`devops-roadmap`:**
```yaml
description: Research-first roadmap system grounded in truth scanner. THE entry point for new atomic tasks — both AI-recommended and user-suggested. Use before devops loop starts, at phase boundaries, or when user suggests new features.
```

### Acceptance Criteria

- [ ] All 16 skills have non-empty `description:` in frontmatter
- [ ] Descriptions are ≤300 characters (discoverable in skill lists)

---

## Phase 3: Leverage Global Skills (P2)

**Goal:** Import high-value global skills into project scope
**Effort:** 1 hour
**Risk:** Low (additive)

### High-Value Candidates

| Skill | Source | Why |
|-------|--------|-----|
| `diagnose` | `~/.claude/skills/` | Structured debugging workflow — complements `vivim-debugging` |
| `systematic-debugging` | `~/.claude/skills/` | Reproduce → minimise → hypothesise → fix loop |
| `tdd` | `~/.claude/skills/` | Red-green-refactor — complements `vivim-testing` |
| `review` | `~/.claude/skills/` | Parallel code review — complements `source-audit` |
| `verification-before-completion` | `~/.claude/skills/` | Pre-ship verification gate |
| `handoff` | `~/.claude/skills/` | Session handoff for long-running work |
| `visual-explainer` | `~/.agents/skills/` | Diagram generation for architecture docs |

### Import Process

For each skill:
1. Read the SKILL.md from the global location
2. Check for conflicts with existing project skills
3. If no conflict, copy to `.opencode/skill/<name>/SKILL.md`
4. Add to `.kilo/skills/` via sync script
5. Test that the skill loads correctly

### Acceptance Criteria

- [ ] Selected global skills imported to `.opencode/skill/`
- [ ] No conflicts with existing 16 skills
- [ ] Skills discoverable via opencode

---

## Phase 4: Documentation & Governance (P3)

**Goal:** Document skill architecture and establish governance
**Effort:** 30 minutes
**Risk:** None

### Step 4.1: Create Skill Architecture Doc

Create `docs/skill-architecture.md`:

```markdown
# Skill Architecture

## Skill Loading Order

1. Global skills: `~/.agents/skills/` (171 skills, auto-discovered)
2. Config skills: `~/.config/opencode/skill/` (8 skills)
3. Project skills: `.opencode/skill/` (16 skills, highest priority)

## Skill File Format

Each skill is a directory with a `SKILL.md` file:
```
skill-name/
  SKILL.md          # Required: frontmatter + instructions
  *.ts, *.md, ...   # Optional: supporting files
```

## Frontmatter Schema

```yaml
---
name: skill-name                    # Required: unique identifier
description: >-                     # Required: ≤300 chars, used for discovery
  Multi-line description of when
  to load this skill.
---
```

## Governance Rules

1. **Single source of truth:** `.opencode/skill/` is canonical
2. **Sync to kilocode:** Run `scripts/sync-skills.ps1` after edits
3. **No duplicate names:** Check global skills before creating
4. **Test after edit:** Verify skill loads and instructions are correct
5. **Review drift:** Monthly check of `.kilo/skills/` sync status
```

### Step 4.2: Add to AGENTS.md

Append to `AGENTS.md`:

```markdown
## Skill Management

- **Source of truth:** `.opencode/skill/` (16 project skills)
- **Sync to kilocode:** `pwsh scripts/sync-skills.ps1`
- **Global skills:** `~/.agents/skills/` (171) + `~/.claude/skills/` (94)
- **Adding new skills:** Create in `.opencode/skill/`, run sync, test
- **Audit:** `docs/audits/SKILL-DEVOPS-AUDIT-2026-07-19.md`
```

### Acceptance Criteria

- [ ] `docs/skill-architecture.md` exists
- [ ] `AGENTS.md` updated with skill management section
- [ ] Sync script documented

---

## Execution Timeline

| Phase | Effort | Dependencies | Can Parallel |
|-------|--------|--------------|--------------|
| Phase 0: Sync kilo skills | 5 min | None | No (first) |
| Phase 1: Consolidate artifacts | 30 min | Phase 0 | No |
| Phase 2: Fill descriptions | 15 min | None | Yes with Phase 1 |
| Phase 3: Import global skills | 1 hr | Phase 0 | Yes with Phase 1-2 |
| Phase 4: Documentation | 30 min | Phase 1 | Yes with Phase 3 |

**Total estimated effort:** ~2 hours
**Critical path:** Phase 0 → Phase 1 → Phase 4

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Skill copy overwrites unique kilocode content | Low | Medium | Verified: kilocode skills are strict subsets |
| Global skill import conflicts | Low | Low | Check name collision before import |
| Sync script breaks on Windows path issues | Medium | Low | Use `Join-Path`, test on PowerShell 7+ |
| Plans migration loses context | Low | Low | Copy, don't move; keep originals until verified |

---

## Post-Upgrade Verification

Run after all phases complete:

```powershell
# 1. Verify all skills exist in both locations
$opencode = (Get-ChildItem ".opencode\skill\*\SKILL.md").Count
$kilo = (Get-ChildItem ".kilo\skills\*\SKILL.md").Count
Write-Host "Skills: opencode=$opencode kilo=$kilo"

# 2. Verify sync script works
pwsh scripts/sync-skills.ps1

# 3. Verify no empty descriptions
Get-ChildItem ".opencode\skill\*\SKILL.md" | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  if ($content -match 'description:\s*>?\s*\n\s*\n') {
    Write-Host "EMPTY DESC: $($_.Directory.Name)" -ForegroundColor Red
  }
}

# 4. Verify plans accessible
Get-ChildItem "docs\plans\*" | Format-Table Name, Length
```

---

## Appendix: Complete Skill Inventory

### Project Skills (16)

| # | Skill | Category | Description |
|---|-------|----------|-------------|
| 1 | `devops` | orchestration | Autonomous DevOps orchestrator (127 atomic units) |
| 2 | `devops-fullstack` | workflow | LLM-driven full-stack dev loop |
| 3 | `devops-db` | database | Database architecture & schema governance |
| 4 | `devops-generators` | generation | Taxonomy generation pipeline |
| 5 | `devops-research` | research | Research-first intelligence layer |
| 6 | `devops-roadmap` | planning | Research-first roadmap system |
| 7 | `agentic` | orchestration | Limited-context agentic dev loop |
| 8 | `vivim-runtime` | orchestration | Agent-as-runtime dev loop |
| 9 | `vivim-build` | implementation | Engine implementation workflow |
| 10 | `vivim-testing` | quality | Testing patterns & workflows |
| 11 | `vivi-frontend` | frontend | Hot-swappable frontend skill |
| 12 | `source-audit` | quality | P0-P3 source-code audit |
| 13 | `arch-audit` | quality | Architecture audit (cycles, layering) |
| 14 | `provider-testing` | testing | 8-phase provider onboarding |
| 15 | `db-agent` | database | Oracle-vision database agent |
| 16 | `prisma-workflow` | database | Prisma ORM patterns |

### DevOps CLI Commands (50+)

| Category | Commands |
|----------|----------|
| Core Loop | `select`, `mark`, `gate`, `report`, `run` |
| Runtime Testing | `bootstrap`, `preflight`, `engage`, `discover`, `test`, `debug`, `build`, `loop`, `setup`, `status`, `stop`, `onboard`, `verify`, `migrate`, `guard`, `watchdog`, `health`, `selectors`, `test-cap`, `discover-protocol`, `discover-cdp`, `verify-pipeline`, `catalog-gen`, `report` |
| Agentic | `start`, `resume`, `done`, `status`, `probe`, `preflight` |
| Auditing | `audit-code`, `audit-arch`, `truth` |
| Planning | `roadmap`, `goals`, `decision` |
| Integration | `speckit`, `ui-test`, `discover-protocol` |
