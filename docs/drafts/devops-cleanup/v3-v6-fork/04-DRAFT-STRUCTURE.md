# Draft Fork Structure: v3-fork-canon

**Date:** 2026-07-12
**Status:** DRAFT

---

## Expected Directory Tree

```
docs/atomic-v3-fork-canon/
├── 01-tracker.md
├── PORT-OVER-PLAN.md
├── PHASE-DEPENDENCIES.md
├── CHANGELOG.md
│
├── phase-01-stabilization/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-01-stabilization/*.md)
│
├── phase-02-kernel-foundation/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v5/phase-00-kernel-core/*.md
│        and docs/atomic-v5/phase-00-surgical-edit/*.md)
│
├── phase-03-agentic-core/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-02-agentic-core/*.md)
│
├── phase-04-html-canvas/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-03-html-canvas/*.md)
│
├── phase-05-workspace-ui/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-04-workspace-ui/*.md)
│
├── phase-06-provider-expansion/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-05-provider-expansion/*.md)
│
├── phase-07-memory-knowledge/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-06-memory-knowledge/*.md)
│
├── phase-08-autonomous-orch/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-07-autonomous-orchestration/*.md)
│
├── phase-09-observability/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-08-observability-audit/*.md)
│
├── phase-10-sovereign-data/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v3/phase-09-sovereign-data/*.md)
│
├── phase-11-kernel-oracle/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v5/phase-15-kernel-oracle/*.md)
│
├── phase-12-kernel-surfaces/
│   └── 00-PHASE-INDEX.md
│       (references docs/atomic-v5/phase-16-kernel-surfaces/*.md
│        and docs/atomic-v5/phase-00-surgical-edit/16.*.md)
│
└── phase-13-polish-sdk/
    └── 00-PHASE-INDEX.md
        (references docs/atomic-v3/phase-10-polish-sdk/*.md)
```

## Key Design Decisions

### 1. Phase Directories Are Index-Only
Each phase directory contains a single `00-PHASE-INDEX.md` that lists:
- All units in the phase
- Their original spec locations
- Dependencies within the phase
- Dependencies on prior phases

No spec files are copied. All paths reference originals.

### 2. Directory Naming Convention
- `phase-{NN}-{descriptive-name}/` — e.g., `phase-02-kernel-foundation/`
- Double digits for alphabetical sorting
- Short descriptive name after the number

### 3. The 01-tracker.md File
The main tracker follows the same format as the existing v3 tracker:
- Header with canonical status
- Summary line
- Phase sections with `[ ]` / `[x]` units
- Phase 1: 10 done, 2 pending
- Phases 2-13: all pending
- Each line: `[ ] {original-ID} — {name} → `{spec-path}``

### 4. Port-Over Cross-Reference
`PORT-OVER-PLAN.md` documents which unit came from where:
```
v3-fork-canon ID | Source Version | Source Phase | Source ID | Status
1.1              | v3             | Phase 1      | 1.1       | [x] done
0.0              | v5             | Phase 00     | 0.0       | [ ] pending
2.1              | v3             | Phase 2      | 2.1       | [ ] pending
...
```

### 5. File Count
Total files to create: **17 files**
- 1 main tracker
- 3 supporting docs (PORT-OVER-PLAN, PHASE-DEPENDENCIES, CHANGELOG)
- 13 phase index files
