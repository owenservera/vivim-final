# Draft Skeleton: v3-fork-canon Directory Tree

**Date:** 2026-07-12

```
docs/atomic-v3-fork-canon/
├── 01-tracker.md                         # 127 units, 13 phases, canonical header
├── PORT-OVER-PLAN.md                     # (copy of 02-COPY-PASTE-PLAN.md)
├── PHASE-DEPENDENCIES.md                 # (copy of 06-PHASE-DEPENDENCIES.md)
├── CHANGELOG.md                          # (copy of 07-CHANGELOG.md)
│
├── phase-01-stabilization/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-01-stabilization/*.md
│
├── phase-02-kernel-foundation/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v5/phase-00-kernel-core/*.md
│       → references docs/atomic-v5/phase-00-surgical-edit/*.md
│
├── phase-03-agentic-core/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-02-agentic-core/*.md
│
├── phase-04-html-canvas/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-03-html-canvas/*.md
│
├── phase-05-workspace-ui/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-04-workspace-ui/*.md
│
├── phase-06-provider-expansion/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-05-provider-expansion/*.md
│
├── phase-07-memory-knowledge/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-06-memory-knowledge/*.md
│
├── phase-08-autonomous-orch/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-07-autonomous-orchestration/*.md
│
├── phase-09-observability/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-08-observability-audit/*.md
│
├── phase-10-sovereign-data/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v3/phase-09-sovereign-data/*.md
│
├── phase-11-kernel-oracle/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v5/phase-15-kernel-oracle/*.md
│
├── phase-12-kernel-surfaces/
│   └── 00-PHASE-INDEX.md
│       → references docs/atomic-v5/phase-16-kernel-surfaces/*.md
│       → references docs/atomic-v5/phase-00-surgical-edit/16.*.md
│
└── phase-13-polish-sdk/
    └── 00-PHASE-INDEX.md
        → references docs/atomic-v3/phase-10-polish-sdk/*.md
```

## File Count Summary

| Item | Count |
|------|-------|
| Root tracker | 1 |
| Supporting docs | 3 |
| Phase directories | 13 |
| Phase index files | 13 |
| **Total new files** | **17** |
| Spec files (unchanged, referenced) | 127 |

## Phase Index Format

Each `00-PHASE-INDEX.md` follows this template:

```markdown
# Phase {N}: {Name}

**Source:** {original v3/v5 path}
**Units:** {count} | **Done:** {N} | **Status:** {all pending | N done}

## Units

| ID | Name | Status | Source File |
|----|------|--------|-------------|
| 1.1 | Short name | [x] | `path/to/spec.md` |
| 1.2 | Short name | [ ] | `path/to/spec.md` |

## Dependencies

- Internal: {within-phase deps}
- External: {depends on phase N}
```
