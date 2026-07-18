# Documentation Index — Single Source of Truth

> Generated 2026-07-17
> Archived directories: `.archive/` (18 stale atomic tracker versions)

---

## Canonical Documentation Layout

```
docs/
├── atomic/               # CANONICAL — implementation tracker + progress
│   ├── 01-tracker.md     # Single tracker (267/267 done)
│   ├── PROGRESS.md       # Audit trail
│   ├── 00-master-plan.md # Phase dependency graph
│   ├── 99-glossary.md    # Shared terminology
│   ├── ATOMIC-GEN-PIPELINE.md  # How atomic units are generated
│   └── phase-*/          # Atomic unit specs (one per unit)
│
├── decisions/            # ADRs (ADR-001 through ADR-013)
│
├── roadmap/              # Roadmaps, plans, invariants
│   ├── INVARIANTS.md                 # 16 architectural invariants
│   ├── PRODUCTION-MASTER-PLAN-AUDIT.md  # 100 user moments + audit
│   ├── SELF-GOVERNING-DEV-SYSTEM.md  # M1/M2/M3 gates design
│   └── prds/                         # Product requirements documents
│
├── prds/                 # Active PRDs
│   ├── PRD-DB-CLEANUP-SEED-REFACTOR.md
│   └── integration/      # Integration PRDs
│       └── PRD-12-PROVIDER-ONBOARDING-MODES.md
│
├── workstreams/          # Parallel agent workstream briefs
│   ├── AGENT-1-PRODUCTION-HARDENING.md
│   ├── AGENT-2-CANVAS-SURFACE.md
│   ├── AGENT-3-CHAT-ADVANCED.md
│   └── AGENT-4-PROVIDER-OPS-E2E.md
│
├── merged-design-v2/     # Complete design docs (architecture, schema, engines, API)
│
├── goals/                # OKR tracking + MVP governance
│   ├── MVP.md            # ACTIVE — MVP goals governing all priority (P0/P1/P2)
│   └── GOALS.md          # Historical OKR tracking (G-001 through G-005)
│
├── agents/               # Agent instructions
│   ├── domain.md
│   ├── issue-tracker.md
│   └── triage-labels.md
│
├── audits/               # Source-code audit reports (generated)
│
└── api/                  # OpenAPI specs
```

## Archive

All previous atomic tracker versions (v3-v18, fork-canons, runtime) are archived at:

```
.archive/
├── atomic-v3-ARCHIVED-20260712/
├── atomic-v3-fork-canon/
├── atomic-v4-ARCHIVED-20260712/
├── atomic-v4-fork-canon/
├── atomic-v5-ARCHIVED-20260712/
├── atomic-v5-fork-canon/
├── atomic-v7/
├── atomic-v8/
├── atomic-v9/
├── atomic-v10/
├── atomic-v11/
├── atomic-v12/
├── atomic-v13/
├── atomic-v14/
├── atomic-v15/
├── atomic-v17/
├── atomic-v18/
└── atomic-runtime/
```

These contain ~900 atomic unit specification files. They are preserved for historical reference. The canonical tracker is `docs/atomic/01-tracker.md`.

## Key Files by Purpose

| Purpose | File |
|---------|------|
| Implementation progress | `docs/atomic/01-tracker.md` |
| Architectural invariants | `docs/roadmap/INVARIANTS.md` |
| Design docs | `docs/merged-design-v2/` |
| Project conventions | `AGENTS.md` |
| ADRs | `docs/decisions/ADR-*.md` |
| Production roadmap | `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md` |
| Agent workstreams | `docs/workstreams/AGENT-*-*.md` |
| DB operations guide | `AGENTS.md` § Database Operations |
| Terminology | `docs/atomic/99-glossary.md` |
| Integration workflow | `docs/integration/UNIFIED-WORKFLOW.md` |
| Scenario decision table | `docs/integration/DECISION-TABLE.md` |
| Provider onboarding (PRD-12) | `docs/roadmap/prds/integration/PRD-12-PROVIDER-ONBOARDING-MODES.md` |
