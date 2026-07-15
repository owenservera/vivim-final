# Phase Dependencies — atomic-v17

Single-phase roadmap. Units are mostly independent; the ordering below reflects data flow.

```
1.1 static-catalog ──┬─> 1.3 codegen (catalog shape)
                     └─> 1.5 goal-gate (offline match)

1.2 migrate-wrapper ──> 1.6 guard-hooks (migrate status check)

1.4 ensure-browser + watchdog + process-guard  (independent; safety net)

1.7 skill-upgrade  ── depends on 1.1–1.6 (documents them)
1.8 validation     ── depends on all
```

## Hard constraints
- Governor Canon (B1): `process-guard` / `watchdog` only call `stopServices()` (which shells out to
  `stop-all.ps1`); they never import CDP transport.
- Store Contracts (B2): no engine changes in v17 — only devops tooling + skill + lefthook.
- One Entry Point: new commands are thin shells over existing `/api/*` + `makeCapability`.
