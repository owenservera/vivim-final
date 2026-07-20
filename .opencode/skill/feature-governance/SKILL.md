---
name: feature-governance
description: Feature registry, lifecycle management, and skill-to-feature mapping for vivim-final. Drives `bun run devops features` CLI commands. Use when registering new features, auditing feature health, running gap analysis, or governing feature lifecycle.
---
# feature-governance

Feature registry and lifecycle governance for vivim-final. Manages the
feature inventory, skill-to-feature mapping, health dashboard, and
lifecycle automation. Drives the deterministic mechanics in
`devops/features.ts` via `bun run devops features`.

## When to Load

**Load this skill when:**
1. User says "register a feature", "add a feature", "feature inventory", "feature registry"
2. User asks "what features exist", "feature status", "feature health", "feature gaps"
3. User wants to map skills to features, or check which skills govern a feature
4. User wants to audit feature lifecycle, run gap analysis, or check feature health
5. After completing an atomic unit or feature implementation — register it in the feature registry

**Do NOT load when:**
- Only atomic tracker work (select/mark/gate) is needed → use `devops`
- Only architecture audit is wanted → use `arch-audit`
- Only source-code audit is wanted → use `source-audit`

## Core Concepts

### 1. FeatureRecord

Every feature in vivim-final is represented as a `FeatureRecord` with:

| Field | Purpose |
|-------|---------|
| `id` | Unique identifier (e.g. `029-command-language`) |
| `name` | Human-readable name |
| `phase` | Atomic tracker phase (0-14) |
| `status` | Lifecycle state (`proposed` → `done`) |
| `owningSkill` | Skill that governs this feature |
| `engines` | Engine file paths owned by this feature |
| `specRef` | Path to atomic spec document |
| `coverage` | Test coverage percentage |
| `invariants` | Relevant invariant IDs |
| `lastVerified` | Date of last successful verification |
| `notes` | Free-form description |

### 2. Status Lifecycle

```
proposed → designing → approved → in_progress → testing → verified → done
                                                         ↓
                                                     deprecated
```

- **proposed**: Feature requested, not yet started
- **designing**: Spec/ADR in progress
- **approved**: Approved for implementation
- **in_progress**: Actively being built
- **testing**: Implementation done, tests in progress
- **verified**: All tests pass, gate passes
- **done**: Feature complete and documented
- **deprecated**: No longer relevant

### 3. Gap Analysis

`devops features gaps` scans all registered features for:

| Gap Type | Severity | Meaning |
|----------|----------|---------|
| `engine_no_test` | warning | Engine has no unit test |
| `spec_missing` | warning | No spec reference defined |
| `skill_missing` | block | No owning skill assigned |
| `coverage_low` | warning | Coverage below 80% threshold |

### 4. Storage

- Individual feature files: `docs/features/<id>.md`
- Master index: `docs/features/FEATURES.md`
- Code: `devops/features.ts`

## Commands

```
bun run devops features list                    — table of all features
bun run devops features show <id>               — full feature record
bun run devops features create --id=<id> --name="..." --phase=<n> --skill=<slug>  — register new feature
bun run devops features update <id> --status=X  — update feature status
bun run devops features status                  — summary counts by phase/status
bun run devops features gaps [--id=<id>]        — spec vs implementation vs test gaps
```

### Flags

| Flag | Applies to | Purpose |
|------|-----------|---------|
| `--id=<id>` | create, gaps | Feature ID |
| `--name="..."` | create, update | Feature name |
| `--phase=<n>` | create, update | Atomic tracker phase |
| `--skill=<slug>` | create, update | Owning skill slug |
| `--engines=a.ts,b.ts` | create | Engine file paths |
| `--spec=<path>` | create | Spec document path |
| `--coverage=<n>` | create, update | Coverage percentage |
| `--notes="..."` | create | Free-form notes |
| `--status=X` | update | New status value |
| `--verified=YYYY-MM-DD` | update | Last verified date |

## Workflow

### Registering a New Feature

```
1. Determine feature ID (from atomic unit or manual)
2. bun run devops features create --id=<id> --name="..." --phase=<n> --skill=<slug>
3. bun run devops features update <id> --status=in_progress
4. (Implement the feature)
5. bun run devops features update <id> --status=done --coverage=95
6. bun run devops features gaps  — verify no gaps
```

### Auditing Feature Health

```
1. bun run devops features status          — see overall picture
2. bun run devops features gaps            — find gaps
3. bun run devops features show <id>       — inspect specific feature
4. bun run devops invariants check         — architectural compliance
```

### Skill-to-Feature Mapping

Every feature must have an owning skill. When creating a feature:

| Feature Phase | Likely Owning Skill |
|---------------|---------------------|
| Engine implementation | `vivim-build` |
| Database schema | `devops-db` |
| Frontend UI | `vivi-frontend` |
| Testing | `vivim-testing` |
| Runtime/devops | `vivim-runtime` |
| Cross-cutting | `devops` |

## Wiring into DevOps

- **CLI verb:** `features` in `devops/index.ts` → `devops/features.ts`
- **Deterministic mechanics:** `devops/features.ts` (Bun + stdlib only)
- **State:** `docs/features/<id>.md`, `docs/features/FEATURES.md`
- **Integration:** Gap analysis scans `tests/unit/engines/` for test coverage
- **Invariant B9 (planned):** Every engine file must be listed in at least one `FeatureRecord.engines`

## Key Invariants

- **Every feature has an owning skill.** `skill_missing` is a block-level gap.
- **Every feature has a spec reference.** `spec_missing` is a warning.
- **Coverage threshold: 80%.** `coverage_low` is a warning.
- **Single source of truth.** `docs/features/` is the canonical feature inventory.
