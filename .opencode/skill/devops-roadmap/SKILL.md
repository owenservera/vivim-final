---
name: devops-roadmap
description: >
---
# devops-roadmap

Research-first roadmap system. Grounded in the atomic list + truth system.
THE entry point for new atomic tasks — both AI-recommended and user-suggested.

## When to Load

**BEFORE the devops loop starts** — load this skill when:
1. Starting a new devops session (before `bun run devops select`)
2. Beginning a new phase (first unit of phase N)
3. User says "what already exists?" or "research first"
4. After completing a unit (to discover new gaps)
5. User suggests a new feature or unit

**Do NOT load when:**
- Resuming an in-progress unit (just run devops loop)
- Unit is already clearly defined and ready to implement

## Architecture

```
Truth System (scanner, comparators, gap-generator)
    ↓
devops-roadmap (research engine)
    ↓
┌─────────────────────────────────────────┐
│  Enriched Atomic Tracker                │
│  - Per-unit: classification, gaps,      │
│    source, effort                       │
│  - Discovered units: gaps not in list   │
│  - Domain health: truth score per area  │
└─────────────────────────────────────────┘
    ↓
devops loop (implementation)
```

## Commands

| Command | Purpose |
|---------|---------|
| `bun run devops roadmap` | Full research cycle (scan + discover + report) |
| `bun run devops roadmap --unit <id>` | Research single unit |
| `bun run devops roadmap --domain <name>` | Research domain |
| `bun run devops roadmap --discover` | Run discovery only (identify new unit candidates) |
| `bun run devops roadmap --interview <GAP-id>` | Start interview for discovered unit |
| `bun run devops roadmap --merge` | Merge enriched data into tracker (after review) |
| `bun run devops roadmap --merge-unit <id>` | Merge specific new unit (after interview approval) |

## Workflow

### Phase 1: Truth Scan
```bash
bun run devops truth full
# Produces: docs/roadmap/TRUTH-GAPS.md
```

### Phase 2: Tracker State
```bash
bun run devops select
# Gets next unit JSON
# Read docs/atomic-v3-fork-canon/01-tracker.md for all unit states
```

### Phase 3: Per-Unit Research
For each pending/in_progress unit:
1. Read atomic spec (`docs/atomic-v3/phase-*/<id>-*.md`)
2. Read existing vivim-final code — the file is the source of truth (if it exists)
3. Compare: spec vs existing vivim-final code
4. cap-store / vivim-app-og are optional prior-art references ONLY — never a harvest mandate
5. Classify unit: DONE / PORT / CREATE / FIX
6. Identify gaps (methods missing, stubs, etc.)
7. Estimate effort (S/M/L/XL)

### Phase 4: Gap Discovery
For each gap in truth report:
- Does it map to an existing atomic unit?
- If NO → candidate for new unit (add to DISCOVERED-UNITS.md)

### Phase 5: Interview Protocol
For each discovered unit candidate:
1. AI presents candidate to user
2. AI asks contextualizing questions
3. User answers (or says "skip" / "not needed")
4. AI synthesizes into atomic spec draft
5. User reviews spec draft
6. If approved → add to atomic list (via merge gate)

### Phase 6: Merge Gate
Before merging into tracker:
- Enrichment merge: auto-merge if research < 24h old, no DRIFT
- New unit merge: requires human approval (user says "merge")
- Conflict resolution: user wins

### Phase 7: Report Generation
Write outputs:
- `docs/roadmap/RESEARCH-REPORT.md` — per-unit research data
- `docs/roadmap/DISCOVERED-UNITS.md` — candidate future units
- `docs/roadmap/INTERVIEW-LOG.md` — human-AI conversation logs
- `docs/roadmap/DOMAIN-HEALTH.md` — domain truth scores

## Unit Classification

| Classification | Meaning | Action |
|----------------|---------|--------|
| DONE | Already fully implemented | Skip (don't re-implement) |
| PORT | Exists in vivim-final core, needs adaptation | Implement against vivim-final source |
| CREATE | Doesn't exist anywhere | Implement new |
| FIX | Exists but has stubs | Complete stub methods |

## Enriched Tracker Format

Current:
```
- [~] 11.2 — Chrome Launcher → `src/executor/launcher.ts`
```

Enriched:
```
- [~] 11.2 — Chrome Launcher → `src/executor/launcher.ts`
  - classification: MIXED (2 real, 1 stub)
  - source: against vivim-final source (file exists in src/)
  - effort: S
  - gaps: 1 (stub method: launchChrome)
  - vivim-ref: src/executor/launcher.ts
  - vivim-api: BunCdpClient.send()
  - prior-art: cap-store/src/executor/launcher.ts (optional, advisory only)
```

## Merge Gate Rules

1. **Enrichment merge** (adding metadata to existing units):
   - Research report must be < 24 hours old
   - No DRIFT conflicts with design docs
   - Classification must match actual file state
   → Auto-merge allowed

2. **New unit merge** (adding discovered units):
   - Must have completed interview protocol
   - Must have approved atomic spec
   - Must have dependency analysis
   → Requires human approval

3. **Conflict resolution**:
   - Tracker state disagrees with research → trust tracker
   - Design doc disagrees with research → mark DRIFT
   - User disagrees with AI recommendation → user wins

## Integration with Devops Loop

The devops skill's step 4 ("Fidelity") becomes:

```
4. Fidelity:
   a. Read docs/roadmap/RESEARCH-REPORT.md for this unit
   b. If classification is DONE → skip (already implemented)
   c. Cross-check against design docs
   d. Log DRIFT if found
```

## Key Invariants

- **Research before implementation.** Never start coding without running the roadmap first.
- **Truth-grounded.** All research comes from the truth scanner, not assumptions.
- **Interview before expansion.** New units go through human-AI conversation before adding to tracker.
- **Merge gate required.** No changes to tracker without going through the gate.
- **User wins conflicts.** When AI recommendation disagrees with user, user wins.