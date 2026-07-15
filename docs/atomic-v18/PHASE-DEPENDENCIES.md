# Phase Dependencies — atomic-v18

Two-phase roadmap. Phase 1 fixes broken mechanics; Phase 2 consolidates + automates.

```
Phase 1 (fix broken):
  1.1 arch-audit ──────> 2.1 consolidate (typecheck must pass first)
  1.2 seed upsert ─────> 2.1 consolidate
  1.3 policyRule ──────> 2.1 consolidate

Phase 2 (consolidate + automate):
  2.1 merge-loop-skills ── depends on 1.1–1.3 (typecheck clean)
  2.2 fold-build-skill ── depends on 2.1 (skill doc merged)
  2.3 wire-automation-cli ── independent (new code, no deps)
  2.4 update-stale-refs ── depends on 2.1 (merged doc is source of truth)
  2.5 skill-discoverability ── depends on 2.1, 2.2, 2.4 (descriptions + index)
```

## Hard constraints
- Governor Canon (B1): automation commands only call `automation-router.ts` (which uses
  `UIAutomator` → CDP). No new CDP transport imports in engine layer.
- Store Contracts (B2): no engine changes in v18 — only devops tooling + skills + CLI.
- One Entry Point: new `automate` commands are thin shells over `/api/automate/*`.
- Typecheck gate: all v18 changes must pass `bun run typecheck` before commit.
